/* ============================================
   CODEFLOW - VALIDADOR SEMÁNTICO (Módulo)
   - Prevención de Errores por Diseño (Poka-yoke)
   - Tipado dinámico en Formularios
   - Filtrado de variables compatibles
============================================ */

window.Validador = {
    
    // Inicializa los "escuchadores" en los menús desplegables
    init: function() {
        const assignVarSelect = document.getElementById('assignVarSelect');
        if (assignVarSelect) {
            assignVarSelect.addEventListener('change', () => this.enforceTypes('assign'));
        }

        const ifVarSelect = document.querySelector('#formIf select[name="leftVarId"]');
        if (ifVarSelect) {
            ifVarSelect.addEventListener('change', () => this.enforceTypes('if'));
        }

        const whileVarSelect = document.querySelector('#formWhile select[name="leftVarId"]');
        if (whileVarSelect) {
            whileVarSelect.addEventListener('change', () => this.enforceTypes('while'));
        }
        
        console.log("Módulo Validador Semántico cargado correctamente.");
    },

    // Aplica las reglas semánticas dependiendo del contexto (assign, if, while)
    enforceTypes: function(context) {
        // Medida de seguridad: Verificar que el registro de variables ya exista
        if (typeof VariableRegistry === 'undefined') return;

        let leftVarId, litContainer, rightVarSelect, opSelect;
        
        if (context === 'assign') {
            leftVarId = document.getElementById('assignVarSelect').value;
            litContainer = document.getElementById('asnLitRow');
            rightVarSelect = document.querySelector('#asnVarRow select[name="sourceVarId"]');
            opSelect = document.querySelector('#formAssign select[name="operator"]');
            
        } else if (context === 'if') {
            leftVarId = document.querySelector('#formIf select[name="leftVarId"]').value;
            // Buscar el contenedor del input literal (puede ser input o select dependiendo del tipo)
            const inputEl = document.querySelector('#formIf input[name*="rightVal"], #formIf select[name*="rightVal"]');
            litContainer = inputEl ? inputEl.parentNode : null;
            rightVarSelect = document.querySelector('#ifRightVarRow select[name="rightVarId"]');
            opSelect = document.querySelector('#formIf select[name="operator"]');
            
        } else if (context === 'while') {
            leftVarId = document.querySelector('#formWhile select[name="leftVarId"]').value;
            const inputEl = document.querySelector('#formWhile input[name*="rightVal"], #formWhile select[name*="rightVal"]');
            litContainer = inputEl ? inputEl.parentNode : null;
            opSelect = document.querySelector('#formWhile select[name="operator"]');
            rightVarSelect = null; 
        }

        const targetVar = VariableRegistry.get(leftVarId);
        if (!targetVar) return;

        // ==========================================
        // REGLA 1: Filtrar el Dropdown de Variables (Type Matching)
        // Solo puedes igualar/asignar a una variable que sea del mismo tipo
        // ==========================================
        if (rightVarSelect) {
            const validVars = VariableRegistry.getAll().filter(v => v.type === targetVar.type && v.id !== leftVarId);
            rightVarSelect.innerHTML = validVars.length ? '' : '<option value="">-- Sin variables del mismo tipo --</option>';
            validVars.forEach(v => {
                const o = document.createElement('option'); 
                o.value = v.id; 
                o.text = v.name;
                rightVarSelect.appendChild(o);
            });
        }

        // ==========================================
        // REGLA 2: Modificar Input Literal Dinámicamente
        // ==========================================
        if (litContainer && (context === 'assign' || context === 'if' || context === 'while')) {
            litContainer.innerHTML = ''; // Limpiar contenedor
            const inputName = context === 'assign' ? 'literalVal' : 'rightVal';
            
            if (targetVar.type === 'boolean') {
                // Si es booleano, mostramos un selector True/False cerrado
                litContainer.innerHTML = `<select name="${inputName}Bool" class="form-select">
                                            <option value="true">True</option>
                                            <option value="false">False</option>
                                          </select>`;
            } else if (targetVar.type === 'number') {
                // Si es número, restringimos el teclado a números
                litContainer.innerHTML = `<input type="number" name="${inputName}Num" class="form-input" placeholder="0">`;
            } else if (targetVar.type === 'list') {
                // Las listas no se pueden sobreescribir desde el input literal básico (bloqueado)
                litContainer.innerHTML = `<input type="text" name="${inputName}" class="form-input" placeholder="Bloqueado para listas" readonly disabled>`;
            } else {
                // Texto normal
                litContainer.innerHTML = `<input type="text" name="${inputName}" class="form-input" placeholder="Escribe el texto...">`;
            }
        }

        // ==========================================
        // REGLA 3: Filtrado de Operadores Incompatibles
        // ==========================================
        if (opSelect) {
            if (context === 'if' || context === 'while') {
                // Booleanos y Textos no se pueden comparar con > o <
                const opsHTML = (targetVar.type === 'boolean' || targetVar.type === 'string' || targetVar.type === 'list')
                    ? `<option value="==">==</option><option value="!=">!=</option>`
                    : `<option value="==">==</option><option value="!=">!=</option><option value="<">&lt;</option><option value=">">&gt;</option><option value="<=">&le;</option><option value=">=">&ge;</option>`;
                opSelect.innerHTML = opsHTML;
            } else if (context === 'assign') {
                // Solo los números soportan operaciones matemáticas avanzadas
                const opsHTML = targetVar.type === 'number'
                    ? `<option value="=">=</option><option value="+=">+</option><option value="-=">-</option><option value="*=">*</option><option value="/=">/</option><option value="%=">%</option>`
                    : targetVar.type === 'string'
                        ? `<option value="=">=</option><option value="+=">+</option>` // Los strings solo se concatenan (+)
                        : `<option value="=">=</option>`; // Booleanos y Listas solo soportan asignación directa (=)
                opSelect.innerHTML = opsHTML;
            }
        }
    }
};