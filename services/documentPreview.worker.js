import { parentPort, workerData } from 'node:worker_threads';
import WordExtractor from 'word-extractor';

try {
  const document = await new WordExtractor().extract(workerData);
  parentPort.postMessage({ sections: [
    ['Headers', document.getHeaders({ includeFooters: false })],
    ['Document', document.getBody()], ['Text boxes', document.getTextboxes()],
    ['Footnotes', document.getFootnotes()], ['Endnotes', document.getEndnotes()],
    ['Comments', document.getAnnotations()], ['Footers', document.getFooters()],
  ].filter(([, text]) => text?.trim()) });
} catch {
  parentPort.postMessage({ error: 'This document could not be previewed. It may be damaged or password protected.' });
}
