import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMultipartSubmission } from '../middlewares/parseMultipart.middleware.js';
import { restoreSubmissionFiles } from '../../client/src/utils/submissionFiles.js';

const file = (name) => ({ filename: name, originalname: name });
const parse = (data, files = {}) => {
  const req = { body: { formDataJson: JSON.stringify(data) }, files };
  let error;
  parseMultipartSubmission(req, {}, (err) => { error = err; });
  return { data: req.body.formData, error };
};

test('multiple pending documents map to the correct language and row', () => {
  const existing = { filename: 'old.pdf', path: '/api/uploads/old.pdf' };
  const result = parse({ documentUploads: [
    { englishFiles: [existing], englishNewFileCount: 2, arabicNewFileCount: 0 },
    { englishNewFileCount: 1, arabicNewFileCount: 1 },
  ] }, { documentUploadEnglish: [file('one.pdf'), file('two.docx'), file('three.doc')], documentUploadArabic: [file('arabic.pdf')] });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.data.documentUploads[0].englishFiles.map((f) => f.filename), ['old.pdf', 'one.pdf', 'two.docx']);
  assert.deepEqual(result.data.documentUploads[1].englishFiles.map((f) => f.filename), ['three.doc']);
  assert.equal(result.data.documentUploads[1].arabicFiles[0].filename, 'arabic.pdf');
  assert.equal(result.data.documentUploads[0].englishNewFileCount, undefined);
});

test('legacy single-file flags still work', () => {
  const result = parse({ documentUploads: [{ englishHasNewFile: true }] }, { documentUploadEnglish: [file('legacy.pdf')] });
  assert.equal(result.data.documentUploads[0].englishFiles[0].filename, 'legacy.pdf');
  assert.equal(result.data.documentUploads[0].englishHasNewFile, undefined);
});

test('missing or unassigned file bytes fail rather than silently losing attachments', () => {
  assert.equal(parse({ documentUploads: [{ englishNewFileCount: 1 }] }).error.statusCode, 400);
  assert.equal(parse({ documentUploads: [] }, { documentUploadEnglish: [file('extra.pdf')] }).error.statusCode, 400);
  assert.equal(parse({ documentUploads: [{ englishNewFileCount: -1 }] }).error.statusCode, 400);
  assert.equal(parse(null).error.statusCode, 400);
});

test('restoring autosave removes unsaved placeholders and retains uploaded files', () => {
  const uploaded = { originalName: 'saved.pdf', path: '/api/uploads/saved.pdf' };
  const result = restoreSubmissionFiles({ informationSheetFiles: [{ _fileMeta: { name: 'lost.pdf' } }], documentUploads: [{ englishFiles: [uploaded, { _fileMeta: { name: 'lost.docx' } }] }] });
  assert.equal(result.missingFiles, true);
  assert.deepEqual(result.data.informationSheetFiles, []);
  assert.deepEqual(result.data.documentUploads[0].englishFiles, [uploaded]);
});
