// ============================================
//   CODEFLOW - BACKEND SERVER
//   Express server that receives an AST,
//   saves it as JSON, and transpiles to Python.
// ============================================

const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');

const transpiler = require('./transpiler');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Serve the frontend statically from ../frontend  (adjust if needed)
app.use(express.static(path.join(__dirname, 'frontend')));

// ── Helper: sanitize a filename ─────────────────────────────────────────────
function safeFilename(name = 'program') {
  return name.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 64) || 'program';
}

// ── POST /api/export/json ───────────────────────────────────────────────────
// Body: { ast: [...], filename?: "my_program" }
// Returns: JSON file download
app.post('/api/export/json', (req, res) => {
  const { ast, filename } = req.body;

  if (!ast || !Array.isArray(ast)) {
    return res.status(400).json({ error: 'Se requiere un campo "ast" de tipo array.' });
  }

  const name    = safeFilename(filename);
  const jsonStr = JSON.stringify(ast, null, 4);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${name}.json"`);
  res.send(jsonStr);
});

// ── POST /api/export/python ─────────────────────────────────────────────────
// Body: { ast: [...], filename?: "my_program" }
// Returns: .py file download
app.post('/api/export/python', (req, res) => {
  const { ast, filename, variables, functions } = req.body;

  if (!ast || !Array.isArray(ast)) {
    return res.status(400).json({ error: 'Se requiere un campo "ast" de tipo array.' });
  }

  let pythonCode;
  try {
    pythonCode = transpiler.transpile(ast, variables || [], functions || []);
  } catch (err) {
    console.error('Error durante la transpilación:', err);
    return res.status(500).json({ error: 'Error interno durante la transpilación.', detail: err.message });
  }

  const name = safeFilename(filename);

  res.setHeader('Content-Type', 'text/x-python');
  res.setHeader('Content-Disposition', `attachment; filename="${name}.py"`);
  res.send(pythonCode);
});

// ── POST /api/preview/python ────────────────────────────────────────────────
// Same as /export/python but returns plain JSON { code: "..." } for inline preview
app.post('/api/preview/python', (req, res) => {
  const { ast, variables, functions } = req.body;

  if (!ast || !Array.isArray(ast)) {
    return res.status(400).json({ error: 'Se requiere un campo "ast" de tipo array.' });
  }

  try {
    const code = transpiler.transpile(ast, variables || [], functions || []);
    return res.json({ code });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: '1.0.0' }));

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`CodeFlow backend running on http://localhost:${PORT}`);
});
