/* ============================================
   CODEFLOW v02.9 - FINAL FIXES
   - Botón '+' en TODAS las líneas
   - Corrección Foco (Recuadro Negro)
============================================ */

document.addEventListener('DOMContentLoaded', function() {

  /* 0. UTILS */
  const Utils = {
    generateId: () => 'node_' + Math.random().toString(36).substr(2, 9),
    clone: (obj) => { try { return structuredClone(obj); } catch (e) { return JSON.parse(JSON.stringify(obj)); } },
    isValidName: (n) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(n),
    getDefaultVal: (type) => type === 'number' ? 0 : ""
  };

  /* 1. GESTOR DE HISTORIAL */
  const HistoryManager = {
    stack: [], pointer: -1, limit: 50,
    saveState: function() {
      if (this.pointer < this.stack.length - 1) this.stack = this.stack.slice(0, this.pointer + 1);
      this.stack.push({
        ast: Utils.clone(ASTManager.root),
        vars: Utils.clone(Array.from(VariableRegistry._vars.entries())),
        funcs: Utils.clone(Array.from(FunctionRegistry._funcs.entries()))
      });
      if (this.stack.length > this.limit) this.stack.shift(); else this.pointer++;
      this.updateUI();
    },
    undo: function() { if(this.pointer > 0) { this.pointer--; this.restore(this.stack[this.pointer]); } this.updateUI(); },
    redo: function() { if(this.pointer < this.stack.length - 1) { this.pointer++; this.restore(this.stack[this.pointer]); } this.updateUI(); },
    restore: function(s) {
      if(!s) return;
      ASTManager.root = Utils.clone(s.ast);
      VariableRegistry._vars = new Map(Utils.clone(s.vars));
      FunctionRegistry._funcs = new Map(Utils.clone(s.funcs));
      EditorRenderer.render(); PanelManager.renderVarsList(); PanelManager.renderFuncsList(); FormManager.updateAllSelects(); StorageManager.saveLocal();
    },
    updateUI: function() {
      const u=document.getElementById('btnUndo'), r=document.getElementById('btnRedo');
      if(u) u.style.opacity = (this.pointer > 0) ? '1' : '0.4';
      if(r) r.style.opacity = (this.pointer < this.stack.length - 1) ? '1' : '0.4';
    }
  };

  /* 2. REGISTROS */
  const VariableRegistry = {
    _vars: new Map(),
    create: function(name, type) {
      if (!Utils.isValidName(name)) return { success: false, error: "Nombre inválido" };
      if ([...this._vars.values()].some(v => v.name === name)) return { success: false, error: "Ya existe" };
      HistoryManager.saveState();
      const id = Utils.generateId();
      this._vars.set(id, { id, name, type, value: Utils.getDefaultVal(type) });
      this.notifyChange(); return { success: true };
    },
    delete: function(id) { if(confirm("¿Eliminar variable?")) { HistoryManager.saveState(); this._vars.delete(id); this.notifyChange(); } },
    get: (id) => VariableRegistry._vars.get(id),
    getAll: () => Array.from(VariableRegistry._vars.values()),
    hasVars: () => VariableRegistry._vars.size > 0,
    notifyChange: () => { PanelManager.renderVarsList(); FormManager.updateAllSelects(); EditorRenderer.render(); StorageManager.saveLocal(); }
  };

  const FunctionRegistry = {
    _funcs: new Map(),
    create: function(name) {
      if (!Utils.isValidName(name)) return { success: false, error: "Nombre inválido" };
      if ([...this._funcs.values()].some(f => f.name === name)) return { success: false, error: "Ya existe" };
      HistoryManager.saveState();
      const id = Utils.generateId();
      this._funcs.set(id, { id, name });
      this.notifyChange(); return { success: true };
    },
    delete: function(id) { if(confirm("¿Eliminar función?")) { HistoryManager.saveState(); this._funcs.delete(id); this.notifyChange(); } },
    getAll: () => Array.from(FunctionRegistry._funcs.values()),
    notifyChange: () => { PanelManager.renderFuncsList(); StorageManager.saveLocal(); }
  };

  /* 3. AST MANAGER */
  const ASTManager = {
    root: { id: 'root', type: 'program', children: [] },
    reset: () => { HistoryManager.saveState(); ASTManager.root = { id: 'root', type: 'program', children: [] }; EditorRenderer.render(); StorageManager.saveLocal(); },
    findNode: (id, node = ASTManager.root) => {
      if(node.id === id) return node;
      if(node.children) { for(let c of node.children) { const f = ASTManager.findNode(id, c); if(f) return f; } }
      return null;
    },
    addNode: (type, data, parentId = 'root') => {
      const parent = ASTManager.findNode(parentId);
      if(!parent || !Array.isArray(parent.children)) return;
      HistoryManager.saveState();
      const node = { id: Utils.generateId(), type, parentId, data, children: ['if','while','for'].includes(type) ? [] : null };
      parent.children.push(node);
      EditorRenderer.render(); StorageManager.saveLocal();
    },
    deleteNode: (id) => {
      const node = ASTManager.findNode(id); if(!node) return;
      if(node.children && node.children.length > 0 && !confirm("¿Borrar contenido?")) return;
      HistoryManager.saveState();
      const parent = ASTManager.findNode(node.parentId);
      if(parent) { parent.children = parent.children.filter(n => n.id !== id); EditorRenderer.render(); StorageManager.saveLocal(); }
    }
  };

  /* 4. RENDERER (CORREGIDO: Botones '+' en líneas vacías) */
  const EditorRenderer = {
    container: document.getElementById('codeLines'),
    lineCounter: 1,
    MIN_LINES: 16,

    render: () => {
      if(!EditorRenderer.container) return;
      EditorRenderer.container.innerHTML = '';
      EditorRenderer.lineCounter = 1;
      
      EditorRenderer._visit(ASTManager.root.children, 0);

      // Línea inicial
      if (ASTManager.root.children.length === 0) {
         EditorRenderer._createLine(null, 0, true, 'root');
      }

      // Relleno con botones interactivos
      const current = EditorRenderer.lineCounter;
      if (current < EditorRenderer.MIN_LINES) {
          for(let i=0; i < (EditorRenderer.MIN_LINES - current); i++) EditorRenderer._createEmptyLine();
      }
    },

    _visit: (nodes, level) => {
      nodes.forEach(n => {
        EditorRenderer._createLine(n, level, false);
        if(n.children) {
          if(n.children.length > 0) EditorRenderer._visit(n.children, level + 1);
          else EditorRenderer._createLine(null, level + 1, true, n.id);
          EditorRenderer._createCloser(n, level);
        }
      });
    },

    _createLine: (n, level, isPlaceholder, targetId) => {
      const el = document.createElement('div'); el.className = 'editor-line';
      const num = document.createElement('div'); num.className = 'line-number'; num.innerText = EditorRenderer.lineCounter++;
      const content = document.createElement('div'); content.className = `line-content indent-${Math.min(level, 5)}`;
      
      if(isPlaceholder) {
        content.innerHTML = `<span style="opacity:0.4; font-style:italic;">// Agregar instrucción...</span>`;
      } else {
        content.innerHTML = EditorRenderer._html(n);
      }

      // Botón "+"
      const plus = document.createElement('div'); plus.className = 'plus-icon'; plus.innerText = '+';
      plus.onclick = (e) => { 
          e.stopPropagation(); 
          const tid = isPlaceholder ? targetId : n.parentId;
          ContextMenuManager.show(e.clientX, e.clientY, tid); 
      };

      const del = document.createElement('div'); del.className = 'line-del-btn'; del.innerText = '×';
      if(!isPlaceholder) del.onclick = (e) => { e.stopPropagation(); ASTManager.deleteNode(n.id); }; else del.style.visibility='hidden';

      el.append(num, content, plus, del);
      EditorRenderer.container.appendChild(el);
    },

    // CORREGIDO: Las líneas vacías de relleno ahora tienen el botón '+'
    _createEmptyLine: () => {
        const el = document.createElement('div'); el.className = 'editor-line';
        const num = document.createElement('div'); num.className = 'line-number'; num.innerText = EditorRenderer.lineCounter++;
        const content = document.createElement('div'); content.className = 'line-content';
        
        // Agregar botón '+' que apunta al final del programa (root)
        const plus = document.createElement('div'); plus.className = 'plus-icon'; plus.innerText = '+';
        plus.onclick = (e) => {
            e.stopPropagation();
            ContextMenuManager.show(e.clientX, e.clientY, 'root');
        };

        const del = document.createElement('div'); del.className = 'line-del-btn'; del.style.visibility = 'hidden';

        el.append(num, content, plus, del);
        EditorRenderer.container.appendChild(el);
    },

    _createCloser: (node, level) => {
      const el = document.createElement('div'); el.className = 'editor-line';
      const num = document.createElement('div'); num.className = 'line-number'; num.innerText = EditorRenderer.lineCounter++;
      const content = document.createElement('div'); content.className = `line-content indent-${level}`;
      content.innerHTML = `<span class="bracket">}</span>`;
      
      const plus = document.createElement('div'); plus.className = 'plus-icon'; plus.innerText = '+';
      plus.onclick = (e) => {
          e.stopPropagation();
          ContextMenuManager.show(e.clientX, e.clientY, node.parentId);
      };

      const del = document.createElement('div'); del.className = 'line-del-btn'; del.style.visibility = 'hidden';

      el.append(num, content, plus, del);
      EditorRenderer.container.appendChild(el);
    },

    _html: (n) => {
      const kw = t => `<span class="keyword">${t}</span>`;
      const vr = id => { const v=VariableRegistry.get(id); return v ? `<span class="variable">${v.name}</span>` : `<span style="color:red">?</span>`; };
      const str = t => `<span class="string">"${t}"</span>`;
      const num = x => `<span class="number">${x}</span>`;
      const op = o => `<span class="operator">${o}</span>`;

      switch(n.type) {
        case 'assign': 
            const r = n.data.expression.type==='literal' ? (n.data.expression.valueType==='string'?str(n.data.expression.value):num(n.data.expression.value)) : vr(n.data.expression.varId);
            return `${vr(n.data.targetVarId)} ${op('←')} ${r}`;
        case 'read': return `${kw('Leer')} (${vr(n.data.targetVarId)})`;
        case 'show': 
            const parts = (n.data.parts||[]).map(p => p.type==='text'?str(p.value):vr(p.varId)).join(', ');
            return `${kw('Mostrar')} (${parts})`;
        case 'if': return `${kw('Si')} (${vr(n.data.condition.leftVarId)} ${op(n.data.condition.operator)} ${n.data.condition.rightType==='variable'?vr(n.data.condition.rightVarId):n.data.condition.rightValue}) {`;
        case 'while': return `${kw('Mientras')} (${vr(n.data.condition.leftVarId)} ${op(n.data.condition.operator)} ${n.data.condition.rightValue}) {`;
        case 'for':
            const iName = n.data.iterName || 'i';
            const iteratorDisplay = `<span class="variable">${iName}</span>`;
            if (n.data.subType === 'iterable') {
                return `${kw('Para')} ${iteratorDisplay} ${kw('en')} ${vr(n.data.iterableVarId)} {`;
            } else {
                return `${kw('Para')} ${iteratorDisplay} ${kw('de')} ${num(n.data.start)} ${kw('hasta')} ${num(n.data.end)} {`;
            }
        default: return 'Code';
      }
    }
  };

  /* 5. PANELES */
  const PanelManager = {
    init: function() {
        document.querySelectorAll('.floating-panel-header').forEach(h => h.addEventListener('mousedown', this.drag));
        document.querySelectorAll('.floating-panel-close').forEach(b => b.onclick = this.closeAll);
    },
    drag: function(e) {
        e.preventDefault(); 
        const target = this.parentElement.classList.contains('floating-panel') ? this.parentElement : this.closest('.context-menu-popup');
        if(!target) return;
        target.dataset.moved="true";
        const offX = e.clientX - target.getBoundingClientRect().left;
        const offY = e.clientY - target.getBoundingClientRect().top;
        const mv = (ev) => { target.style.left=(ev.clientX-offX)+'px'; target.style.top=(ev.clientY-offY)+'px'; };
        const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
        document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    },
    open: (id) => {
        document.querySelectorAll('.floating-panel').forEach(p => p.classList.remove('active'));
        const p = document.getElementById(id);
        if(p) { 
            p.classList.add('active'); 
            if(p.dataset.moved !== "true") { 
                const rect = p.getBoundingClientRect();
                p.style.left = (window.innerWidth/2 - rect.width/2)+'px'; p.style.top = '150px'; 
            }
            if(id === 'panelFormShow') { FormManager.showParts = []; FormManager.renderPreview(); }
            
            if(id === 'panelFormFor') {
                const rangeRadio = p.querySelector('input[value="range"]');
                if(rangeRadio) { rangeRadio.checked = true; rangeRadio.dispatchEvent(new Event('change')); }
            }

            // CORRECCIÓN FOCO: Evitar enfocar radios ocultos (causa del recuadro negro)
            const inp = p.querySelector('input[type="text"], input[type="number"], select'); 
            if(inp) setTimeout(()=>inp.focus(),50);
        }
        FormManager.updateAllSelects();
    },
    closeAll: () => document.querySelectorAll('.floating-panel').forEach(p => p.classList.remove('active')),
    renderVarsList: () => {
        const c = document.getElementById('varsListContainer');
        c.innerHTML = VariableRegistry.getAll().map(v => `<div class="manage-item"><span><b>${v.name}</b> <small>(${v.type})</small></span><div class="manage-actions"><button onclick="VariableRegistry.delete('${v.id}')">×</button></div></div>`).join('') || '<div style="padding:10px;text-align:center;color:#ccc">Vacío</div>';
    },
    renderFuncsList: () => {
        const c = document.getElementById('funcsListContainer');
        c.innerHTML = FunctionRegistry.getAll().map(f => `<div class="manage-item"><span>${f.name}()</span><div class="manage-actions"><button onclick="FunctionRegistry.delete('${f.id}')">×</button></div></div>`).join('') || '<div style="padding:10px;text-align:center;color:#ccc">Vacío</div>';
    }
  };

  /* 6. CONTEXT MENU */
  const ContextMenuManager = {
      init: function() {
          const h = document.getElementById('dragMenuHandle');
          if(h) h.addEventListener('mousedown', PanelManager.drag);
      },
      show: (x, y, pid) => {
          FormManager.targetId = pid;
          const m = document.getElementById('quickContextMenu');
          m.style.left = x+'px'; m.style.top = y+'px'; m.style.display = 'block';
          const noVars = !VariableRegistry.hasVars();
          ['open-assign', 'open-read'].forEach(act => {
             const el = m.querySelector(`[data-action="${act}"]`);
             if(el) el.classList.toggle('disabled', noVars);
          });
      }
  };

  /* 7. FORM MANAGER */
  const FormManager = {
    targetId: 'root', showParts: [],
    init: () => {
      document.getElementById('btnManageVars').onclick = () => PanelManager.open('panelManageVars');
      document.getElementById('btnManageFuncs').onclick = () => PanelManager.open('panelManageFuncs');
      
      document.getElementById('formAddVar').onsubmit = (e) => { e.preventDefault(); const d = new FormData(e.target); const res = VariableRegistry.create(d.get('varName').trim(), d.get('varType')); if(!res.success) alert(res.error); else e.target.reset(); };
      document.getElementById('formAddFunc').onsubmit = (e) => { e.preventDefault(); const d = new FormData(e.target); const res = FunctionRegistry.create(d.get('funcName').trim()); if(!res.success) alert(res.error); else e.target.reset(); };

      const addP = (p) => { FormManager.showParts.push(p); FormManager.renderPreview(); };
      document.getElementById('btnAddText').onclick = () => { const i=document.getElementById('builderTextInput'); if(i.value){ addP({type:'text',value:i.value}); i.value=''; }};
      document.getElementById('btnAddVar').onclick = () => { const s=document.getElementById('builderVarSelect'); if(s.value){ addP({type:'variable',varId:s.value}); }};
      document.getElementById('btnResetMsg').onclick = () => { FormManager.showParts=[]; FormManager.renderPreview(); };
      document.getElementById('btnUndoPart').onclick = () => { FormManager.showParts.pop(); FormManager.renderPreview(); };
      document.getElementById('btnSaveShow').onclick = () => { if(FormManager.showParts.length===0) return alert("Vacío"); ASTManager.addNode('show', {parts:[...FormManager.showParts]}, FormManager.targetId); PanelManager.closeAll(); };

      const bind = (id, fn) => document.getElementById(id).onsubmit = e => { e.preventDefault(); fn(new FormData(e.target)); PanelManager.closeAll(); };
      bind('formAssign', d => {
          const ex = { type:d.get('valType'), valueType:VariableRegistry.get(d.get('targetVarId')).type };
          if(ex.type==='literal') ex.value = ex.valueType==='number' ? Number(d.get('literalVal')) : d.get('literalVal'); else ex.varId = d.get('sourceVarId');
          ASTManager.addNode('assign', {targetVarId:d.get('targetVarId'), expression:ex}, FormManager.targetId);
      });
      bind('formRead', d => ASTManager.addNode('read', {targetVarId:d.get('targetVarId')}, FormManager.targetId));
      bind('formIf', d => FormManager.addCond('if', d));
      bind('formWhile', d => FormManager.addCond('while', d));
      
      bind('formFor', d => {
          const type = d.get('forType');
          const iName = d.get('iterName') || 'i';
          const data = { subType: type, iterName: iName };
          if(type === 'iterable') data.iterableVarId = d.get('iterableVarId');
          else { data.start = Number(d.get('startVal')); data.end = Number(d.get('endVal')); }
          ASTManager.addNode('for', data, FormManager.targetId);
      });

      FormManager.setupToggles();
    },
    addCond: (t, d) => {
        const l=d.get('leftVarId'), lt=VariableRegistry.get(l).type, rv=d.get('rightVal');
        ASTManager.addNode(t, {condition:{leftVarId:l, leftType:lt, operator:d.get('operator'), rightType:'literal', rightValue:lt==='number'?Number(rv):rv}}, FormManager.targetId);
    },
    renderPreview: () => {
        document.getElementById('msgBuilderPreview').innerHTML = FormManager.showParts.map(p => p.type==='text' ? `<span class="msg-part msg-txt">${p.value}</span>` : `<span class="msg-part msg-var">${VariableRegistry.get(p.varId)?.name}</span>`).join('') || '<span style="color:#ccc;font-size:12px">Vacío...</span>';
    },
    updateAllSelects: () => {
        const vars = VariableRegistry.getAll();
        document.querySelectorAll('.var-select').forEach(s => {
            const v = s.value; s.innerHTML = '';
            vars.forEach(x => { const o=document.createElement('option'); o.value=x.id; o.text=`${x.name}`; s.appendChild(o); });
            if(vars.find(x=>x.id===v)) s.value = v;
            if(s.id === 'assignVarSelect' || s.id === 'builderVarSelect') {
                const msg = s.closest('.form-row').querySelector('.no-variables-msg');
                if(msg) msg.style.display = vars.length ? 'none' : 'block';
            }
        });
    },
    setupToggles: () => {
        document.querySelectorAll('input[type=radio]').forEach(r => r.addEventListener('change', () => {
            if(r.name === 'valType') { 
                document.getElementById('asnLitRow').style.display = r.value==='literal'?'block':'none';
                document.getElementById('asnVarRow').style.display = r.value==='variable'?'block':'none';
            }
            if(r.name === 'forType') {
                const isRange = r.value === 'range';
                document.getElementById('forRangeRow').style.display = isRange ? 'flex' : 'none';
                document.getElementById('forIterRow').style.display = isRange ? 'none' : 'block';
                
                const iterInput = document.querySelector('input[name="iterName"]');
                if(iterInput) {
                    if (isRange) {
                        iterInput.value = 'i';
                        iterInput.readOnly = true;
                        iterInput.style.backgroundColor = '#f1f5f9';
                        iterInput.style.color = '#94a3b8';
                    } else {
                        iterInput.readOnly = false;
                        iterInput.value = '';
                        iterInput.placeholder = 'Ej: item';
                        iterInput.style.backgroundColor = '#ffffff';
                        iterInput.style.color = 'var(--color-text-primary)';
                        FormManager.updateAllSelects();
                    }
                }
            }
        }));
    }
  };

  /* 8. TRANSPILER */
  const PythonTranspiler = {
    generate: () => {
        let c = "# CodeFlow v02.9\n\n# --- VARIABLES ---\n";
        VariableRegistry.getAll().forEach(v => c += `${v.name} = ${v.type==='string'?`"${v.value}"`:v.value}\n`);
        c += "\n# --- FUNCIONES ---\n";
        FunctionRegistry.getAll().forEach(f => c += `def ${f.name}():\n    pass\n\n`);
        c += "# --- MAIN ---\n";
        return c + (ASTManager.root.children.length ? PythonTranspiler._visit(ASTManager.root.children, 0) : "pass");
    },
    _visit: (nodes, indent) => {
        let b = ""; const sp = "    ".repeat(indent);
        nodes.forEach(n => {
            if(n.type==='assign') b += `${sp}${VariableRegistry.get(n.data.targetVarId).name} = ${n.data.expression.type==='literal' ? (typeof n.data.expression.value==='string'?`"${n.data.expression.value}"`:n.data.expression.value) : VariableRegistry.get(n.data.expression.varId).name}\n`;
            else if(n.type==='read') b += `${sp}${VariableRegistry.get(n.data.targetVarId).name} = input(f"Ingresa {VariableRegistry.get(n.data.targetVarId).name}: ")\n`;
            else if(n.type==='show') {
                let s = ""; n.data.parts.forEach(p => s += p.type==='text' ? p.value : `{${VariableRegistry.get(p.varId).name}}`);
                b += `${sp}print(f"${s}")\n`;
            }
            else if(n.type==='if' || n.type==='while') {
                b += `${sp}${n.type} ${VariableRegistry.get(n.data.condition.leftVarId).name} ${n.data.condition.operator} ${n.data.condition.rightValue}:\n`;
                b += n.children.length ? PythonTranspiler._visit(n.children, indent+1) : `${sp}    pass\n`;
            }
            else if(n.type==='for') {
                const i = n.data.iterName || 'i';
                if (n.data.subType === 'iterable') {
                    const v = VariableRegistry.get(n.data.iterableVarId);
                    b += `${sp}for ${i} in ${v ? v.name : '[]'}:\n`;
                } else {
                    b += `${sp}for ${i} in range(${n.data.start}, ${n.data.end}):\n`;
                }
                b += n.children.length ? PythonTranspiler._visit(n.children, indent+1) : `${sp}    pass\n`;
            }
        });
        return b;
    }
  };

  /* STORAGE MANAGER */
  const StorageManager = {
    saveLocal: () => {
        localStorage.setItem('cf_v02', JSON.stringify({
          ast: ASTManager.root, 
          vars: Array.from(VariableRegistry._vars.entries()), 
          funcs: Array.from(FunctionRegistry._funcs.entries())
        }));
    },
    loadLocal: () => {
      try {
          const raw = localStorage.getItem('cf_v02');
          if(raw) {
              const s = JSON.parse(raw);
              ASTManager.root = s.ast;
              VariableRegistry._vars = new Map(s.vars);
              FunctionRegistry._funcs = new Map(s.funcs);
              HistoryManager.stack = [{ast:s.ast, vars:s.vars, funcs:s.funcs}];
              HistoryManager.pointer = 0;
          } else {
              HistoryManager.saveState();
          }
          EditorRenderer.render(); VariableRegistry.notifyChange(); FunctionRegistry.notifyChange();
      } catch(e) {
          console.error("Data Corrupta, reseteando...", e);
          ASTManager.reset();
      }
    }
  };

  /* INIT */
  PanelManager.init(); FormManager.init(); ContextMenuManager.init(); StorageManager.loadLocal();
  
  document.getElementById('btnUndo').onclick = () => HistoryManager.undo();
  document.getElementById('btnRedo').onclick = () => HistoryManager.redo();
  document.getElementById('btnClear').onclick = () => { if(confirm("¿Reiniciar?")) ASTManager.reset(); };
  document.getElementById('btnTranspile').onclick = () => { document.getElementById('pythonCodeOutput').innerText = PythonTranspiler.generate(); PanelManager.open('panelPythonCode'); };
  
  document.getElementById('quickContextMenu').addEventListener('click', e => {
      const it = e.target.closest('.context-menu-item');
      if(it && !it.classList.contains('disabled')) {
          document.getElementById('quickContextMenu').style.display = 'none';
          const actions = {'open-create-var':'panelManageVars', 'open-function':'panelManageFuncs', 'open-assign':'panelFormAssign', 'open-read':'panelFormRead', 'open-show':'panelFormShow', 'open-if':'panelFormIf', 'open-while':'panelFormWhile', 'open-for':'panelFormFor'};
          if(actions[it.dataset.action]) PanelManager.open(actions[it.dataset.action]);
      }
  });
  document.addEventListener('click', e => { if(!e.target.closest('.plus-icon') && !e.target.closest('.context-menu-popup')) document.getElementById('quickContextMenu').style.display='none'; });

  window.VariableRegistry = VariableRegistry; window.FunctionRegistry = FunctionRegistry; window.ASTManager = ASTManager; window.ContextMenuManager = ContextMenuManager;
  console.log("CodeFlow v02.9 Ready");
});