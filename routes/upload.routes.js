import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import { Worker } from 'node:worker_threads';
import { uploadsDir } from '../config/uploads.js';

const router = Router();
const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const previewPage = (body) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Document preview</title><style>body{font:16px/1.6 system-ui,sans-serif;background:#f5f5f5;color:#222;margin:0}main{max-width:900px;margin:30px auto;padding:32px;background:white;border-radius:8px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}p{color:#555}h1{font-size:24px}h2{font-size:18px}</style></head><body><main>${body}</main></body></html>`;

export function extractWordPreview(filename) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../services/documentPreview.worker.js', import.meta.url), {
      workerData: filename, resourceLimits: { maxOldGenerationSizeMb: 128 },
    });
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      worker.terminate();
      if (error) reject(error); else resolve(value);
    };
    const timeout = setTimeout(() => finish(new Error('Document preview took too long.')), 15000);
    worker.once('message', (result) => finish(result.error ? new Error(result.error) : null, result.sections));
    worker.once('error', (error) => finish(error));
    worker.once('exit', (code) => { if (code !== 0) finish(new Error('Document preview could not be completed.')); });
  });
}

router.get('/:filename/preview', async (req, res) => {
  res.set({
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'self'; sandbox",
    'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store',
    'Content-Disposition': 'inline',
  });
  const { filename } = req.params;
  if (filename !== path.basename(filename) || filename.includes('\\') || !/^[\w-]+\.(docx?|pdf|png|jpe?g)$/i.test(filename)) {
    return res.status(400).send(previewPage('<h1>Invalid document</h1>'));
  }
  if (!/\.docx?$/i.test(filename)) return res.redirect(`/api/uploads/${encodeURIComponent(filename)}`);
  try {
    const filePath = path.join(uploadsDir, filename);
    const stat = await fs.stat(filePath);
    if (stat.size > 25 * 1024 * 1024) return res.status(413).send(previewPage('<h1>Preview unavailable</h1><p>Text preview supports Word documents up to 25 MB. The original file is still saved.</p>'));
    const sections = await extractWordPreview(filePath);
    return res.type('html').send(previewPage('<h1>Document text preview</h1><p>Text only: original page layout, images, and tracked-change markup are not shown.</p>' +
      (sections.length ? sections.map(([heading, text]) => `<section><h2>${escape(heading)}</h2><pre dir="auto">${escape(text)}</pre></section>`).join('') : '<p>No readable text was found in this document.</p>')));
  } catch (error) {
    return res.status(error.code === 'ENOENT' ? 404 : 422).send(previewPage('<h1>Preview unavailable</h1><p>' + (error.code === 'ENOENT' ? 'The uploaded file could not be found.' : 'The document could not be previewed. It may be damaged, password protected, or too complex to display.') + '</p>'));
  }
});

export default router;
