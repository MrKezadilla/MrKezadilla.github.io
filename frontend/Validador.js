/* ============================================
   CODEFLOW - VALIDADOR SEMÁNTICO (Módulo)
   - Prevención de Errores por Diseño (Poka-yoke)
   - Tipado dinámico en Formularios
   - Filtrado de variables compatibles
   - VERSIÓN ENDURECIDA: defensiva ante DOM ausente, sin innerHTML crudo con
     valores del usuario, listas claramente bloqueadas para literales.
============================================ */

(function(){

  window.Validador = {

    // Inicializa los "escuchadores" en los menús desplegables
    init: function() {
      const assignVarSelect = document.getElementById('assignVarSelect');
      if (assignVarSelect) assignVarSelect.addEventListener('change', () => this.enforceTypes('assign'));

      const ifVarSelect = document.querySelector('#formIf select[name="leftVarId"]');
      if (ifVarSelect) ifVarSelect.addEventListener('change', () => this.enforceTypes('if'));

      const whileVarSelect = document.querySelector('#formWhile select[name="leftVarId"]');
      if (whileVarSelect) whileVarSelect.addEventListener('change', () => this.enforceTypes('while'));

      console.log("Módulo Validador Semántico cargado correctamente.");
    },

    // Aplica las reglas semánticas dependiendo del contexto (assign, if, while)
    enforceTypes: function(context) {
      // Medida de seguridad: Verificar que el registro de variables ya exista
      if (typeof VariableRegistry === 'undefined') return;

      let leftVarId = null, litContainer = null, rightVarSelect = null, opSelect = null;

      try {
        if (context === 'assign') {
          const sel = document.getElementById('assignVarSelect');
          if (!sel) return;
          leftVarId = sel.value;
          litContainer = document.getElementById('asnLitRow');
          rightVarSelect = document.querySelector('#asnVarRow select[name="sourceVarId"]');
          opSelect = document.querySelector('#formAssign select[name="operator"]');

        } else if (context === 'if') {
          const sel = document.querySelector('#formIf select[name="leftVarId"]');
          if (!sel) return;
          leftVarId = sel.value;
          const inputEl = document.querySelector('#formIf input[name*="rightVal"], #formIf select[name*="rightVal"]');
          litContainer = inputEl ? inputEl.parentNode : null;
          rightVarSelect = document.querySelector('#ifRightVarRow select[name="rightVarId"]');
          opSelect = document.querySelector('#formIf select[name="operator"]');

        } else if (context === 'while') {
          const sel = document.querySelector('#formWhile select[name="leftVarId"]');
          if (!sel) return;
          leftVarId = sel.value;
          const inputEl = document.querySelector('#formWhile input[name*="rightVal"], #formWhile select[name*="rightVal"]');
          litContainer = inputEl ? inputEl.parentNode : null;
          opSelect = document.querySelector('#formWhile select[name="operator"]');
          rightVarSelect = null;
        }
      } catch (e) {
        console.warn("Validador: error accediendo al DOM:", e);
        return;
      }

      const targetVar = VariableRegistry.get(leftVarId);
      if (!targetVar) return;

      // ==========================================
      // REGLA 1: Filtrar el Dropdown de Variables (Type Matching)
      // ==========================================
      if (rightVarSelect) {
        const validVars = VariableRegistry.getAll().filter(v => v.type === targetVar.type && v.id !== leftVarId);
        rightVarSelect.innerHTML = '';
        if (validVars.length === 0) {
          const o = document.createElement('option');
          o.value = '';
          o.textContent = '-- Sin variables del mismo tipo --';
          rightVarSelect.appendChild(o);
        } else {
          validVars.forEach(v => {
            const o = document.createElement('option');
            o.value = v.id;
            o.textContent = v.name; // textContent es seguro contra XSS
            rightVarSelect.appendChild(o);
          });
        }
      }

      // ==========================================
      // REGLA 2: Modificar Input Literal Dinámicamente (con createElement seguro)
      // ==========================================
      if (litContainer && (context === 'assign' || context === 'if' || context === 'while')) {
        litContainer.innerHTML = ''; // Limpiar contenedor
        const inputName = context === 'assign' ? 'literalVal' : 'rightVal';

        if (targetVar.type === 'boolean') {
          const sel = document.createElement('select');
          sel.name = inputName + 'Bool';
          sel.className = 'form-select';
          ['true','false'].forEach(v => {
            const o = document.createElement('option');
            o.value = v;
            o.textContent = v === 'true' ? 'True' : 'False';
            sel.appendChild(o);
          });
          litContainer.appendChild(sel);
        } else if (targetVar.type === 'number') {
          const inp = document.createElement('input');
          inp.type = 'number';
          inp.name = inputName + 'Num';
          inp.className = 'form-input';
          inp.placeholder = '0';
          inp.step = 'any';
          litContainer.appendChild(inp);
        } else if (targetVar.type === 'list') {
          // FIX #25: las listas no se comparan con literales texto. Mostrar input bloqueado claro.
          const inp = document.createElement('input');
          inp.type = 'text';
          inp.name = inputName;
          inp.className = 'form-input';
          inp.placeholder = 'Las listas no se comparan con literales';
          inp.readOnly = true;
          inp.disabled = true;
          litContainer.appendChild(inp);
        } else {
          const inp = document.createElement('input');
          inp.type = 'text';
          inp.name = inputName;
          inp.className = 'form-input';
          inp.placeholder = 'Escribe el texto...';
          litContainer.appendChild(inp);
        }
      }

      // ==========================================
      // REGLA 3: Filtrado de Operadores Incompatibles (con createElement seguro)
      // ==========================================
      if (opSelect) {
        const setOptions = (pairs) => {
          opSelect.innerHTML = '';
          pairs.forEach(([val, label]) => {
            const o = document.createElement('option');
            o.value = val;
            o.textContent = label;
            opSelect.appendChild(o);
          });
        };

        if (context === 'if' || context === 'while') {
          if (targetVar.type === 'boolean' || targetVar.type === 'string' || targetVar.type === 'list') {
            setOptions([['==', '=='], ['!=', '!=']]);
          } else {
            setOptions([['==', '=='], ['!=', '!='], ['<', '<'], ['>', '>'], ['<=', '\u2264'], ['>=', '\u2265']]);
          }
        } else if (context === 'assign') {
          if (targetVar.type === 'number') {
            setOptions([['=', '='], ['+=', '+'], ['-=', '-'], ['*=', '*'], ['/=', '/'], ['%=', '%']]);
          } else if (targetVar.type === 'string') {
            setOptions([['=', '='], ['+=', '+']]);
          } else {
            setOptions([['=', '=']]);
          }
        }
      }
    }
  };
})();