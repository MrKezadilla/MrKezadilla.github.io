/* ============================================
   CODEFLOW v04.6 - CORE
   - Transpilador removido (Pausa para Fase 4)
   - CORRECCIÓN 1: Flecha abajo (↓) en bloques inserta ADENTRO al inicio.
   - CORRECCIÓN 2: Botones invisibles estructurados para evitar saltos visuales.
============================================ */

document.addEventListener('DOMContentLoaded', function() {

  /* 0. UTILS */
  const PYTHON_KEYWORDS = new Set([
    'False','None','True','and','as','assert','async','await','break','class',
    'continue','def','del','elif','else','except','finally','for','from','global',
    'if','import','in','is','lambda','nonlocal','not','or','pass','raise','return',
    'try','while','with','yield','print','input','range','len','list','dict','set',
    'tuple','str','int','float','bool','type','open','exec','eval'
  ]);

  const _idCounter = { n: 0 };
  const Utils = {
    // FIX: contador monotónico evita cualquier colisión de IDs
    generateId: () => {
      _idCounter.n++;
      return 'node_' + Date.now().toString(36) + '_' + _idCounter.n.toString(36) + '_' + Math.random().toString(36).substr(2, 5);
    },
    clone: (obj) => {
      try { return structuredClone(obj); }
      catch (e) { return JSON.parse(JSON.stringify(obj)); }
    },
    // FIX #1, #2, #3, #12: escape HTML para evitar XSS en cualquier interpolación con innerHTML
    escapeHtml: (s) => {
      if (s === null || s === undefined) return '';
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },
    // FIX #16: rechazar keywords Python para evitar código Python roto
    isValidName: (n) => {
      if (typeof n !== 'string') return false;
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(n)) return false;
      if (PYTHON_KEYWORDS.has(n)) return false;
      return true;
    },
    // Útil para mensajes de error con razón explícita
    validateNameWithReason: (n) => {
      if (typeof n !== 'string' || !n.trim()) return "El nombre no puede estar vacío";
      const trimmed = n.trim();
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) return "Solo letras, números y _ (sin empezar con número)";
      if (PYTHON_KEYWORDS.has(trimmed)) return `'${trimmed}' es una palabra reservada de Python`;
      return null;
    },
    getDefaultVal: (type) => {
      if(type === 'number') return 0;
      if(type === 'boolean') return false;
      if(type === 'list') return [];
      return "";
    },
    // FIX #13, #14: parseo numérico seguro que distingue inválido de cero
    safeNumber: (raw, fallback = 0) => {
      if (raw === null || raw === undefined || raw === '') return fallback;
      const n = Number(raw);
      if (!Number.isFinite(n)) return fallback;
      return n;
    },
    safeInt: (raw, fallback = 0) => {
      const n = Utils.safeNumber(raw, fallback);
      return Math.trunc(n);
    }
  };

  /* 1. GESTOR DE HISTORIAL */
  const HistoryManager = {
    stack: [], pointer: -1, limit: 50,
    // FIX: el bug original era que saveState() se llama ANTES de mutar.
    // Esto guarda el "antes" pero nunca el "después", así que el redo no funcionaba.
    // Solución: cada saveState() primero actualiza el snapshot actual (el "después"
    // de la mutación previa), luego trunca cualquier futuro y empuja el estado
    // actual como nuevo punto de retorno.
    _snapshot: function() {
      return {
        ast: Utils.clone(ASTManager.root),
        vars: Utils.clone(Array.from(VariableRegistry._vars.entries())),
        funcs: Utils.clone(Array.from(FunctionRegistry._funcs.entries()))
      };
    },
    saveState: function() {
      // Si ya había estados, actualizar el "actual" con el resultado de la última mutación
      if (this.pointer >= 0 && this.pointer < this.stack.length) {
        this.stack[this.pointer] = this._snapshot();
      }
      // Truncar redos pendientes (cualquier futuro queda invalidado al hacer una nueva acción)
      if (this.pointer < this.stack.length - 1) {
        this.stack = this.stack.slice(0, this.pointer + 1);
      }
      // Push del estado actual como punto de retorno para esta mutación
      this.stack.push(this._snapshot());
      if (this.stack.length > this.limit) {
        this.stack.shift();
        this.pointer = this.stack.length - 1;
      } else {
        this.pointer++;
      }
      this.updateUI();
    },
    undo: function() {
      if(this.pointer > 0) {
        // Antes de retroceder, asegurar que el estado actual quedó capturado
        this.stack[this.pointer] = this._snapshot();
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
      // FIX #16, #20: validación robusta con mensaje claro
      const reason = Utils.validateNameWithReason(name);
      if (reason) return { success: false, error: reason };
      const trimmed = name.trim();
      if ([...this._vars.values()].some(v => v.name === trimmed)) return { success: false, error: "Ya existe una variable con ese nombre" };
      HistoryManager.saveState();
      const id = Utils.generateId();
      this._vars.set(id, { id, name: trimmed, type, value: Utils.getDefaultVal(type) });
      this.notifyChange();
      return { success: true, id };
    },
    delete: function(id) {
      if(!confirm("¿Eliminar variable? Se quitarán también las referencias en el código.")) return;
      HistoryManager.saveState();
      this._vars.delete(id);
      // FIX #11: limpieza referencial — purgar el AST de cualquier referencia huérfana
      ASTManager.purgeVarReferences(id);
      // FIX #29: limpiar selecciones huérfanas
      SelectionManager.pruneDeadIds();
      this.notifyChange();
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
      const reason = Utils.validateNameWithReason(name);
      if (reason) return { success: false, error: reason };
      const trimmed = name.trim();
      if ([...this._funcs.values()].some(f => f.name === trimmed)) return { success: false, error: "Ya existe una función con ese nombre" };
      HistoryManager.saveState();
      const id = Utils.generateId();
      this._funcs.set(id, { id, name: trimmed });
      this.notifyChange();
      return { success: true, id };
    },
    delete: function(id) {
      if(!confirm("¿Eliminar función? Se quitarán también las llamadas y la definición en el código.")) return;
      const func = this._funcs.get(id);
      const fname = func ? func.name : null;
      HistoryManager.saveState();
      this._funcs.delete(id);
      // FIX #11: limpieza referencial — quitar function_def y function_call asociados
      if (fname) ASTManager.purgeFuncReferences(fname);
      SelectionManager.pruneDeadIds();
      this.notifyChange();
    },
    get: (id) => FunctionRegistry._funcs.get(id),
    getAll: () => Array.from(FunctionRegistry._funcs.values()),
    notifyChange: () => {
        PanelManager.renderFuncsList();
        FormManager.updateAllSelects();
        EditorRenderer.render();
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
    // FIX #10: usar Set de visitados para evitar stack overflow si parentId formase un ciclo
    isAncestor: (ancestorId, nodeId, visited = null) => {
      if (!visited) visited = new Set();
      if (visited.has(nodeId)) return false; // ciclo detectado, abortar limpio
      visited.add(nodeId);
      const node = ASTManager.findNode(nodeId);
      if(!node) return false;
      if(node.parentId === ancestorId) return true;
      if(!node.parentId || node.parentId === 'root') return false;
      return ASTManager.isAncestor(ancestorId, node.parentId, visited);
    },
    // FIX #9: comprobar si un nodo (o cualquiera de sus descendientes) es un break
    containsBreak: (node) => {
      if (!node) return false;
      if (node.type === 'break') return true;
      if (!node.children) return false;
      return node.children.some(c => ASTManager.containsBreak(c));
    },
    isInsideLoopByParentId: (parentId) => {
      if (!parentId || parentId === 'root') return false;
      const node = ASTManager.findNode(parentId);
      if (!node) return false;
      if (['loop','while','for'].includes(node.type)) return true;
      return ASTManager.isInsideLoopByParentId(node.parentId);
    },
    // FIX #11: recorrer el AST y eliminar/limpiar referencias a una variable borrada
    purgeVarReferences: (varId) => {
      const walk = (node) => {
        if (!node) return;
        if (node.children && Array.isArray(node.children)) {
          // Filtrar nodos que quedarían rotos sin esta variable
          node.children = node.children.filter(child => {
            if (!child || !child.data) return true;
            // Nodos que dependen totalmente de la variable: borrarlos
            if (child.type === 'assign' && child.data.targetVarId === varId) return false;
            if (child.type === 'read' && child.data.targetVarId === varId) return false;
            if (child.type === 'if' || child.type === 'while') {
              if (child.data.condition && child.data.condition.leftVarId === varId) return false;
            }
            if (child.type === 'for' && child.data.iterableVarId === varId) return false;
            return true;
          });
          // Para los que sobreviven, limpiar referencias secundarias
          node.children.forEach(child => {
            if (!child || !child.data) return;
            // assign con expresión que referencia la variable borrada → cambiar a literal por defecto
            if (child.type === 'assign' && child.data.expression && child.data.expression.varId === varId) {
              const targetVar = VariableRegistry._vars.get(child.data.targetVarId);
              const valueType = targetVar ? targetVar.type : 'string';
              child.data.expression = { type: 'literal', valueType, value: Utils.getDefaultVal(valueType) };
            }
            // condition con rightVarId → cambiar a literal
            if ((child.type === 'if' || child.type === 'while') && child.data.condition && child.data.condition.rightVarId === varId) {
              child.data.condition.rightType = 'literal';
              child.data.condition.rightValue = Utils.getDefaultVal(child.data.condition.leftType || 'string');
              delete child.data.condition.rightVarId;
            }
            // function_def / function_call con argVarId/returnVarId/targetVarId apuntando a la var
            if (child.type === 'function_def' || child.type === 'function_call') {
              if (child.data.argVarId === varId) child.data.argVarId = null;
              if (child.data.returnVarId === varId) child.data.returnVarId = null;
              if (child.data.targetVarId === varId) child.data.targetVarId = null;
            }
            // show: filtrar parts variable que apunten a la var borrada
            if (child.type === 'show' && Array.isArray(child.data.parts)) {
              child.data.parts = child.data.parts.filter(p => !(p.type === 'variable' && p.varId === varId));
            }
            walk(child);
          });
        }
      };
      walk(ASTManager.root);
    },
    // FIX #11: limpiar function_def y function_call cuando se borra la función del registro
    purgeFuncReferences: (funcName) => {
      const walk = (node) => {
        if (!node) return;
        if (node.children && Array.isArray(node.children)) {
          node.children = node.children.filter(child => {
            if (!child || !child.data) return true;
            if ((child.type === 'function_def' || child.type === 'function_call') && child.data.funcName === funcName) return false;
            return true;
          });
          node.children.forEach(walk);
        }
      };
      walk(ASTManager.root);
    },
    addNode: (type, data, parentId = 'root', insertAfter = null, replaceNodeId = null) => {
      const parent = ASTManager.findNode(parentId);
      if(!parent || !Array.isArray(parent.children)) return;

      HistoryManager.saveState();
      const hasChildren = ['if','while','for','loop','function_def'].includes(type);
      const node = { id: Utils.generateId(), type, parentId, data, children: hasChildren ? [] : null };

      if (replaceNodeId) {
          const idx = parent.children.findIndex(c => c.id === replaceNodeId);
          if (idx !== -1) parent.children.splice(idx, 1, node);
          else parent.children.push(node);
      } else if (insertAfter === 'START') {
          parent.children.unshift(node);
      } else if (insertAfter) {
          const idx = parent.children.findIndex(c => c.id === insertAfter);
          if(idx !== -1) parent.children.splice(idx + 1, 0, node);
          else parent.children.push(node);
      } else {
          parent.children.push(node);
      }

      EditorRenderer.render();
      StorageManager.saveLocal();
    },
    updateNode: (id, newData) => {
      const node = ASTManager.findNode(id);
      if(!node) return;
      HistoryManager.saveState();
      node.data = newData;
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
        SelectionManager.pruneDeadIds();
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
    },
    // FIX #29: limpiar IDs que ya no existen en el AST (tras borrados o purgas)
    pruneDeadIds: () => {
      const before = SelectionManager.selectedIds.size;
      SelectionManager.selectedIds.forEach(id => {
        if (!ASTManager.findNode(id)) SelectionManager.selectedIds.delete(id);
      });
      if (before !== SelectionManager.selectedIds.size) {
        const delBtn = document.getElementById('btnDeleteSelected');
        if(delBtn) delBtn.style.display = SelectionManager.selectedIds.size > 0 ? 'inline-block' : 'none';
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
      // FIX #9: si alguno de los nodos arrastrados contiene un break,
      // verificar que el destino siga estando dentro de un loop
      const targetParentId = position === 'inside' ? targetNodeId : (ASTManager.findParent(targetNodeId)?.id || 'root');
      const destinoEsLoopOEstaEnLoop = (() => {
        if (targetParentId === 'root') return false;
        const tn = ASTManager.findNode(targetParentId);
        if (tn && ['loop','while','for'].includes(tn.type)) return true;
        return ASTManager.isInsideLoopByParentId(targetParentId);
      })();
      for(let id of draggingIds) {
        const n = ASTManager.findNode(id);
        if (n && ASTManager.containsBreak(n) && !destinoEsLoopOEstaEnLoop) {
          alert("No se puede mover un 'break' (o un bloque que lo contiene) fuera de un loop.");
          DragManager.endDrag();
          return;
        }
      }
      HistoryManager.saveState();
      if(position === 'inside') {
        if(!targetNode.children) { DragManager.endDrag(); return; }
        draggingIds.forEach(id => {
          const node = ASTManager.findNode(id), oldParent = ASTManager.findParent(id);
          if(node && oldParent) { oldParent.children = oldParent.children.filter(n => n.id !== id); node.parentId = targetNodeId; targetNode.children.push(node); }
        });
      } else {
        const targetParent = ASTManager.findParent(targetNodeId);
        if(!targetParent) { DragManager.endDrag(); return; }
        const nodesToMove = [];
        draggingIds.forEach(id => {
          const node = ASTManager.findNode(id), oldParent = ASTManager.findParent(id);
          if(node && oldParent) { oldParent.children = oldParent.children.filter(n => n.id !== id); node.parentId = targetParent.id; nodesToMove.push(node); }
        });
        let targetIndex = targetParent.children.findIndex(c => c.id === targetNodeId);
        if(targetIndex === -1) targetIndex = targetParent.children.length;
        const insertIndex = position === 'after' ? targetIndex + 1 : targetIndex;
        targetParent.children.splice(insertIndex, 0, ...nodesToMove);
      }
      EditorRenderer.render(); StorageManager.saveLocal(); DragManager.endDrag();
    }
  };

  // FIX #26: si el drag se cancela (Escape, salir de la ventana), endDrag debe ejecutarse
  document.addEventListener('dragend', () => { if (DragManager.draggingIds.length) DragManager.endDrag(); });
  window.addEventListener('blur', () => { if (DragManager.draggingIds.length) DragManager.endDrag(); });

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
        // CORRECCIÓN 1: Si es un bloque, insertar adentro al principio
        if (n && n.children !== null && n.children !== undefined) {
            ASTManager.addNode('empty', {}, n.id, 'START');
        } else {
            const pid = n ? n.parentId : targetId;
            const insertAfterId = n ? n.id : null;
            ASTManager.addNode('empty', {}, pid, insertAfterId);
        }
      };

      let actionBtn;
      if (isPlaceholder || (n && n.type === 'empty')) {
          actionBtn = document.createElement('div');
          actionBtn.className = 'plus-icon';
          actionBtn.innerText = '+';
          actionBtn.onclick = (e) => {
            e.stopPropagation();
            const pid = n ? n.parentId : targetId;
            const replaceId = (n && n.type === 'empty') ? n.id : null;
            ContextMenuManager.show(e.clientX, e.clientY, pid, null, replaceId);
          };
      } else {
          actionBtn = document.createElement('div');
          actionBtn.className = 'edit-icon';
          actionBtn.innerText = '✎';
          actionBtn.onclick = (e) => {
            e.stopPropagation();
            ContextMenuManager.showEditMenu(e.clientX, e.clientY, n);
          };
      }

      const del = document.createElement('div');
      del.className = 'line-del-btn';
      del.innerText = '×';

      if(n) {
          del.onclick = (e) => { e.stopPropagation(); ASTManager.deleteNode(n.id); };
      } else {
          del.style.opacity = '0';
          del.style.pointerEvents = 'none';
      }

      el.append(dragHandle, num, content, downBtn, actionBtn, del);
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
          ContextMenuManager.show(e.clientX, e.clientY, 'root', null, null);
      };

      const del = document.createElement('div');
      del.className = 'line-del-btn';
      del.innerText = '×';
      del.style.opacity = '0';
      del.style.pointerEvents = 'none';

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

      const retVar = node.data && node.data.returnVarId ? VariableRegistry.get(node.data.returnVarId) : null;
      const retText = retVar ? ` <span class="variable">${Utils.escapeHtml(retVar.name)}</span>` : '';
      content.innerHTML = `<span class="keyword">return</span>${retText}`;

      const dragHandle = document.createElement('div');
      dragHandle.className = 'drag-handle';
      dragHandle.style.visibility = 'hidden';

      const downBtn = document.createElement('div');
      downBtn.className = 'down-btn';
      downBtn.innerText = '↓';
      downBtn.style.opacity = '0';
      downBtn.style.pointerEvents = 'none';

      const plus = document.createElement('div');
      plus.className = 'plus-icon';
      plus.innerText = '+';
      plus.style.opacity = '0';
      plus.style.pointerEvents = 'none';

      const del = document.createElement('div');
      del.className = 'line-del-btn';
      del.innerText = '×';
      del.style.opacity = '0';
      del.style.pointerEvents = 'none';

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
          ContextMenuManager.show(e.clientX, e.clientY, node.parentId, node.id, null);
      };

      const del = document.createElement('div');
      del.className = 'line-del-btn';
      del.innerText = '×';
      del.style.opacity = '0';
      del.style.pointerEvents = 'none';

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
      // FIX #1, #2, #3, #5, #12: escape HTML aplicado a TODO valor que va a innerHTML
      // FIX #5: null-guards para nodos con data corrupta (e.g. localStorage manipulado)
      if (!n || !n.data) return '<span style="color:red">// Nodo corrupto</span>';
      const esc = Utils.escapeHtml;
      const kw = t => `<span class="keyword">${esc(t)}</span>`;
      const vr = id => { const v=VariableRegistry.get(id); return v ? `<span class="variable">${esc(v.name)}</span>` : `<span style="color:red">?</span>`; };
      const str = t => `<span class="string">"${esc(t)}"</span>`;
      const num = x => `<span class="number">${esc(x)}</span>`;
      const op = o => `<span class="operator">${esc(o)}</span>`;
      const lit = (val, displayType) => {
        if (typeof val === 'boolean') return `<span class="boolean">${val ? 'True' : 'False'}</span>`;
        if (displayType === 'string' || typeof val === 'string') return str(val);
        return num(val);
      };

      try {
        switch(n.type) {
          case 'function_def': {
            const argName = n.data.argVarId ? vr(n.data.argVarId) : '';
            const fname = n.data.funcName ? esc(n.data.funcName) : '<span style="color:red">?</span>';
            return `${kw('def')} <span class="variable">${fname}</span>(${argName}): {`;
          }
          case 'function_call': {
            const argName = n.data.argVarId ? vr(n.data.argVarId) : '';
            const target = n.data.targetVarId ? `${vr(n.data.targetVarId)} ${op('=')} ` : '';
            const fname = n.data.funcName ? esc(n.data.funcName) : '<span style="color:red">?</span>';
            return `${target}<span class="variable">${fname}</span>(${argName})`;
          }
          case 'assign': {
            if (!n.data.expression) return '<span style="color:red">// Asignación incompleta</span>';
            const r = n.data.expression.type==='literal'
              ? lit(n.data.expression.value, n.data.expression.valueType)
              : vr(n.data.expression.varId);
            const actualOp = n.data.operator || '=';
            const displayOp = actualOp.replace('=', '') || '=';
            return `(${vr(n.data.targetVarId)}) ${op(displayOp)} ${r}`;
          }
          case 'read':
            return `${kw('Read')} (${vr(n.data.targetVarId)})`;
          case 'show': {
            const parts = (n.data.parts||[]).map(p => p && p.type==='text' ? str(p.value) : vr(p && p.varId)).join(' ');
            return `${kw('Print')} (${parts})`;
          }
          case 'if': {
            if (!n.data.condition) return '<span style="color:red">// Si incompleto</span>';
            const c = n.data.condition;
            const right = c.rightType==='variable' ? vr(c.rightVarId) : (typeof c.rightValue === 'boolean' ? `<span class="boolean">${c.rightValue ? 'True' : 'False'}</span>` : (typeof c.rightValue === 'string' ? str(c.rightValue) : num(c.rightValue)));
            return `${kw('si')} (${vr(c.leftVarId)} ${op(c.operator)} ${right}): {`;
          }
          case 'while': {
            if (!n.data.condition) return '<span style="color:red">// Mientras incompleto</span>';
            const c = n.data.condition;
            const right = typeof c.rightValue === 'boolean' ? `<span class="boolean">${c.rightValue ? 'True' : 'False'}</span>` : (typeof c.rightValue === 'string' ? str(c.rightValue) : num(c.rightValue));
            return `${kw('mientras')} (${vr(c.leftVarId)} ${op(c.operator)} ${right}): {`;
          }
          case 'loop':
            return `${kw('Loop')} {`;
          case 'break':
            return `${kw('break')}`;
          case 'for': {
            const iName = n.data.iterName || 'i';
            const iteratorDisplay = `<span class="variable">${esc(iName)}</span>`;
            if (n.data.subType === 'iterable') {
              return `${kw('Para')} (${iteratorDisplay}) ${kw('en')} (${vr(n.data.iterableVarId)}) {`;
            } else {
              const endVal = (n.data.end === null || n.data.end === undefined) ? '?' : n.data.end;
              return `${kw('Para')} (${iteratorDisplay}) ${kw('en')} ${kw('Rango')}[${num(endVal)}] {`;
            }
          }
          default: return esc('// Instrucción desconocida');
        }
      } catch(e) {
        console.error("Error renderizando nodo", n, e);
        return '<span style="color:red">// Error de renderizado</span>';
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

        if(typeof window.Validador !== 'undefined') {
            if(id === 'panelFormAssign') window.Validador.enforceTypes('assign');
            if(id === 'panelFormIf') window.Validador.enforceTypes('if');
            if(id === 'panelFormWhile') window.Validador.enforceTypes('while');
        }
        const inp = p.querySelector('input[type="text"]:not([readonly]), input[type="number"], select'); if(inp) setTimeout(()=>inp.focus(),50);
      }
      FormManager.updateAllSelects();
    },
    closeAll: () => {
        // FIX #28: limpiar formularios y estado interno al cerrar
        document.querySelectorAll('.floating-panel.active form').forEach(f => { try { f.reset(); } catch(e){} });
        document.querySelectorAll('.floating-panel').forEach(p => p.classList.remove('active'));
        FormManager.editNodeId = null;
        FormManager.showParts = [];
    },
    renderVarsList: () => {
      const c = document.getElementById('varsListContainer');
      if (!c) return;
      // FIX #12: usar escape HTML y event listeners (no onclick inline) para nombres/IDs
      const vars = VariableRegistry.getAll();
      if (vars.length === 0) {
        c.innerHTML = '<div style="padding:10px;text-align:center;color:#ccc">Vacío</div>';
        return;
      }
      c.innerHTML = '';
      vars.forEach(v => {
        let typeLabel = v.type;
        if(v.type === 'boolean') typeLabel = 'Bool';
        if(v.type === 'list') typeLabel = 'List';
        const item = document.createElement('div');
        item.className = 'manage-item';
        item.innerHTML = `<span><b>${Utils.escapeHtml(v.name)}</b> <small>(${Utils.escapeHtml(typeLabel)})</small></span><div class="manage-actions"><button class="del-var-btn">×</button></div>`;
        const btn = item.querySelector('.del-var-btn');
        btn.addEventListener('click', () => VariableRegistry.delete(v.id));
        c.appendChild(item);
      });
    },
    renderFuncsList: () => {
      const c = document.getElementById('funcsListContainer');
      if (!c) return;
      const funcs = FunctionRegistry.getAll();
      if (funcs.length === 0) {
        c.innerHTML = '<div style="padding:10px;text-align:center;color:#ccc">Vacío</div>';
        return;
      }
      c.innerHTML = '';
      funcs.forEach(f => {
        const item = document.createElement('div');
        item.className = 'manage-item';
        item.innerHTML = `<span>${Utils.escapeHtml(f.name)}()</span><div class="manage-actions"><button class="del-func-btn">×</button></div>`;
        const btn = item.querySelector('.del-func-btn');
        btn.addEventListener('click', () => FunctionRegistry.delete(f.id));
        c.appendChild(item);
      });
    }
  };

  /* 8. CONTEXT MENU */
  const ContextMenuManager = {
    init: function() {
      const h = document.getElementById('dragMenuHandle');
      if(h) h.addEventListener('mousedown', PanelManager.drag);
    },
    show: (x, y, pid, insertAfterId = null, replaceNodeId = null) => {
      FormManager.targetId = pid;
      FormManager.insertAfterId = insertAfterId;
      FormManager.replaceNodeId = replaceNodeId;

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
    showEditMenu: (x, y, node) => {
      FormManager.activeNode = node;
      const m = document.getElementById('editContextMenu');
      m.style.left = x+'px'; m.style.top = y+'px'; m.style.display = 'block';
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
    replaceNodeId: null,
    editNodeId: null,
    activeNode: null,
    showParts: [],

    init: () => {
      // Helper: obtener un campo de FormData de manera segura (nunca crashea en .trim())
      const getStr = (d, key) => {
        const v = d.get(key);
        return (typeof v === 'string') ? v.trim() : '';
      };

      document.getElementById('btnManageVars').onclick = () => PanelManager.open('panelManageVars');
      document.getElementById('btnManageFuncs').onclick = () => PanelManager.open('panelManageFuncs');

      // FIX #20: .trim() seguro
      document.getElementById('formAddVar').onsubmit = (e) => {
        e.preventDefault();
        const d = new FormData(e.target);
        const res = VariableRegistry.create(getStr(d, 'varName'), d.get('varType'));
        if(!res.success) alert(res.error); else {
            e.target.reset();
            FormManager.updateAllSelects();
        }
      };

      document.getElementById('formAddFunc').onsubmit = (e) => {
        e.preventDefault();
        const d = new FormData(e.target);
        const res = FunctionRegistry.create(getStr(d, 'funcName'));
        if(!res.success) alert(res.error); else e.target.reset();
      };

      const saveFunctionDef = (fName, argId, retId) => {
          if (FormManager.editNodeId) {
             ASTManager.updateNode(FormManager.editNodeId, { funcName: fName, argVarId: argId, returnVarId: retId });
          } else {
             ASTManager.addNode('function_def', { funcName: fName, argVarId: argId, returnVarId: retId }, FormManager.targetId, FormManager.insertAfterId, FormManager.replaceNodeId);
          }
      };

      // FIX #7: validar que el nombre no exista o sea inválido ANTES de añadir el def al AST
      document.getElementById('formDefFunc').onsubmit = (e) => {
        e.preventDefault();
        const d = new FormData(e.target);
        const fName = getStr(d, 'funcName');
        if(!fName) { alert("Indica un nombre para la función"); return; }
        if (!FormManager.editNodeId) {
            const res = FunctionRegistry.create(fName);
            if (!res.success) {
                // Si ya existe, OK seguir; si es inválida, abortar
                if (res.error && !res.error.includes("Ya existe")) {
                    alert(res.error);
                    return;
                }
            }
        }
        saveFunctionDef(fName, d.get('argVarId') || null, d.get('returnVarId') || null);
        PanelManager.closeAll(); e.target.reset();
      };

      document.getElementById('formCallFunc').onsubmit = (e) => {
        e.preventDefault();
        const d = new FormData(e.target);
        const func = FunctionRegistry.get(d.get('funcId'));
        if(!func) { alert("Selecciona una función válida"); return; }
        const data = { funcName: func.name, argVarId: d.get('argVarId') || null, targetVarId: d.get('targetVarId') || null };
        if (FormManager.editNodeId) ASTManager.updateNode(FormManager.editNodeId, data);
        else ASTManager.addNode('function_call', data, FormManager.targetId, FormManager.insertAfterId, FormManager.replaceNodeId);
        PanelManager.closeAll(); e.target.reset();
      };

      const addP = (p) => { FormManager.showParts.push(p); FormManager.renderPreview(); };
      document.getElementById('btnAddText').onclick = () => { const i=document.getElementById('builderTextInput'); if(i.value){ addP({type:'text',value:i.value}); i.value=''; } };
      document.getElementById('btnAddVar').onclick = () => { const s=document.getElementById('builderVarSelect'); if(s.value){ addP({type:'variable',varId:s.value}); } };
      document.getElementById('btnResetMsg').onclick = () => { FormManager.showParts=[]; FormManager.renderPreview(); };
      document.getElementById('btnUndoPart').onclick = () => { FormManager.showParts.pop(); FormManager.renderPreview(); };

      document.getElementById('btnSaveShow').onclick = () => {
        if(FormManager.showParts.length===0) return alert("Vacío");
        const data = {parts:[...FormManager.showParts]};
        if (FormManager.editNodeId) ASTManager.updateNode(FormManager.editNodeId, data);
        else ASTManager.addNode('show', data, FormManager.targetId, FormManager.insertAfterId, FormManager.replaceNodeId);
        PanelManager.closeAll();
      };

      const bind = (id, fn) => {
          document.getElementById(id).onsubmit = e => {
              e.preventDefault(); fn(new FormData(e.target));
              PanelManager.closeAll();
          };
      };

      // FIX #4: null-check de la variable destino en formAssign
      // FIX #13, #14: parseo numérico seguro
      bind('formAssign', d => {
        const targetVar = VariableRegistry.get(d.get('targetVarId'));
        if (!targetVar) { alert("Selecciona una variable destino válida"); return; }
        const ex = { type: d.get('valType') || 'literal', valueType: targetVar.type };
        if(ex.type==='literal') {
           const raw = d.get('literalVal') || document.querySelector('#formAssign select[name*="Bool"]')?.value || document.querySelector('#formAssign input[name*="Num"]')?.value;
           if (ex.valueType === 'number') ex.value = Utils.safeNumber(raw, 0);
           else if (ex.valueType === 'boolean') ex.value = (raw === 'true' || raw === '1');
           else if (ex.valueType === 'list') ex.value = [];
           else ex.value = (raw === null || raw === undefined) ? "" : String(raw);
        } else {
           const sourceVar = VariableRegistry.get(d.get('sourceVarId'));
           if (!sourceVar) { alert("Selecciona una variable origen válida"); return; }
           ex.varId = d.get('sourceVarId');
        }

        const data = {targetVarId: d.get('targetVarId'), operator: d.get('operator') || '=', expression: ex};
        if (FormManager.editNodeId) ASTManager.updateNode(FormManager.editNodeId, data);
        else ASTManager.addNode('assign', data, FormManager.targetId, FormManager.insertAfterId, FormManager.replaceNodeId);
      });

      bind('formRead', d => {
          const targetVar = VariableRegistry.get(d.get('targetVarId'));
          if (!targetVar) { alert("Selecciona una variable válida para leer"); return; }
          const data = {targetVarId: d.get('targetVarId')};
          if (FormManager.editNodeId) ASTManager.updateNode(FormManager.editNodeId, data);
          else ASTManager.addNode('read', data, FormManager.targetId, FormManager.insertAfterId, FormManager.replaceNodeId);
      });
      bind('formIf', d => FormManager.addCond('if', d));
      bind('formWhile', d => FormManager.addCond('while', d));

      // FIX #14, #15, #17: iterName validado, end como entero seguro
      bind('formFor', d => {
        const type = d.get('forType') || 'range';
        let iName = getStr(d, 'iterName') || 'i';
        if (!Utils.isValidName(iName)) {
            alert(`El nombre del iterador '${iName}' no es válido. Usa solo letras, números y _ (sin keywords de Python).`);
            return;
        }
        const data = { subType: type, iterName: iName };
        if(type === 'iterable') {
            const iterVar = VariableRegistry.get(d.get('iterableVarId'));
            if (!iterVar) { alert("Selecciona una variable iterable válida"); return; }
            data.iterableVarId = d.get('iterableVarId');
        } else {
            data.start = 0;
            const end = Utils.safeInt(d.get('endVal'), 0);
            if (end < 0) { alert("El valor final del rango debe ser >= 0"); return; }
            data.end = end;
        }
        if (FormManager.editNodeId) ASTManager.updateNode(FormManager.editNodeId, data);
        else ASTManager.addNode('for', data, FormManager.targetId, FormManager.insertAfterId, FormManager.replaceNodeId);
      });

      FormManager.setupToggles();
      if(typeof window.Validador !== 'undefined') window.Validador.init();
    },

    // FIX #4, #13, #24: validar variable destino, parseo numérico seguro, mensaje claro si no hay variables
    addCond: (t, d) => {
      const l = d.get('leftVarId');
      const target = VariableRegistry.get(l);
      if(!target) {
          if (!VariableRegistry.hasVars()) alert("Crea al menos una variable antes de usar Si/Mientras");
          else alert("Selecciona una variable válida");
          return;
      }
      let rv = d.get('rightVal') || d.get('rightValBool') || d.get('rightValNum');
      if (target.type === 'boolean') rv = (rv === 'true');
      else if (target.type === 'number') rv = Utils.safeNumber(rv, 0);
      else if (rv === null || rv === undefined) rv = "";
      const data = {condition:{leftVarId:l, leftType:target.type, operator: d.get('operator') || '==', rightType:'literal', rightValue:rv}};
      if (FormManager.editNodeId) ASTManager.updateNode(FormManager.editNodeId, data);
      else ASTManager.addNode(t, data, FormManager.targetId, FormManager.insertAfterId, FormManager.replaceNodeId);
    },

    loadNodeForEdit: (node) => {
      FormManager.editNodeId = node.id;
      const d = node.data;

      const setVal = (sel, val) => { const el = document.querySelector(sel); if (el) el.value = val; };
      const setRadio = (name, val) => { const el = document.querySelector(`input[name="${name}"][value="${val}"]`); if (el) { el.checked = true; el.dispatchEvent(new Event('change')); } };

      switch(node.type) {
          case 'assign':
              PanelManager.open('panelFormAssign');
              setVal('#formAssign select[name="targetVarId"]', d.targetVarId);
              setVal('#formAssign select[name="operator"]', d.operator);
              setRadio('valType', d.expression.type);

              if (d.expression.type === 'literal') {
                  const targetSelect = document.getElementById('assignVarSelect');
                  targetSelect.value = d.targetVarId; targetSelect.dispatchEvent(new Event('change'));
                  setTimeout(() => {
                      setVal('#formAssign input[name="literalValNum"]', d.expression.value);
                      setVal('#formAssign select[name="literalValBool"]', d.expression.value);
                      setVal('#formAssign input[name="literalVal"]', d.expression.value);
                  }, 50);
              } else {
                  setVal('#formAssign select[name="sourceVarId"]', d.expression.varId);
              }
              break;
          case 'read':
              PanelManager.open('panelFormRead');
              setVal('#formRead select[name="targetVarId"]', d.targetVarId);
              break;
          case 'show':
              PanelManager.open('panelFormShow');
              FormManager.showParts = [...(d.parts || [])]; FormManager.renderPreview();
              break;
          case 'if':
          case 'while':
              PanelManager.open(node.type === 'if' ? 'panelFormIf' : 'panelFormWhile');
              const prefix = node.type === 'if' ? '#formIf' : '#formWhile';
              const leftSelect = document.querySelector(`${prefix} select[name="leftVarId"]`);
              if(leftSelect) { leftSelect.value = d.condition.leftVarId; leftSelect.dispatchEvent(new Event('change')); }
              setVal(`${prefix} select[name="operator"]`, d.condition.operator);
              setTimeout(() => {
                  setVal(`${prefix} input[name="rightValNum"]`, d.condition.rightValue);
                  setVal(`${prefix} select[name="rightValBool"]`, d.condition.rightValue);
                  setVal(`${prefix} input[name="rightVal"]`, d.condition.rightValue);
              }, 50);
              break;
          case 'for':
              PanelManager.open('panelFormFor');
              setRadio('forType', d.subType); setVal('#formFor input[name="iterName"]', d.iterName);
              if (d.subType === 'range') setVal('#formFor input[name="endVal"]', d.end);
              else setVal('#formFor select[name="iterableVarId"]', d.iterableVarId);
              break;
          case 'function_def':
              PanelManager.open('panelFormDefFunc');
              setVal('#formDefFunc input[name="funcName"]', d.funcName);
              setVal('#formDefFunc select[name="argVarId"]', d.argVarId || '');
              setVal('#formDefFunc select[name="returnVarId"]', d.returnVarId || '');
              break;
          case 'function_call':
              PanelManager.open('panelFormCallFunc');
              const func = FunctionRegistry.getAll().find(f => f.name === d.funcName);
              if (func) setVal('#formCallFunc select[name="funcId"]', func.id);
              setVal('#formCallFunc select[name="argVarId"]', d.argVarId || '');
              setVal('#formCallFunc select[name="targetVarId"]', d.targetVarId || '');
              break;
          default:
              alert('Esta instrucción no tiene parámetros para editar. Intenta la opción Reemplazar.');
              FormManager.editNodeId = null;
              break;
      }
    },

    updateAllSelects: () => {
      const vars = VariableRegistry.getAll(); const funcs = FunctionRegistry.getAll();
      document.querySelectorAll('.var-select').forEach(s => {
        const v = s.value; s.innerHTML = '<option value="">-- Opcional / Elegir --</option>';
        vars.forEach(x => { const o=document.createElement('option'); o.value=x.id; o.text=`${x.name}`; s.appendChild(o); });
        if(s.hasAttribute('required')) s.querySelector('option[value=""]')?.remove();
        if(vars.find(x=>x.id===v)) s.value = v;
        if(s.id === 'assignVarSelect' || s.id === 'builderVarSelect') { const msg = s.closest('.form-row').querySelector('.no-variables-msg'); if(msg) msg.style.display = vars.length ? 'none' : 'block'; }
      });
      document.querySelectorAll('.func-select').forEach(s => {
          const v = s.value; s.innerHTML = '';
          funcs.forEach(f => { const o = document.createElement('option'); o.value = f.id; o.text = f.name; s.appendChild(o); });
          if(funcs.find(x=>x.id===v)) s.value = v;
          const msg = s.closest('.form-row')?.querySelector('.no-functions-msg'); if(msg) msg.style.display = funcs.length ? 'none' : 'block';
      });
      if(typeof window.Validador !== 'undefined') {
          if(document.getElementById('panelFormAssign').classList.contains('active')) window.Validador.enforceTypes('assign');
          if(document.getElementById('panelFormIf').classList.contains('active')) window.Validador.enforceTypes('if');
          if(document.getElementById('panelFormWhile').classList.contains('active')) window.Validador.enforceTypes('while');
      }
    },

    setupToggles: () => {
      document.querySelectorAll('input[type=radio]').forEach(r => r.addEventListener('change', () => {
        if(r.name === 'valType') { document.getElementById('asnLitRow').style.display = r.value==='literal'?'block':'none'; document.getElementById('asnVarRow').style.display = r.value==='variable'?'block':'none'; }
        if(r.name === 'compareType') {
          const litInput = document.querySelector('#formIf input[name*="rightVal"], #formIf select[name*="rightVal"]'); const varSelectRow = document.getElementById('ifRightVarRow');
          if (litInput && varSelectRow) { litInput.parentNode.style.display = r.value === 'value' ? 'block' : 'none'; varSelectRow.style.display = r.value === 'variable' ? 'block' : 'none'; }
        }
        if(r.name === 'forType') {
          const isRange = r.value === 'range'; document.getElementById('forRangeRow').style.display = isRange ? 'flex' : 'none'; document.getElementById('forIterRow').style.display = isRange ? 'none' : 'block';
          const iterInput = document.querySelector('input[name="iterName"]');
          if(iterInput) {
            if (isRange) { iterInput.value = 'i'; iterInput.readOnly = true; iterInput.style.backgroundColor = '#f1f5f9'; iterInput.style.color = '#94a3b8'; }
            else { iterInput.readOnly = false; iterInput.value = ''; iterInput.placeholder = 'Ej: item'; iterInput.style.backgroundColor = '#ffffff'; iterInput.style.color = 'var(--color-text-primary)'; FormManager.updateAllSelects(); }
          }
        }
      }));
    }
  };

  /* 10. STORAGE MANAGER */
 /* 10. STORAGE MANAGER */
  const StorageManager = {
    KEY: 'cf_v04',
    BACKUP_KEY: 'cf_v04_backup',
    quotaWarned: false,
    saveLocal: () => {
      try {
        const payload = JSON.stringify({
          ast: ASTManager.root,
          vars: Array.from(VariableRegistry._vars.entries()),
          funcs: Array.from(FunctionRegistry._funcs.entries())
        });
        localStorage.setItem(StorageManager.KEY, payload);
      } catch(e) {
        if (!StorageManager.quotaWarned) {
          StorageManager.quotaWarned = true;
          console.error("CodeFlow: no se pudo guardar en localStorage:", e);
          alert("⚠️ No se pudo guardar el progreso. El almacenamiento del navegador está lleno o no disponible.");
        }
      }
    },
    _validateSchema: (s) => {
      if (!s || typeof s !== 'object') return false;
      if (!s.ast || typeof s.ast !== 'object' || !Array.isArray(s.ast.children)) return false;
      if (!Array.isArray(s.vars)) return false;
      if (!Array.isArray(s.funcs)) return false;
      for (const e of s.vars) {
        if (!Array.isArray(e) || e.length !== 2) return false;
        if (!e[1] || typeof e[1] !== 'object' || typeof e[1].name !== 'string' || typeof e[1].type !== 'string') return false;
      }
      for (const e of s.funcs) {
        if (!Array.isArray(e) || e.length !== 2) return false;
        if (!e[1] || typeof e[1] !== 'object' || typeof e[1].name !== 'string') return false;
      }
      return true;
    },
    _sanitizeAST: (node, isRoot = true) => {
      if (!node || typeof node !== 'object') return { id:'root', type:'program', children:[] };
      if (!node.id) node.id = 'root';
      if (!node.type) node.type = 'program';
      if (!isRoot && node.data === undefined) node.data = {};
      if (Array.isArray(node.children)) {
        node.children = node.children.filter(c => c && typeof c === 'object' && c.type);
        node.children.forEach(c => StorageManager._sanitizeAST(c, false));
      }
      return node;
    },
    loadLocal: () => {
      let raw;
      try { raw = localStorage.getItem(StorageManager.KEY); } catch(e) { raw = null; }
      if (!raw) {
        HistoryManager.saveState();
        EditorRenderer.render();
        return;
      }
      let s;
      try { s = JSON.parse(raw); }
      catch(e) {
        try { localStorage.setItem(StorageManager.BACKUP_KEY, raw); } catch(_){}
        ASTManager.reset();
        return;
      }
      if (!StorageManager._validateSchema(s)) {
        try { localStorage.setItem(StorageManager.BACKUP_KEY, raw); } catch(_){}
        try {
          ASTManager.root = (s && s.ast && Array.isArray(s.ast.children)) ? StorageManager._sanitizeAST(s.ast) : { id:'root', type:'program', children:[] };
          VariableRegistry._vars = (s && Array.isArray(s.vars)) ? new Map(s.vars.filter(e => Array.isArray(e) && e.length===2 && e[1] && e[1].name && e[1].type)) : new Map();
          FunctionRegistry._funcs = (s && Array.isArray(s.funcs)) ? new Map(s.funcs.filter(e => Array.isArray(e) && e.length===2 && e[1] && e[1].name)) : new Map();
        } catch(_) { ASTManager.reset(); return; }
        HistoryManager.saveState();
        EditorRenderer.render();
        VariableRegistry.notifyChange();
        FunctionRegistry.notifyChange();
        return;
      }
      try {
        ASTManager.root = StorageManager._sanitizeAST(s.ast);
        VariableRegistry._vars = new Map(s.vars);
        FunctionRegistry._funcs = new Map(s.funcs);
        HistoryManager.stack = [{ast: Utils.clone(ASTManager.root), vars: Utils.clone(s.vars), funcs: Utils.clone(s.funcs)}];
        HistoryManager.pointer = 0;
        EditorRenderer.render();
        VariableRegistry.notifyChange();
        FunctionRegistry.notifyChange();
      } catch(e) {
        try { localStorage.setItem(StorageManager.BACKUP_KEY, raw); } catch(_){}
        ASTManager.reset();
      }
    }
  };

  window.addEventListener('storage', (e) => {
    if (e.key === StorageManager.KEY && e.newValue) {
      try {
        const s = JSON.parse(e.newValue);
        if (StorageManager._validateSchema(s)) {
          ASTManager.root = StorageManager._sanitizeAST(s.ast);
          VariableRegistry._vars = new Map(s.vars);
          FunctionRegistry._funcs = new Map(s.funcs);
          EditorRenderer.render();
          PanelManager.renderVarsList();
          PanelManager.renderFuncsList();
          FormManager.updateAllSelects();
        }
      } catch(_){}
    }
  });

  /* INIT */
  PanelManager.init(); FormManager.init(); ContextMenuManager.init(); StorageManager.loadLocal();

  document.getElementById('btnUndo').onclick = () => HistoryManager.undo();
  document.getElementById('btnRedo').onclick = () => HistoryManager.redo();
  document.getElementById('btnClear').onclick = () => { if(confirm("¿Reiniciar?")) ASTManager.reset(); };

  // ==========================================
  // CONEXIÓN CON EL MÓDULO EXPORTADOR AST
  // ==========================================
  document.getElementById('btnTranspile').onclick = () => { 
      const title = document.querySelector('#panelPythonCode .floating-panel-title');
      if (title) title.textContent = 'AST / Tokens (JSON)';
      
      const output = document.getElementById('pythonCodeOutput');
      
      // Llamamos al archivo externo
      if (typeof window.ASTExporter !== 'undefined') {
          output.innerText = window.ASTExporter.generateJSON(); 
      } else {
          output.innerText = "// ERROR: El módulo ExportadorAST.js no ha sido cargado en el HTML.";
      }
      
      PanelManager.open('panelPythonCode'); 
  };
  
  const btnCopyPython = document.getElementById('btnCopyPython');
  if(btnCopyPython) { 
      btnCopyPython.onclick = () => {
          const code = document.getElementById('pythonCodeOutput').innerText;
          navigator.clipboard.writeText(code);
          alert("JSON copiado al portapapeles. ¡Listo para leerse en un Transpilador!");
      };
  }

  const btnMultiSelect = document.getElementById('btnMultiSelect');
  if(btnMultiSelect) { btnMultiSelect.onclick = (e) => { e.preventDefault(); SelectionManager.toggleMode(); }; }

  const btnDeleteSelected = document.getElementById('btnDeleteSelected');
  if(btnDeleteSelected) { btnDeleteSelected.onclick = (e) => { e.preventDefault(); SelectionManager.deleteSelected(); }; }

  document.addEventListener('click', e => {
    let it = e.target.closest('#quickContextMenu .context-menu-item');
    if(it && !it.classList.contains('disabled')) {
      document.getElementById('quickContextMenu').style.display = 'none';
      const actions = {
        'open-create-var': 'panelManageVars', 'open-function': 'panelManageFuncs', 'open-assign': 'panelFormAssign',
        'open-read': 'panelFormRead', 'open-show': 'panelFormShow', 'open-if': 'panelFormIf',
        'open-while': 'panelFormWhile', 'open-for': 'panelFormFor', 'open-def-func': 'panelFormDefFunc', 'open-call-func': 'panelFormCallFunc'
      };
      if(actions[it.dataset.action]) PanelManager.open(actions[it.dataset.action]);
      else if(it.dataset.action === 'open-loop') ASTManager.addNode('loop', {}, FormManager.targetId, FormManager.insertAfterId, FormManager.replaceNodeId);
      else if(it.dataset.action === 'open-break') ASTManager.addNode('break', {}, FormManager.targetId, FormManager.insertAfterId, FormManager.replaceNodeId);
    }
    
    let editIt = e.target.closest('#editContextMenu .context-menu-item');
    if(editIt && !editIt.classList.contains('disabled')) {
      document.getElementById('editContextMenu').style.display = 'none';
      if(editIt.dataset.action === 'edit-node') {
          FormManager.loadNodeForEdit(FormManager.activeNode);
      } else if(editIt.dataset.action === 'replace-node') {
          const n = FormManager.activeNode;
          ContextMenuManager.show(e.clientX, e.clientY, n.parentId, null, n.id);
      }
    }
    
    if(!e.target.closest('.plus-icon') && !e.target.closest('.down-btn') && !e.target.closest('.edit-icon') && !e.target.closest('.context-menu-popup')) {
      document.getElementById('quickContextMenu').style.display = 'none';
      const editMenu = document.getElementById('editContextMenu');
      if (editMenu) editMenu.style.display = 'none';
    }
  });

  window.VariableRegistry = VariableRegistry;
  window.FunctionRegistry = FunctionRegistry;
  window.ASTManager = ASTManager;
  window.Utils = Utils;
  window.StorageManager = StorageManager;
  window.DragManager = DragManager;
  window.EditorRenderer = EditorRenderer;
  window.HistoryManager = HistoryManager;
  window.SelectionManager = SelectionManager;

  console.log("CodeFlow v05.0 Ready — AST conectado a Exportador Externo");
});