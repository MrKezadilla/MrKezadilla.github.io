/* ============================================
   CODEFLOW v04.2 - CORE (Modularizado)
   - Lógica conectada a Validador.js
   - Sintaxis TODO.md (Read, Print, Loop, End)
   - Inserción exacta y Botón (↓)
============================================ */

document.addEventListener('DOMContentLoaded', function() {

  /* 0. UTILS */
  const Utils = {
    generateId: () => 'node_' + Math.random().toString(36).substr(2, 9),
    clone: (obj) => { 
        try { return structuredClone(obj); } 
        catch (e) { return JSON.parse(JSON.stringify(obj)); } 
    },
    isValidName: (n) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(n),
    getDefaultVal: (type) => {
      if(type === 'number') return 0;
      if(type === 'boolean') return false;
      if(type === 'list') return [];
      return "";
    }
  };

  /* 1. GESTOR DE HISTORIAL */
  const HistoryManager = {
    stack: [], pointer: -1, limit: 50,
    saveState: function() {
      if (this.pointer < this.stack.length - 1) {
          this.stack = this.stack.slice(0, this.pointer + 1);
      }
      this.stack.push({
        ast: Utils.clone(ASTManager.root),
        vars: Utils.clone(Array.from(VariableRegistry._vars.entries())),
        funcs: Utils.clone(Array.from(FunctionRegistry._funcs.entries()))
      });
      if (this.stack.length > this.limit) {
          this.stack.shift(); 
      } else {
          this.pointer++;
      }
      this.updateUI();
    },
    undo: function() { 
        if(this.pointer > 0) { 
            this.pointer--; 
            this.restore(this.stack[this.pointer]); 
        } 
        this.updateUI(); 
    },
    redo: function() { 
        if(this.pointer < this.stack.length - 1) { 
            this.pointer++; 
            this.restore(this.stack[this.pointer]); 
        } 
        this.updateUI(); 
    },
    restore: function(s) {
      if(!s) return;
      ASTManager.root = Utils.clone(s.ast);
      VariableRegistry._vars = new Map(Utils.clone(s.vars));
      FunctionRegistry._funcs = new Map(Utils.clone(s.funcs));
      EditorRenderer.render(); 
      PanelManager.renderVarsList(); 
      PanelManager.renderFuncsList(); 
      FormManager.updateAllSelects(); 
      StorageManager.saveLocal();
    },
    updateUI: function() {
      const u = document.getElementById('btnUndo');
      const r = document.getElementById('btnRedo');
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
      this.notifyChange(); 
      return { success: true };
    },
    delete: function(id) { 
        if(confirm("¿Eliminar variable?")) { 
            HistoryManager.saveState(); 
            this._vars.delete(id); 
            this.notifyChange(); 
        } 
    },
    get: (id) => VariableRegistry._vars.get(id),
    getAll: () => Array.from(VariableRegistry._vars.values()),
    hasVars: () => VariableRegistry._vars.size > 0,
    notifyChange: () => { 
        PanelManager.renderVarsList(); 
        FormManager.updateAllSelects(); 
        EditorRenderer.render(); 
        StorageManager.saveLocal(); 
    }
  };

  const FunctionRegistry = {
    _funcs: new Map(),
    create: function(name) {
      if (!Utils.isValidName(name)) return { success: false, error: "Nombre inválido" };
      if ([...this._funcs.values()].some(f => f.name === name)) return { success: false, error: "Ya existe" };
      HistoryManager.saveState();
      const id = Utils.generateId();
      this._funcs.set(id, { id, name });
      this.notifyChange(); 
      return { success: true };
    },
    delete: function(id) { 
        if(confirm("¿Eliminar función?")) { 
            HistoryManager.saveState(); 
            this._funcs.delete(id); 
            this.notifyChange(); 
        } 
    },
    get: (id) => FunctionRegistry._funcs.get(id),
    getAll: () => Array.from(FunctionRegistry._funcs.values()),
    notifyChange: () => { 
        PanelManager.renderFuncsList(); 
        FormManager.updateAllSelects(); 
        StorageManager.saveLocal(); 
    }
  };

  /* 3. AST MANAGER */
  const ASTManager = {
    root: { id: 'root', type: 'program', children: [] },
    reset: () => {
      HistoryManager.saveState();
      ASTManager.root = { id: 'root', type: 'program', children: [] };
      EditorRenderer.render(); 
      StorageManager.saveLocal();
    },
    findNode: (id, node = ASTManager.root) => {
      if(node.id === id) return node;
      if(node.children) { 
          for(let c of node.children) { 
              const f = ASTManager.findNode(id, c); 
              if(f) return f; 
          } 
      }
      return null;
    },
    findParent: (targetId, node = ASTManager.root) => {
      if(!node.children) return null;
      if(node.children.some(c => c.id === targetId)) return node;
      for(let c of node.children) {
        const found = ASTManager.findParent(targetId, c);
        if(found) return found;
      }
      return null;
    },
    isAncestor: (ancestorId, nodeId) => {
      const node = ASTManager.findNode(nodeId);
      if(!node) return false;
      if(node.parentId === ancestorId) return true;
      if(!node.parentId || node.parentId === 'root') return false;
      return ASTManager.isAncestor(ancestorId, node.parentId);
    },
    addNode: (type, data, parentId = 'root', insertAfter = null) => {
      const parent = ASTManager.findNode(parentId);
      if(!parent || !Array.isArray(parent.children)) return;
      
      HistoryManager.saveState();
      const hasChildren = ['if','while','for','loop','function_def'].includes(type);
      const node = { id: Utils.generateId(), type, parentId, data, children: hasChildren ? [] : null };
      
      if(insertAfter) {
        const idx = parent.children.findIndex(c => c.id === insertAfter);
        if(idx !== -1) {
            parent.children.splice(idx + 1, 0, node);
        } else {
            parent.children.push(node);
        }
      } else {
        parent.children.push(node);
      }
      EditorRenderer.render(); 
      StorageManager.saveLocal();
    },
    deleteNode: (id) => {
      const node = ASTManager.findNode(id); 
      if(!node) return;
      if(node.children && node.children.length > 0 && !confirm("¿Borrar contenido?")) return;
      
      HistoryManager.saveState();
      const parent = ASTManager.findParent(id);
      if(parent) {
        parent.children = parent.children.filter(n => n.id !== id);
        EditorRenderer.render(); 
        StorageManager.saveLocal();
      }
    }
  };

  /* 4. SELECTION MANAGER */
  const SelectionManager = {
    active: false,
    selectedIds: new Set(),
    toggleMode: () => {
      SelectionManager.active = !SelectionManager.active;
      const btn = document.getElementById('btnMultiSelect');
      if(btn) btn.classList.toggle('active', SelectionManager.active);
      document.body.classList.toggle('selection-mode', SelectionManager.active);
      if (!SelectionManager.active) SelectionManager.clear();
    },
    toggleSelect: (nodeId, el) => {
      if (!SelectionManager.active || !nodeId) return;
      if (SelectionManager.selectedIds.has(nodeId)) {
        SelectionManager.selectedIds.delete(nodeId);
        el.classList.remove('selected');
      } else {
        SelectionManager.selectedIds.add(nodeId);
        el.classList.add('selected');
      }
      const delBtn = document.getElementById('btnDeleteSelected');
      if(delBtn) delBtn.style.display = SelectionManager.selectedIds.size > 0 ? 'inline-block' : 'none';
    },
    clear: () => {
      SelectionManager.selectedIds.clear();
      document.querySelectorAll('.editor-line.selected').forEach(el => el.classList.remove('selected'));
      const delBtn = document.getElementById('btnDeleteSelected');
      if(delBtn) delBtn.style.display = 'none';
    },
    deleteSelected: () => {
      if (SelectionManager.selectedIds.size === 0) return;
      if (confirm(`¿Borrar ${SelectionManager.selectedIds.size} instrucción(es) y todo su contenido?`)) {
        HistoryManager.saveState();
        SelectionManager.selectedIds.forEach(id => {
           const parent = ASTManager.findParent(id);
           if (parent) parent.children = parent.children.filter(n => n.id !== id);
        });
        SelectionManager.clear();
        EditorRenderer.render();
        StorageManager.saveLocal();
      }
    }
  };

  /* 5. DRAG & DROP MANAGER */
  const DragManager = {
    draggingIds: [], 
    dropTargetId: null, 
    dropPosition: null,
    startDrag: (nodeId) => {
      if (SelectionManager.active && SelectionManager.selectedIds.has(nodeId)) {
        DragManager.draggingIds = Array.from(SelectionManager.selectedIds);
      } else {
          DragManager.draggingIds = [nodeId];
      }
      document.body.classList.add('is-dragging');
    },
    endDrag: () => {
      DragManager.draggingIds = []; 
      DragManager.dropTargetId = null; 
      DragManager.dropPosition = null;
      document.body.classList.remove('is-dragging');
      document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
      document.querySelectorAll('.drop-target-inside').forEach(el => el.classList.remove('drop-target-inside'));
    },
    handleDrop: (targetNodeId, position) => {
      const draggingIds = DragManager.draggingIds;
      if(!draggingIds.length || draggingIds.includes(targetNodeId)) { DragManager.endDrag(); return; }
      
      const targetNode = ASTManager.findNode(targetNodeId);
      if(!targetNode) { DragManager.endDrag(); return; }

      for(let id of draggingIds) {
        if(ASTManager.isAncestor(id, targetNodeId)) { DragManager.endDrag(); return; }
      }
      
      HistoryManager.saveState();

      if(position === 'inside') {
        if(!targetNode.children) { DragManager.endDrag(); return; }
        draggingIds.forEach(id => {
          const node = ASTManager.findNode(id);
          const oldParent = ASTManager.findParent(id);
          if(node && oldParent) {
            oldParent.children = oldParent.children.filter(n => n.id !== id);
            node.parentId = targetNodeId; 
            targetNode.children.push(node);
          }
        });
      } else {
        const targetParent = ASTManager.findParent(targetNodeId);
        if(!targetParent) { DragManager.endDrag(); return; }
        
        const nodesToMove = [];
        draggingIds.forEach(id => {
          const node = ASTManager.findNode(id);
          const oldParent = ASTManager.findParent(id);
          if(node && oldParent) {
            oldParent.children = oldParent.children.filter(n => n.id !== id);
            node.parentId = targetParent.id; 
            nodesToMove.push(node);
          }
        });
        
        let targetIndex = targetParent.children.findIndex(c => c.id === targetNodeId);
        if(targetIndex === -1) targetIndex = targetParent.children.length;
        const insertIndex = position === 'after' ? targetIndex + 1 : targetIndex;
        
        targetParent.children.splice(insertIndex, 0, ...nodesToMove);
      }
      
      EditorRenderer.render(); 
      StorageManager.saveLocal(); 
      DragManager.endDrag();
    }
  };

  /* 6. RENDERER (AST a UI) */
  const EditorRenderer = {
    container: document.getElementById('codeLines'),
    lineCounter: 1, 
    MIN_LINES: 16,

    render: () => {
      if(!EditorRenderer.container) return;
      EditorRenderer.container.innerHTML = '';
      EditorRenderer.lineCounter = 1;
      
      EditorRenderer._visit(ASTManager.root.children, 0, 'root');
      
      if (ASTManager.root.children.length === 0) {
          EditorRenderer._createLine(null, 0, true, 'root');
      }
      
      const current = EditorRenderer.lineCounter;
      if (current < EditorRenderer.MIN_LINES) {
        for(let i=0; i < (EditorRenderer.MIN_LINES - current); i++) {
            EditorRenderer._createEmptyLine();
        }
      }
    },

    _visit: (nodes, level, parentId) => {
      nodes.forEach(n => {
        if (n.type === 'empty') {
            EditorRenderer._createLine(n, level, true, n.parentId);
        } else {
            EditorRenderer._createLine(n, level, false, null);
            if(n.children) {
              if(n.children.length > 0) {
                  EditorRenderer._visit(n.children, level + 1, n.id);
              } else {
                  EditorRenderer._createLine(null, level + 1, true, n.id);
              }
              
              if (n.type === 'function_def') {
                  EditorRenderer._createReturnLine(n, level + 1);
              }
              EditorRenderer._createCloser(n, level);
            }
        }
      });
    },

    _createLine: (n, level, isPlaceholder, targetId) => {
      const el = document.createElement('div');
      el.className = 'editor-line';
      
      if(n) {
        el.dataset.nodeId = n.id; 
        el.draggable = true;
        EditorRenderer._attachDragEvents(el, n.id);
        
        el.onclick = (e) => {
          if (SelectionManager.active) { 
              e.stopPropagation(); 
              SelectionManager.toggleSelect(n.id, el); 
          }
        };
        if (SelectionManager.selectedIds.has(n.id)) {
            el.classList.add('selected');
        }
      }

      const num = document.createElement('div');
      num.className = 'line-number'; 
      num.innerText = EditorRenderer.lineCounter++;

      const content = document.createElement('div');
      content.className = `line-content indent-${Math.min(level, 5)}`;
      
      if(isPlaceholder) {
          if (n && n.type === 'empty') {
              content.innerHTML = `<span style="opacity:0.2; font-style:italic;">// (Línea vacía)</span>`;
          } else {
              content.innerHTML = `<span style="opacity:0.4; font-style:italic;">// Agregar instrucción...</span>`;
          }
      } else {
          content.innerHTML = EditorRenderer._html(n);
      }

      const dragHandle = document.createElement('div');
      dragHandle.className = 'drag-handle'; 
      dragHandle.innerHTML = '⠿'; 
      dragHandle.title = 'Arrastrar';

      const downBtn = document.createElement('div');
      downBtn.className = 'down-btn'; 
      downBtn.innerText = '↓';
      downBtn.onclick = (e) => {
        e.stopPropagation();
        const pid = n ? n.parentId : targetId;
        const insertAfterId = n ? n.id : null;
        ASTManager.addNode('empty', {}, pid, insertAfterId);
      };

      const plus = document.createElement('div');
      plus.className = 'plus-icon'; 
      plus.innerText = '+';
      plus.onclick = (e) => {
        e.stopPropagation();
        const pid = n ? n.parentId : targetId;
        const insertAfterId = n ? n.id : null;
        ContextMenuManager.show(e.clientX, e.clientY, pid, insertAfterId);
      };

      const del = document.createElement('div');
      del.className = 'line-del-btn'; 
      del.innerText = '×';
      
      if(n) {
          del.onclick = (e) => { e.stopPropagation(); ASTManager.deleteNode(n.id); };
      } else { 
          del.style.visibility = 'hidden'; 
          dragHandle.style.visibility = 'hidden'; 
      }

      el.append(dragHandle, num, content, downBtn, plus, del);
      EditorRenderer.container.appendChild(el);
    },

    _createEmptyLine: () => {
      const el = document.createElement('div'); 
      el.className = 'editor-line';
      
      const num = document.createElement('div'); 
      num.className = 'line-number'; 
      num.innerText = EditorRenderer.lineCounter++;
      
      const content = document.createElement('div'); 
      content.className = 'line-content';
      
      const dragHandle = document.createElement('div'); 
      dragHandle.className = 'drag-handle'; 
      dragHandle.style.visibility = 'hidden';
      
      const downBtn = document.createElement('div'); 
      downBtn.className = 'down-btn'; 
      downBtn.innerText = '↓';
      downBtn.onclick = (e) => { 
          e.stopPropagation(); 
          ASTManager.addNode('empty', {}, 'root', null); 
      };
      
      const plus = document.createElement('div'); 
      plus.className = 'plus-icon'; 
      plus.innerText = '+';
      plus.onclick = (e) => { 
          e.stopPropagation(); 
          ContextMenuManager.show(e.clientX, e.clientY, 'root', null); 
      };
      
      const del = document.createElement('div'); 
      del.className = 'line-del-btn'; 
      del.style.visibility = 'hidden';
      
      el.append(dragHandle, num, content, downBtn, plus, del);
      EditorRenderer.container.appendChild(el);
    },

    _createReturnLine: (node, level) => {
      const el = document.createElement('div'); 
      el.className = 'editor-line';
      
      const num = document.createElement('div'); 
      num.className = 'line-number'; 
      num.innerText = EditorRenderer.lineCounter++;
      
      const content = document.createElement('div'); 
      content.className = `line-content indent-${Math.min(level, 5)}`;
      
      const retVar = node.data.returnVarId ? VariableRegistry.get(node.data.returnVarId) : null;
      const retText = retVar ? ` <span class="variable">${retVar.name}</span>` : '';
      content.innerHTML = `<span class="keyword">return</span>${retText}`;

      const dragHandle = document.createElement('div'); 
      dragHandle.className = 'drag-handle'; 
      dragHandle.style.visibility = 'hidden';
      
      const downBtn = document.createElement('div'); 
      downBtn.className = 'down-btn'; 
      downBtn.style.visibility = 'hidden';
      
      const plus = document.createElement('div'); 
      plus.className = 'plus-icon'; 
      plus.style.visibility = 'hidden';
      
      const del = document.createElement('div'); 
      del.className = 'line-del-btn'; 
      del.style.visibility = 'hidden';

      el.append(dragHandle, num, content, downBtn, plus, del);
      EditorRenderer.container.appendChild(el);
    },

    _createCloser: (node, level) => {
      const el = document.createElement('div'); 
      el.className = 'editor-line closer-line'; 
      el.dataset.closerFor = node.id;
      
      const num = document.createElement('div'); 
      num.className = 'line-number'; 
      num.innerText = EditorRenderer.lineCounter++;
      
      const content = document.createElement('div'); 
      content.className = `line-content indent-${level}`;
      content.innerHTML = `<span class="bracket">}</span> <span class="keyword">End</span>`;
      
      const dragHandle = document.createElement('div'); 
      dragHandle.className = 'drag-handle'; 
      dragHandle.style.visibility = 'hidden';
      
      const downBtn = document.createElement('div'); 
      downBtn.className = 'down-btn'; 
      downBtn.innerText = '↓';
      downBtn.onclick = (e) => { 
          e.stopPropagation(); 
          ASTManager.addNode('empty', {}, node.parentId, node.id); 
      };

      const plus = document.createElement('div'); 
      plus.className = 'plus-icon'; 
      plus.innerText = '+';
      plus.onclick = (e) => { 
          e.stopPropagation(); 
          ContextMenuManager.show(e.clientX, e.clientY, node.parentId, node.id); 
      };
      
      const del = document.createElement('div'); 
      del.className = 'line-del-btn'; 
      del.style.visibility = 'hidden';
      
      el.append(dragHandle, num, content, downBtn, plus, del);
      EditorRenderer.container.appendChild(el);
    },

    _attachDragEvents: (el, nodeId) => {
      el.addEventListener('dragstart', (e) => {
        e.stopPropagation(); 
        DragManager.startDrag(nodeId);
        e.dataTransfer.effectAllowed = 'move'; 
        e.dataTransfer.setData('text/plain', nodeId);
        
        DragManager.draggingIds.forEach(id => {
            const nodeEl = document.querySelector(`.editor-line[data-node-id="${id}"]`);
            if(nodeEl) { 
                nodeEl.classList.add('dragging'); 
                setTimeout(() => nodeEl.classList.add('drag-ghost'), 0); 
            }
        });
      });
      
      el.addEventListener('dragend', (e) => {
        DragManager.draggingIds.forEach(id => {
            const nodeEl = document.querySelector(`.editor-line[data-node-id="${id}"]`);
            if(nodeEl) nodeEl.classList.remove('dragging', 'drag-ghost');
        });
        DragManager.endDrag();
      });
      
      el.addEventListener('dragover', (e) => {
        e.preventDefault(); 
        e.stopPropagation();
        
        if(!DragManager.draggingIds.length || DragManager.draggingIds.includes(nodeId)) return;
        for(let id of DragManager.draggingIds) {
            if(ASTManager.isAncestor(id, nodeId)) return;
        }
        
        e.dataTransfer.dropEffect = 'move';
        const rect = el.getBoundingClientRect(); 
        const y = e.clientY - rect.top; 
        const h = rect.height;
        
        document.querySelectorAll('.drop-indicator').forEach(d => d.remove());
        document.querySelectorAll('.drop-target-inside').forEach(d => d.classList.remove('drop-target-inside'));
        
        const targetNode = ASTManager.findNode(nodeId);
        const hasChildren = targetNode && Array.isArray(targetNode.children);

        if(hasChildren && y > h * 0.25 && y < h * 0.75) {
          DragManager.dropTargetId = nodeId; 
          DragManager.dropPosition = 'inside'; 
          el.classList.add('drop-target-inside');
        } else if(y <= h * 0.5) {
          DragManager.dropTargetId = nodeId; 
          DragManager.dropPosition = 'before';
          const ind = document.createElement('div'); 
          ind.className = 'drop-indicator drop-indicator-before'; 
          el.parentNode.insertBefore(ind, el);
        } else {
          DragManager.dropTargetId = nodeId; 
          DragManager.dropPosition = 'after';
          const ind = document.createElement('div'); 
          ind.className = 'drop-indicator drop-indicator-after'; 
          el.parentNode.insertBefore(ind, el.nextSibling);
        }
      });
      
      el.addEventListener('dragleave', (e) => { 
          if(!el.contains(e.relatedTarget)) el.classList.remove('drop-target-inside'); 
      });
      
      el.addEventListener('drop', (e) => {
        e.preventDefault(); 
        e.stopPropagation();
        if(DragManager.dropTargetId && DragManager.dropPosition) {
            DragManager.handleDrop(DragManager.dropTargetId, DragManager.dropPosition);
        }
      });
    },

    _html: (n) => {
      const kw = t => `<span class="keyword">${t}</span>`;
      const vr = id => { const v=VariableRegistry.get(id); return v ? `<span class="variable">${v.name}</span>` : `<span style="color:red">?</span>`; };
      const str = t => `<span class="string">"${t}"</span>`;
      const num = x => `<span class="number">${x}</span>`;
      const op = o => `<span class="operator">${o}</span>`;

      switch(n.type) {
        case 'function_def': {
          const argName = n.data.argVarId ? vr(n.data.argVarId) : '';
          return `${kw('def')} <span class="variable">${n.data.funcName}</span>(${argName}): {`;
        }
        case 'function_call': {
          const argName = n.data.argVarId ? vr(n.data.argVarId) : '';
          const target = n.data.targetVarId ? `${vr(n.data.targetVarId)} ${op('=')} ` : '';
          return `${target}<span class="variable">${n.data.funcName}</span>(${argName})`;
        }
        case 'assign': {
          const r = n.data.expression.type==='literal'
            ? (typeof n.data.expression.value==='string' ? str(n.data.expression.value) : num(n.data.expression.value))
            : vr(n.data.expression.varId);
          const actualOp = n.data.operator || '=';
          const displayOp = actualOp.replace('=', '') || '=';
          return `(${vr(n.data.targetVarId)}) ${op(displayOp)} ${r}`;
        }
        case 'read':
          return `${kw('Read')} (${vr(n.data.targetVarId)})`;
        case 'show': {
          const parts = (n.data.parts||[]).map(p => p.type==='text' ? str(p.value) : vr(p.varId)).join(' ');
          return `${kw('Print')} (${parts})`;
        }
        case 'if':
          return `${kw('si')} (${vr(n.data.condition.leftVarId)} ${op(n.data.condition.operator)} ${n.data.condition.rightType==='variable' ? vr(n.data.condition.rightVarId) : n.data.condition.rightValue}): {`;
        case 'while':
          return `${kw('mientras')} (${vr(n.data.condition.leftVarId)} ${op(n.data.condition.operator)} ${n.data.condition.rightValue}): {`;
        case 'loop':
          return `${kw('Loop')} {`;
        case 'break':
          return `${kw('break')}`;
        case 'for': {
          const iName = n.data.iterName || 'i';
          const iteratorDisplay = `<span class="variable">${iName}</span>`;
          if (n.data.subType === 'iterable') {
            return `${kw('Para')} (${iteratorDisplay}) ${kw('en')} (${vr(n.data.iterableVarId)}) {`;
          } else {
            return `${kw('Para')} (${iteratorDisplay}) ${kw('en')} ${kw('Rango')}[${num(n.data.end)}] {`;
          }
        }
        default: return 'Code';
      }
    }
  };

  /* 7. PANELES */
  const PanelManager = {
    init: function() {
      document.querySelectorAll('.floating-panel-header').forEach(h => h.addEventListener('mousedown', this.drag));
      document.querySelectorAll('.floating-panel-close').forEach(b => b.onclick = this.closeAll);
    },
    drag: function(e) {
      e.preventDefault();
      const target = this.parentElement.classList.contains('floating-panel') ? this.parentElement : this.closest('.context-menu-popup');
      if(!target) return;
      target.dataset.moved = "true";
      const offX = e.clientX - target.getBoundingClientRect().left;
      const offY = e.clientY - target.getBoundingClientRect().top;
      
      const mv = (ev) => { 
          target.style.left = (ev.clientX - offX) + 'px'; 
          target.style.top = (ev.clientY - offY) + 'px'; 
      };
      
      const up = () => { 
          document.removeEventListener('mousemove', mv); 
          document.removeEventListener('mouseup', up); 
      };
      
      document.addEventListener('mousemove', mv); 
      document.addEventListener('mouseup', up);
    },
    open: (id) => {
      document.querySelectorAll('.floating-panel').forEach(p => p.classList.remove('active'));
      const p = document.getElementById(id);
      
      if(p) {
        p.classList.add('active');
        if(p.dataset.moved !== "true") {
          const rect = p.getBoundingClientRect();
          p.style.left = (window.innerWidth/2 - rect.width/2)+'px'; 
          p.style.top = '150px';
        }
        if(id === 'panelFormShow') { FormManager.showParts = []; FormManager.renderPreview(); }
        if(id === 'panelFormFor') {
          const rangeRadio = p.querySelector('input[value="range"]');
          if(rangeRadio) { rangeRadio.checked = true; rangeRadio.dispatchEvent(new Event('change')); }
        }
        
        // --- AQUÍ ESTÁN LOS HOOKS (TIMBRES) AL VALIDADOR EXTERNO ---
        if(typeof window.Validador !== 'undefined') {
            if(id === 'panelFormAssign') window.Validador.enforceTypes('assign');
            if(id === 'panelFormIf') window.Validador.enforceTypes('if');
            if(id === 'panelFormWhile') window.Validador.enforceTypes('while');
        }
        
        const inp = p.querySelector('input[type="text"]:not([readonly]), input[type="number"], select'); 
        if(inp) setTimeout(()=>inp.focus(),50);
      }
      FormManager.updateAllSelects();
    },
    closeAll: () => document.querySelectorAll('.floating-panel').forEach(p => p.classList.remove('active')),
    renderVarsList: () => {
      const c = document.getElementById('varsListContainer');
      c.innerHTML = VariableRegistry.getAll().map(v => {
        let typeLabel = v.type;
        if(v.type === 'boolean') typeLabel = 'Bool';
        if(v.type === 'list') typeLabel = 'List';
        return `<div class="manage-item"><span><b>${v.name}</b> <small>(${typeLabel})</small></span><div class="manage-actions"><button onclick="VariableRegistry.delete('${v.id}')">×</button></div></div>`;
      }).join('') || '<div style="padding:10px;text-align:center;color:#ccc">Vacío</div>';
    },
    renderFuncsList: () => {
      const c = document.getElementById('funcsListContainer');
      c.innerHTML = FunctionRegistry.getAll().map(f =>
        `<div class="manage-item"><span>${f.name}()</span><div class="manage-actions"><button onclick="FunctionRegistry.delete('${f.id}')">×</button></div></div>`
      ).join('') || '<div style="padding:10px;text-align:center;color:#ccc">Vacío</div>';
    }
  };

  /* 8. CONTEXT MENU */
  const ContextMenuManager = {
    init: function() {
      const h = document.getElementById('dragMenuHandle');
      if(h) h.addEventListener('mousedown', PanelManager.drag);
    },
    show: (x, y, pid, insertAfterId = null) => {
      FormManager.targetId = pid;
      FormManager.insertAfterId = insertAfterId; 
      const m = document.getElementById('quickContextMenu');
      m.style.left = x+'px'; 
      m.style.top = y+'px'; 
      m.style.display = 'block';
      
      const noVars = !VariableRegistry.hasVars();
      ['open-assign', 'open-read'].forEach(act => {
        const el = m.querySelector(`[data-action="${act}"]`);
        if(el) el.classList.toggle('disabled', noVars);
      });

      const breakItem = m.querySelector('[data-action="open-break"]');
      if(breakItem) {
        const insideLoop = ContextMenuManager._isInsideLoop(pid);
        breakItem.style.display = insideLoop ? 'flex' : 'none';
      }
    },
    _isInsideLoop: (parentId) => {
      if(parentId === 'root') return false;
      const node = ASTManager.findNode(parentId);
      if(!node) return false;
      if(['loop','while','for'].includes(node.type)) return true;
      return ContextMenuManager._isInsideLoop(node.parentId);
    }
  };

  /* 9. FORM MANAGER */
  const FormManager = {
    targetId: 'root', 
    insertAfterId: null, 
    showParts: [],
    
    init: () => {
      document.getElementById('btnManageVars').onclick = () => PanelManager.open('panelManageVars');
      document.getElementById('btnManageFuncs').onclick = () => PanelManager.open('panelManageFuncs');
      
      document.getElementById('formAddVar').onsubmit = (e) => {
        e.preventDefault();
        const d = new FormData(e.target);
        const res = VariableRegistry.create(d.get('varName').trim(), d.get('varType'));
        if(!res.success) alert(res.error); else { 
            e.target.reset(); 
            FormManager.updateAllSelects(); 
        }
      };
      
      document.getElementById('formAddFunc').onsubmit = (e) => {
        e.preventDefault();
        const d = new FormData(e.target);
        const res = FunctionRegistry.create(d.get('funcName').trim());
        if(!res.success) alert(res.error); else e.target.reset();
      };

      document.getElementById('formDefFunc').onsubmit = (e) => {
        e.preventDefault();
        const d = new FormData(e.target);
        const fName = d.get('funcName').trim();
        if(fName) {
            FunctionRegistry.create(fName); 
            ASTManager.addNode('function_def', {
                funcName: fName,
                argVarId: d.get('argVarId') || null,
                returnVarId: d.get('returnVarId') || null
            }, FormManager.targetId, FormManager.insertAfterId);
        }
        PanelManager.closeAll();
        e.target.reset();
      };

      document.getElementById('formCallFunc').onsubmit = (e) => {
        e.preventDefault();
        const d = new FormData(e.target);
        const func = FunctionRegistry.get(d.get('funcId'));
        if(func) {
            ASTManager.addNode('function_call', {
                funcName: func.name,
                argVarId: d.get('argVarId') || null,
                targetVarId: d.get('targetVarId') || null
            }, FormManager.targetId, FormManager.insertAfterId);
        }
        PanelManager.closeAll();
        e.target.reset();
      };

      const addP = (p) => { FormManager.showParts.push(p); FormManager.renderPreview(); };
      
      document.getElementById('btnAddText').onclick = () => {
        const i=document.getElementById('builderTextInput');
        if(i.value){ addP({type:'text',value:i.value}); i.value=''; }
      };
      
      document.getElementById('btnAddVar').onclick = () => {
        const s=document.getElementById('builderVarSelect');
        if(s.value){ addP({type:'variable',varId:s.value}); }
      };
      
      document.getElementById('btnResetMsg').onclick = () => { FormManager.showParts=[]; FormManager.renderPreview(); };
      document.getElementById('btnUndoPart').onclick = () => { FormManager.showParts.pop(); FormManager.renderPreview(); };
      
      document.getElementById('btnSaveShow').onclick = () => {
        if(FormManager.showParts.length===0) return alert("Vacío");
        ASTManager.addNode('show', {parts:[...FormManager.showParts]}, FormManager.targetId, FormManager.insertAfterId);
        PanelManager.closeAll();
      };

      const bind = (id, fn) => {
          document.getElementById(id).onsubmit = e => { 
              e.preventDefault(); 
              fn(new FormData(e.target)); 
              PanelManager.closeAll(); 
          };
      };

      bind('formAssign', d => {
        const ex = { type:d.get('valType'), valueType:VariableRegistry.get(d.get('targetVarId')).type };
        if(ex.type==='literal') {
           const raw = d.get('literalVal') || document.querySelector('#formAssign select[name*="Bool"]')?.value || document.querySelector('#formAssign input[name*="Num"]')?.value;
           
           if (ex.valueType === 'number') ex.value = Number(raw) || 0;
           else if (ex.valueType === 'boolean') ex.value = (raw === 'true' || raw === '1');
           else if (ex.valueType === 'list') ex.value = [];
           else ex.value = raw || "";
        }
        else ex.varId = d.get('sourceVarId');
        
        const op = d.get('operator') || '=';
        ASTManager.addNode('assign', {targetVarId:d.get('targetVarId'), operator: op, expression:ex}, FormManager.targetId, FormManager.insertAfterId);
      });

      bind('formRead', d => ASTManager.addNode('read', {targetVarId:d.get('targetVarId')}, FormManager.targetId, FormManager.insertAfterId));
      bind('formIf', d => FormManager.addCond('if', d));
      bind('formWhile', d => FormManager.addCond('while', d));
      bind('formFor', d => {
        const type = d.get('forType');
        const iName = d.get('iterName') || 'i';
        const data = { subType: type, iterName: iName };
        if(type === 'iterable') data.iterableVarId = d.get('iterableVarId');
        else { data.start = 0; data.end = Number(d.get('endVal')); }
        ASTManager.addNode('for', data, FormManager.targetId, FormManager.insertAfterId);
      });

      FormManager.setupToggles();
      
      // --- AQUÍ ESTÁ OTRO HOOK (TIMBRE) AL VALIDADOR EXTERNO ---
      if(typeof window.Validador !== 'undefined') window.Validador.init();
    },

    addCond: (t, d) => {
      const l=d.get('leftVarId'), target = VariableRegistry.get(l); 
      if(!target) return;
      
      let rv = d.get('rightVal') || d.get('rightValBool') || d.get('rightValNum');
      if (target.type === 'boolean') rv = (rv === 'true'); 
      else if (target.type === 'number') rv = Number(rv) || 0;
      
      ASTManager.addNode(t, {condition:{leftVarId:l, leftType:target.type, operator:d.get('operator'), rightType:'literal', rightValue:rv}}, FormManager.targetId, FormManager.insertAfterId);
    },

    renderPreview: () => {
      document.getElementById('msgBuilderPreview').innerHTML = FormManager.showParts.map(p =>
        p.type==='text'
          ? `<span class="msg-part msg-txt">${p.value}</span>`
          : `<span class="msg-part msg-var">${VariableRegistry.get(p.varId)?.name}</span>`
      ).join('') || '<span style="color:#ccc;font-size:12px">Vacío...</span>';
    },

    updateAllSelects: () => {
      const vars = VariableRegistry.getAll();
      const funcs = FunctionRegistry.getAll();
      
      document.querySelectorAll('.var-select').forEach(s => {
        const v = s.value; 
        s.innerHTML = '<option value="">-- Opcional / Elegir --</option>';
        vars.forEach(x => { 
            const o=document.createElement('option'); 
            o.value=x.id; 
            o.text=`${x.name}`; 
            s.appendChild(o); 
        });
        if(s.hasAttribute('required')) s.querySelector('option[value=""]')?.remove();
        if(vars.find(x=>x.id===v)) s.value = v;
        
        if(s.id === 'assignVarSelect' || s.id === 'builderVarSelect') {
          const msg = s.closest('.form-row').querySelector('.no-variables-msg');
          if(msg) msg.style.display = vars.length ? 'none' : 'block';
        }
      });

      document.querySelectorAll('.func-select').forEach(s => {
          const v = s.value; 
          s.innerHTML = '';
          funcs.forEach(f => { 
              const o = document.createElement('option'); 
              o.value = f.id; 
              o.text = f.name; 
              s.appendChild(o); 
          });
          if(funcs.find(x=>x.id===v)) s.value = v;
          const msg = s.closest('.form-row')?.querySelector('.no-functions-msg');
          if(msg) msg.style.display = funcs.length ? 'none' : 'block';
      });
      
      // --- AQUÍ ESTÁN LOS ÚLTIMOS HOOKS AL VALIDADOR EXTERNO ---
      if(typeof window.Validador !== 'undefined') {
          if(document.getElementById('panelFormAssign').classList.contains('active')) window.Validador.enforceTypes('assign');
          if(document.getElementById('panelFormIf').classList.contains('active')) window.Validador.enforceTypes('if');
          if(document.getElementById('panelFormWhile').classList.contains('active')) window.Validador.enforceTypes('while');
      }
    },

    setupToggles: () => {
      document.querySelectorAll('input[type=radio]').forEach(r => r.addEventListener('change', () => {
        if(r.name === 'valType') {
          document.getElementById('asnLitRow').style.display = r.value==='literal'?'block':'none';
          document.getElementById('asnVarRow').style.display = r.value==='variable'?'block':'none';
        }
        if(r.name === 'compareType') { // En el If
          const litInput = document.querySelector('#formIf input[name*="rightVal"], #formIf select[name*="rightVal"]');
          const varSelectRow = document.getElementById('ifRightVarRow');
          if (litInput && varSelectRow) {
             litInput.parentNode.style.display = r.value === 'value' ? 'block' : 'none';
             varSelectRow.style.display = r.value === 'variable' ? 'block' : 'none';
          }
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

  /* 10. TRANSPILER */
  const PythonTranspiler = {
    generate: () => {
      let c = "# CodeFlow v04.2\n\nimport random\n\n# --- VARIABLES ---\n";
      VariableRegistry.getAll().forEach(v => {
        let pyVal = v.value;
        if(v.type === 'string') pyVal = `"${v.value}"`;
        if(v.type === 'boolean') pyVal = v.value ? 'True' : 'False';
        if(v.type === 'list') pyVal = '[]';
        c += `${v.name} = ${pyVal}\n`;
      });
      
      c += "\n# --- MAIN Y FUNCIONES ---\n";
      return c + (ASTManager.root.children.length ? PythonTranspiler._visit(ASTManager.root.children, 0) : "pass");
    },
    _visit: (nodes, indent) => {
      let b = ""; const sp = "    ".repeat(indent);
      nodes.forEach(n => {
        if (n.type === 'empty') {
            b += `\n`;
        }
        else if(n.type === 'function_def') {
            const arg = n.data.argVarId ? VariableRegistry.get(n.data.argVarId).name : '';
            b += `${sp}def ${n.data.funcName}(${arg}):\n`;
            if (n.children.length) {
                b += PythonTranspiler._visit(n.children, indent+1);
            } else {
                b += `${sp}    pass\n`;
            }
            if (n.data.returnVarId) {
                b += `${sp}    return ${VariableRegistry.get(n.data.returnVarId).name}\n`;
            } else {
                b += `${sp}    return\n`;
            }
        }
        else if(n.type === 'function_call') {
            const arg = n.data.argVarId ? VariableRegistry.get(n.data.argVarId).name : '';
            if (n.data.targetVarId) {
                const target = VariableRegistry.get(n.data.targetVarId).name;
                b += `${sp}${target} = ${n.data.funcName}(${arg})\n`;
            } else {
                b += `${sp}${n.data.funcName}(${arg})\n`;
            }
        }
        else if(n.type==='assign') {
          let val = n.data.expression.value;
          if (n.data.expression.type==='literal') {
             if (typeof val === 'string' && n.data.expression.valueType === 'string') val = `"${val}"`;
             if (n.data.expression.valueType === 'boolean') val = val ? 'True' : 'False';
             if (n.data.expression.valueType === 'list') val = '[]';
          } else {
             val = VariableRegistry.get(n.data.expression.varId).name;
          }
          const op = n.data.operator || '=';
          b += `${sp}${VariableRegistry.get(n.data.targetVarId).name} ${op} ${val}\n`;
        }
        else if(n.type==='read') {
          b += `${sp}${VariableRegistry.get(n.data.targetVarId).name} = input(f"Ingresa {VariableRegistry.get(n.data.targetVarId).name}: ")\n`;
        }
        else if(n.type==='show') {
          let s = ""; n.data.parts.forEach(p => s += p.type==='text' ? p.value : `{${VariableRegistry.get(p.varId).name}}`);
          b += `${sp}print(f"${s}")\n`;
        }
        else if(n.type==='if' || n.type==='while') {
          const isIf = n.type === 'if';
          const pyKw = isIf ? 'if' : 'while';
          b += `${sp}${pyKw} ${VariableRegistry.get(n.data.condition.leftVarId).name} ${n.data.condition.operator} ${n.data.condition.rightValue}:\n`;
          b += n.children.length ? PythonTranspiler._visit(n.children, indent+1) : `${sp}    pass\n`;
        }
        else if(n.type==='loop') {
          b += `${sp}while True:\n`;
          b += n.children.length ? PythonTranspiler._visit(n.children, indent+1) : `${sp}    pass\n`;
        }
        else if(n.type==='break') {
          b += `${sp}break\n`;
        }
        else if(n.type==='for') {
          const i = n.data.iterName || 'i';
          if (n.data.subType === 'iterable') {
            const v = VariableRegistry.get(n.data.iterableVarId);
            b += `${sp}for ${i} in ${v ? v.name : '[]'}:\n`;
          } else {
            b += `${sp}for ${i} in range(${n.data.start || 0}, ${n.data.end}):\n`;
          }
          b += n.children.length ? PythonTranspiler._visit(n.children, indent+1) : `${sp}    pass\n`;
        }
      });
      return b;
    }
  };

  /* 11. STORAGE MANAGER */
  const StorageManager = {
    saveLocal: () => {
      localStorage.setItem('cf_v04', JSON.stringify({
        ast: ASTManager.root,
        vars: Array.from(VariableRegistry._vars.entries()),
        funcs: Array.from(FunctionRegistry._funcs.entries())
      }));
    },
    loadLocal: () => {
      try {
        const raw = localStorage.getItem('cf_v04');
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
        EditorRenderer.render(); 
        VariableRegistry.notifyChange(); 
        FunctionRegistry.notifyChange();
      } catch(e) {
        console.error("Data corrupta, reseteando...", e);
        ASTManager.reset();
      }
    }
  };

  /* INIT */
  PanelManager.init(); 
  FormManager.init(); 
  ContextMenuManager.init(); 
  StorageManager.loadLocal();

  document.getElementById('btnUndo').onclick = () => HistoryManager.undo();
  document.getElementById('btnRedo').onclick = () => HistoryManager.redo();
  document.getElementById('btnClear').onclick = () => { if(confirm("¿Reiniciar?")) ASTManager.reset(); };
  
  document.getElementById('btnTranspile').onclick = () => {
    document.getElementById('pythonCodeOutput').innerText = PythonTranspiler.generate();
    PanelManager.open('panelPythonCode');
  };
  
  document.getElementById('btnCopyPython').onclick = () => {
    navigator.clipboard.writeText(document.getElementById('pythonCodeOutput').innerText);
  };

  const btnMultiSelect = document.getElementById('btnMultiSelect');
  if(btnMultiSelect) {
      btnMultiSelect.classList.remove('active');
      btnMultiSelect.onclick = (e) => { e.preventDefault(); SelectionManager.toggleMode(); };
  }

  const btnDeleteSelected = document.getElementById('btnDeleteSelected');
  if(btnDeleteSelected) {
      btnDeleteSelected.onclick = (e) => { e.preventDefault(); SelectionManager.deleteSelected(); };
  }

  document.getElementById('quickContextMenu').addEventListener('click', e => {
    const it = e.target.closest('.context-menu-item');
    if(it && !it.classList.contains('disabled')) {
      document.getElementById('quickContextMenu').style.display = 'none';
      const actions = {
        'open-create-var': 'panelManageVars',
        'open-function': 'panelManageFuncs',
        'open-assign': 'panelFormAssign',
        'open-read': 'panelFormRead',
        'open-show': 'panelFormShow',
        'open-if': 'panelFormIf',
        'open-while': 'panelFormWhile',
        'open-for': 'panelFormFor',
        'open-def-func': 'panelFormDefFunc',
        'open-call-func': 'panelFormCallFunc'
      };
      
      if(actions[it.dataset.action]) {
        PanelManager.open(actions[it.dataset.action]);
      } else if(it.dataset.action === 'open-loop') {
        ASTManager.addNode('loop', {}, FormManager.targetId, FormManager.insertAfterId);
      } else if(it.dataset.action === 'open-break') {
        ASTManager.addNode('break', {}, FormManager.targetId, FormManager.insertAfterId);
      }
    }
  });

  document.addEventListener('click', e => {
    if(!e.target.closest('.plus-icon') && !e.target.closest('.down-btn') && !e.target.closest('.context-menu-popup')) {
      document.getElementById('quickContextMenu').style.display = 'none';
    }
  });

  window.VariableRegistry = VariableRegistry;
  window.FunctionRegistry = FunctionRegistry;
  window.ASTManager = ASTManager;
  window.ContextMenuManager = ContextMenuManager;
  window.SelectionManager = SelectionManager;

  console.log("CodeFlow v04.2 Ready — Core Modularizado con Hooks");
});