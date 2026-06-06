/* ============================================
   CODEFLOW - API BRIDGE (Módulo)
   Conecta el frontend con el backend para:
   - Exportar el AST como JSON descargable
   - Exportar el AST transpilado como Python
   - Previsualizar el código Python generado

   INTEGRACIÓN:
     1. Carga este archivo DESPUÉS de app.js en tu index.html
     2. Ajusta API_BASE si el servidor corre en otro puerto
============================================ */

(function () {
  'use strict';

  const API_BASE = window.CODEFLOW_API || 'http://localhost:3000';

  // ── Recolectar variables desde VariableRegistry ────────────────────────
  function collectVariables() {
    if (typeof VariableRegistry !== 'undefined' && VariableRegistry.getAll) {
      return VariableRegistry.getAll();
    }
    return [];
  }

  // ── Recolectar funciones desde FunctionRegistry ──────────────────────────
  function collectFunctions() {
    if (typeof FunctionRegistry !== 'undefined' && FunctionRegistry.getAll) {
      return FunctionRegistry.getAll();
    }
    return [];
  }

  // ── Recolectar AST desde ASTExporter / ASTManager ──────────────────────
  function collectAST() {
    // Prefer the already-cleaned tree from ASTExporter
    if (typeof ASTExporter !== 'undefined') {
      try {
        const json = ASTExporter.generateJSON();
        return JSON.parse(json);
      } catch (e) {
        console.warn('ApiBridge: ASTExporter falló, intentando ASTManager directamente', e);
      }
    }
    // Fallback: raw children of root
    if (typeof ASTManager !== 'undefined' && ASTManager.root) {
      return ASTManager.root.children || [];
    }
    return [];
  }

  // ── Trigger a file download from a Blob ────────────────────────────────
  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ── POST helper ────────────────────────────────────────────────────────
  async function postJSON(endpoint, body) {
    const resp = await fetch(`${API_BASE}${endpoint}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });

    if (!resp.ok) {
      let detail = '';
      try { detail = (await resp.json()).error; } catch (_) {}
      throw new Error(`HTTP ${resp.status}: ${detail || resp.statusText}`);
    }
    return resp;
  }

  // ── Public API ─────────────────────────────────────────────────────────
  window.ApiBridge = {

    /**
     * Descarga el AST actual como archivo .json
     * @param {string} [filename='program'] - nombre base del archivo
     */
    exportJSON: async function (filename = 'program') {
      const ast = collectAST();
      if (!ast.length) { alert('El programa está vacío. Agrega nodos antes de exportar.'); return; }

      try {
        const resp = await postJSON('/api/export/json', { ast, filename });
        const blob = await resp.blob();
        triggerDownload(blob, `${filename}.json`);
      } catch (err) {
        console.error('ApiBridge.exportJSON:', err);
        alert('Error al exportar JSON: ' + err.message);
      }
    },

    /**
     * Descarga el AST transpilado como archivo .py
     * @param {string} [filename='program'] - nombre base del archivo
     */
    exportPython: async function (filename = 'program') {
      const ast       = collectAST();
      const variables = collectVariables();
      const functions = collectFunctions();
      if (!ast.length) { alert('El programa está vacío. Agrega nodos antes de exportar.'); return; }

      try {
        const resp = await postJSON('/api/export/python', { ast, variables, functions, filename });
        const blob = await resp.blob();
        triggerDownload(blob, `${filename}.py`);
      } catch (err) {
        console.error('ApiBridge.exportPython:', err);
        alert('Error al exportar Python: ' + err.message);
      }
    },

    /**
     * Solicita una previsualización del código Python sin descargar.
     * Devuelve el string de código (útil para mostrar en un modal).
     * @returns {Promise<string>}
     */
    previewPython: async function () {
      const ast       = collectAST();
      const variables = collectVariables();
      const functions = collectFunctions();
      if (!ast.length) return '# El programa está vacío.';

      try {
        const resp = await postJSON('/api/preview/python', { ast, variables, functions });
        const data = await resp.json();
        return data.code || '# (sin código)';
      } catch (err) {
        console.error('ApiBridge.previewPython:', err);
        return `# Error: ${err.message}`;
      }
    },

    /**
     * Muestra la previsualización Python en un modal simple.
     * Llama internamente a previewPython().
     */
    showPreviewModal: async function () {
      const code = await this.previewPython();
      _showModal(code);
    },
  };

  // ── Minimal preview modal (no framework needed) ────────────────────────
  function _showModal(code) {
    // Remove any existing modal
    const old = document.getElementById('codeflow-preview-modal');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'codeflow-preview-modal';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', background: 'rgba(0,0,0,.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '9999', fontFamily: 'sans-serif',
    });

    const box = document.createElement('div');
    Object.assign(box.style, {
      background: '#1e1e2e', color: '#cdd6f4', borderRadius: '10px',
      padding: '24px', width: '700px', maxWidth: '95vw',
      maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: '12px',
    });

    const title = document.createElement('h3');
    title.textContent = '🐍 Previsualización — Python';
    Object.assign(title.style, { margin: '0', fontSize: '1.1rem', color: '#89b4fa' });

    const pre = document.createElement('pre');
    pre.textContent = code;     // textContent — safe against XSS
    Object.assign(pre.style, {
      background: '#181825', borderRadius: '6px', padding: '16px',
      overflowY: 'auto', flexGrow: '1', fontSize: '0.875rem',
      lineHeight: '1.55', margin: '0', whiteSpace: 'pre-wrap',
    });

    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, { display: 'flex', gap: '10px', justifyContent: 'flex-end' });

    const btnCopy = document.createElement('button');
    btnCopy.textContent = '📋 Copiar';
    _styleBtn(btnCopy, '#313244');
    btnCopy.onclick = () => {
      navigator.clipboard.writeText(code).then(() => { btnCopy.textContent = '✅ Copiado!'; });
    };

    const btnDl = document.createElement('button');
    btnDl.textContent = '⬇ Descargar .py';
    _styleBtn(btnDl, '#89b4fa', '#1e1e2e');
    btnDl.onclick = () => window.ApiBridge.exportPython();

    const btnClose = document.createElement('button');
    btnClose.textContent = '✕ Cerrar';
    _styleBtn(btnClose, '#f38ba8', '#1e1e2e');
    btnClose.onclick = () => overlay.remove();

    btnRow.append(btnCopy, btnDl, btnClose);
    box.append(title, pre, btnRow);
    overlay.appendChild(box);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  function _styleBtn(el, bg, color = '#cdd6f4') {
    Object.assign(el.style, {
      background: bg, color, border: 'none', borderRadius: '6px',
      padding: '8px 16px', cursor: 'pointer', fontSize: '0.875rem',
    });
  }

  console.log('Módulo ApiBridge cargado correctamente.');
})();
