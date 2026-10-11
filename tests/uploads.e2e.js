// Requires mongod and Playwright Chromium (or an installed Chrome).
// Runs the real client, API, and a disposable MongoDB instance; never uses .env data.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import mongoose from 'mongoose';
import User from '../models/User.model.js';
import Submission from '../models/Submission.model.js';
import Reviewer from '../models/Reviewer.model.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const client = fileURLToPath(new URL('../../client/', import.meta.url));
const temp = await fs.mkdtemp(path.join(root, 'node_modules', '.uploads-e2e-'));
const children = [];
let browser;
let logs = '';
const launch = (command, args, options = {}) => {
  const child = spawn(command, args, { windowsHide: true, ...options, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (data) => { if (!command.includes('mongod')) logs = (logs + data).slice(-8000); });
  child.stderr.on('data', (data) => { logs = (logs + data).slice(-8000); });
  child.on('error', (error) => { logs += error.message; });
  children.push(child);
  return child;
};
const waitFor = async (check) => {
  let last;
  for (let i = 0; i < 100; i++) {
    try { if (await check()) return; } catch (error) { last = error; }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw last || new Error('Service did not become ready');
};
const base = 'http://127.0.0.1:5174';
const apiBase = 'http://127.0.0.1:3002';
const password = 'Upload-test-password-123';
const email = 'upload-e2e@example.com';
const pdf = (name) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from(`%PDF-1.4\n${name}\n%%EOF`) });
try {
  const dbpath = path.join(temp, 'db');
  await fs.mkdir(dbpath);
  launch(process.env.MONGOD_PATH || 'mongod', ['--dbpath', dbpath, '--port', '27029', '--bind_ip', '127.0.0.1']);
  await mongoose.connect('mongodb://127.0.0.1:27029/upload_e2e', { serverSelectionTimeoutMS: 15000 });
  await User.create({ firstName: 'Upload', lastName: 'Tester', email, password, isEmailVerified: true });
  await User.create({ firstName: 'Admin', lastName: 'Tester', email: 'admin-e2e@example.com', password, role: 'admin', isEmailVerified: true });
  const reviewerUser = await User.create({ firstName: 'Reviewer', lastName: 'Tester', email: 'reviewer-e2e@example.com', password, isReviewer: true, isEmailVerified: true });
  const reviewer = await Reviewer.create({ name: 'Reviewer Tester', email: reviewerUser.email, userId: reviewerUser._id });
  launch(process.execPath, ['index.js'], { cwd: root, env: { ...process.env, PORT: '3002', MONGODB_URI: 'mongodb://127.0.0.1:27029', DB_NAME: 'upload_e2e', JWT_SECRET: 'isolated-upload-e2e', SMTP_USER: '', SMTP_PASS: '', FRONTEND_URL: base, UPLOADS_DIR: path.join(temp, 'uploads') } });
  launch(process.execPath, [path.join(client, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5174', '--strictPort'], { cwd: client, env: { ...process.env, VITE_API_URL: `${apiBase}/api` } });
  await waitFor(async () => (await fetch(`${apiBase}/health`)).ok);
  await waitFor(async () => (await fetch(base)).ok);
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  const page = await browser.newPage();
  page.on('requestfailed', (request) => console.error('REQUEST FAILED', request.url(), request.failure()?.errorText));
  const browserErrors = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  await page.goto(`${base}/login`);
  await page.getByLabel('Email Address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  const loginResponse = page.waitForResponse((res) => res.url().includes('/auth/login'));
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  const loginResult = await loginResponse;
  assert.equal(loginResult.ok(), true, await loginResult.text());
  await page.waitForURL('**/dashboard');
  console.log('PASS login through real API');

  // Restore valid non-file answers to focus the browser test on the complete upload lifecycle.
  const form = {
    researchTitle: 'Document upload E2E', consentAcknowledged: true,
    principalInvestigator: { fullName: 'Upload Tester', jobTitle: 'Researcher', hospital: 'Military Hospital', department: 'Research', qualifications: 'MD', telephone: '+96891234567', email, isFromMCMSS: 'Yes' },
    mastersOrPhd: 'No', researchType: ['Medical records'], studyInvolves: ['None of the above'], proposedStartDate: '2027-01-01', duration: '6 months', multiCenterResearch: 'No', fundingSource: 'Self-Funding',
    dataCapturingMethods: 'Records', dataStorageMode: 'Secure storage', dataAccess: 'PI', confidentialityMeasures: 'Anonymous', previousEthicsApproval: 'No', collectingPersonalInfo: 'No', collectingFromOtherSource: 'No', involvesDeception: 'No', intendToPublish: 'Yes', bloodTissueSamples: 'No',
    introduction: 'Introduction', rationaleForStudy: 'Rationale', studyDesignSettingDuration: 'Design', objectives: 'Objectives', studyPopulationAndSampling: 'Sampling', sampleSize: 'Ten', variables: 'Variables', statisticalAnalysis: 'Analysis', expectedOutcomes: 'Outcomes', references: 'References',
    documentUploads: [],
  };
  const openNew = async (data) => {
    await page.evaluate((value) => localStorage.setItem('submissionFormAutoSave', JSON.stringify(value)), data);
    await page.goto(`${base}/submission/new`);
  };
  const step8 = async () => {
    for (let step = 1; step < 8; step++) await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('heading', { name: 'Document Uploads', exact: true }).waitFor();
  };
  await openNew({ ...form, documentUploads: [{ type: 'Survey', languages: { english: true }, englishFiles: [{ _fileMeta: { name: 'lost.pdf' } }], arabicFiles: [] }] });
  await page.getByText('Please select your documents again.', { exact: false }).waitFor();
  await step8();
  assert.equal(await page.getByText('lost.pdf', { exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Submit for Review', exact: true }).click();
  await page.getByText('Upload the english document.', { exact: true }).waitFor();
  console.log('PASS restored autosave cannot submit metadata-only documents');

  await page.goto(`${base}/dashboard`);
  await openNew(form);
  await step8();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Survey', exact: true }).click();
  await page.getByRole('checkbox', { name: 'English', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Arabic', exact: true }).check();
  const englishInput = page.locator('#file-document-upload-0-english');
  await englishInput.setInputFiles({ name: 'bad.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('bad') });
  await page.getByRole('alert').filter({ hasText: 'not supported' }).waitFor();
  await englishInput.setInputFiles(pdf('english.pdf'));
  await page.getByRole('button', { name: 'Remove file', exact: true }).click();
  await englishInput.setInputFiles(pdf('english.pdf'));
  await page.getByText('english.pdf', { exact: true }).waitFor();
  // Empty file chooser cancellation must not erase the current selection.
  await englishInput.setInputFiles([]);
  await page.getByText('english.pdf', { exact: true }).waitFor();
  await page.locator('#file-document-upload-0-arabic').setInputFiles(pdf('arabic.pdf'));
  const drop = await page.evaluateHandle(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['%PDF-1.4\narabic.pdf\n%%EOF'], 'arabic.pdf', { type: 'application/pdf' }));
    return transfer;
  });
  await page.locator('label[for="file-document-upload-0-arabic"]').dispatchEvent('drop', { dataTransfer: drop });
  await drop.dispose();
  console.log('PASS invalid selection, removal, re-selection and chooser cancellation');

  const save = async (method) => {
    const response = page.waitForResponse((res) => res.url().includes('/api/submissions') && res.request().method() === method);
    await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
    const result = await response;
    assert.equal(result.ok(), true, await result.text());
    await page.getByRole('button', { name: 'Save Draft', exact: true }).waitFor({ state: 'visible' });
    return (await result.json()).data;
  };
  let saved = await save('POST');
  const id = saved._id;
  await page.waitForURL(`**/submission/${id}/edit`);
  const firstPaths = saved.formData.documentUploads[0];
  const fileCount = (await fs.readdir(path.join(temp, 'uploads'))).length;
  saved = await save('PUT');
  assert.deepEqual(saved.formData.documentUploads[0], firstPaths);
  assert.equal((await fs.readdir(path.join(temp, 'uploads'))).length, fileCount);
  console.log('PASS create and repeat save without duplicate uploads');

  await page.goto(`${base}/submission/${id}`);
  for (const name of ['english.pdf', 'arabic.pdf']) {
    const link = page.getByRole('link', { name, exact: true });
    await link.waitFor();
    const result = await fetch(await link.getAttribute('href'));
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('content-disposition'), 'inline');
    assert.equal(await link.getAttribute('target'), '_blank');
    assert.deepEqual(Buffer.from(await result.arrayBuffer()), pdf(name).buffer);
  }
  console.log('PASS reload and download exact file bytes in both languages');

  await page.goto(`${base}/submission/${id}/edit`);
  await step8();
  await englishInput.setInputFiles(pdf('replacement.pdf'));
  saved = await save('PUT');
  assert.deepEqual(saved.formData.documentUploads[0].englishFiles.map((f) => f.originalName), ['replacement.pdf']);
  const replacementPath = saved.formData.documentUploads[0].englishFiles[0].path;
  await save('PUT');
  await page.reload();
  await step8();
  await page.getByText('replacement.pdf', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Submit for Review', exact: true }).click();
  const submitResponse = page.waitForResponse((res) => res.url().endsWith(`/${id}/submit`));
  await page.getByRole('dialog').getByRole('button', { name: /confirm|submit/i }).click();
  assert.equal((await submitResponse).ok(), true);
  await waitFor(async () => (await Submission.findById(id)).status === 'under_review');
  console.log('PASS edit, save, reload and submit for review');

  const ownerToken = await page.evaluate(() => localStorage.getItem('accessToken'));
  const api = async (token, endpoint, method = 'GET', body, expected = 200) => {
    const response = await fetch(`${apiBase}/api${endpoint}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const payload = await response.json();
    assert.equal(response.status, expected, JSON.stringify(payload));
    return payload.data;
  };
  const adminLogin = await api('', '/auth/login', 'POST', { email: 'admin-e2e@example.com', password });
  const reviewerLogin = await api('', '/auth/login', 'POST', { email: reviewerUser.email, password });
  const adminToken = adminLogin.accessToken;
  const reviewerToken = reviewerLogin.accessToken;
  await api(adminToken, `/submissions/${id}/assign-reviewer`, 'POST', { reviewerId: reviewer.id });
  // Declaration blocks the reviewer until the PI approves (admin override is supported).
  await api(reviewerToken, `/submissions/${id}/review-draft`, 'PUT', { status: 'major_revisions', comments: '' }, 403);
  await api(adminToken, `/submissions/${id}/pi-declaration`, 'POST', { decision: 'approve' });
  const reviewerContext = await browser.newContext();
  const adminContext = await browser.newContext();
  const reviewerPage = await reviewerContext.newPage();
  const adminPage = await adminContext.newPage();
  for (const [rolePage, auth] of [[reviewerPage, reviewerLogin], [adminPage, adminLogin]]) {
    rolePage.on('pageerror', (error) => browserErrors.push(error.message));
    await rolePage.goto(base);
    await rolePage.evaluate((data) => {
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
    }, auth);
  }
  const releaseDecision = async (decision, decisionLabel) => {
    await reviewerPage.goto(`${base}/submission/${id}`);
    await reviewerPage.getByRole('combobox', { name: 'Decision', exact: true }).click();
    await reviewerPage.getByRole('option', { name: decisionLabel, exact: true }).click();
    const issue = reviewerPage.waitForResponse((res) => res.url().endsWith(`/${id}/issue-review`));
    await reviewerPage.getByRole('button', { name: 'Issue review', exact: true }).click();
    assert.equal((await issue).ok(), true);
    const privateView = await api(ownerToken, `/submissions/${id}`);
    assert.equal(privateView.reviewDraft, undefined);
    assert.ok(!privateView.reviewHistory.some((event) => event.event === 'review_issued'));
    await api(reviewerToken, `/submissions/${id}/review-draft`, 'PUT', { status: decision, comments: 'Too late' }, 400);
    await api(ownerToken, `/submissions/${id}/approve-review`, 'POST', {}, 403);
    await adminPage.goto(`${base}/submission/${id}`);
    const release = adminPage.waitForResponse((res) => res.url().endsWith(`/${id}/approve-review`));
    await adminPage.getByRole('button', { name: 'Approve and share', exact: true }).click();
    assert.equal((await release).ok(), true);
    return api(ownerToken, `/submissions/${id}`);
  };
  await releaseDecision('major_revisions', 'Major revisions');
  console.log('PASS PI gate, reviewer issues private decision, admin releases major revisions');
  await page.goto(`${base}/submission/${id}/edit`);
  await step8();
  assert.equal(await page.getByRole('button', { name: 'Remove document 1' }).isDisabled(), true);
  assert.equal(await page.getByRole('checkbox', { name: 'English', exact: true }).isDisabled(), true);
  await englishInput.setInputFiles(pdf('revision.pdf'));
  saved = await save('PUT');
  assert.deepEqual(saved.formData.documentUploads[0].englishFiles.map((f) => f.originalName), ['replacement.pdf', 'revision.pdf']);
  assert.equal(saved.formData.documentUploads[0].englishFiles[0].path, replacementPath);
  const afterRevision = (await fs.readdir(path.join(temp, 'uploads'))).length;
  await save('PUT');
  assert.equal((await fs.readdir(path.join(temp, 'uploads'))).length, afterRevision);
  console.log('PASS revised documents retain earlier versions and save only once');

  await api(ownerToken, `/submissions/${id}/submit`, 'POST', {});
  await releaseDecision('conditional_minor', 'Conditional approval - minor revisions');
  await api(ownerToken, `/submissions/${id}`, 'PUT', { formData: { ...saved.formData, objectives: 'Final revised objectives' } });
  await api(ownerToken, `/submissions/${id}/submit`, 'POST', {});
  const approved = await releaseDecision('approved', 'Approved');
  assert.deepEqual(approved.reviewHistory.filter((event) => event.event === 'decision_released').map((event) => event.decision), ['major_revisions', 'conditional_minor', 'approved']);
  assert.equal(approved.submissionVersions.length, 3);
  assert.equal(approved.submissionVersions[0].formData.documentUploads[0].englishFiles.length, 1);
  assert.equal(approved.submissionVersions[1].formData.documentUploads[0].englishFiles.length, 2);
  assert.equal(approved.submissionVersions[0].formData.objectives, 'Objectives');
  assert.equal(approved.submissionVersions[2].formData.objectives, 'Final revised objectives');
  await page.goto(`${base}/submission/${id}`);
  const history = page.getByRole('list', { name: 'Decision and revision history', exact: true });
  await history.getByText('Major Revisions', { exact: true }).waitFor();
  await history.getByText('Conditional Approval — Minor Revisions', { exact: true }).waitFor();
  await history.getByText('Approved', { exact: true }).waitFor();
  await page.getByText(/^Version 1 ·/).click();
  await page.getByText('Saved answers and documents at submission.', { exact: false }).first().waitFor();
  // Retrieving a released review hides it from the researcher without erasing the audit.
  const retrieved = await api(adminToken, `/submissions/${id}/unsubmit-review`, 'POST', {});
  assert.equal(retrieved.reviewHistory.filter((event) => event.event === 'decision_released').length, 3);
  assert.equal(retrieved.reviewHistory.at(-1).event, 'decision_retrieved');
  const afterRetrieval = await api(ownerToken, `/submissions/${id}`);
  assert.equal(afterRetrieval.reviewHistory.filter((event) => event.event === 'decision_released').length, 2);
  console.log('PASS full three-decision history, immutable revision snapshots, and retrieval audit');

  // Upload a real DOCX and open its text preview by clicking the UI link.
  const wordForm = new FormData();
  wordForm.append('researchTitle', 'Word preview');
  wordForm.append('principalInvestigator', 'Upload Tester');
  wordForm.append('documentUploadEnglish', new Blob([await fs.readFile(path.join(root, 'tests/fixtures/preview.docx'))]), 'preview.docx');
  wordForm.append('formDataJson', JSON.stringify({ documentUploads: [{ type: 'Survey', languages: { english: true }, englishNewFileCount: 1 }] }));
  const wordResponse = await fetch(`${apiBase}/api/submissions`, { method: 'POST', headers: { Authorization: `Bearer ${ownerToken}` }, body: wordForm });
  assert.equal(wordResponse.status, 201);
  const wordSubmission = (await wordResponse.json()).data;
  await page.goto(`${base}/submission/${wordSubmission._id}`);
  let downloads = 0;
  page.on('download', () => { downloads++; });
  const newWindow = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'preview.docx', exact: true }).click();
  const preview = await newWindow;
  await preview.getByRole('heading', { name: 'Document text preview', exact: true }).waitFor();
  await preview.locator('pre').filter({ hasText: 'Document preview test <script>alert(1)</script>' }).waitFor();
  assert.equal(await preview.locator('script').count(), 0);
  assert.equal(downloads, 0);
  const previewResponse = await fetch(`${apiBase}${wordSubmission.formData.documentUploads[0].englishFiles[0].path}/preview`);
  assert.equal(previewResponse.headers.get('content-disposition'), 'inline');
  assert.ok((await previewResponse.text()).includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.equal((await fetch(`${apiBase}/api/uploads/missing.docx/preview`)).status, 404);
  assert.equal((await fetch(`${apiBase}/api/uploads/bad%5Cfile.docx/preview`)).status, 400);
  await fs.writeFile(path.join(temp, 'uploads', 'broken.doc'), 'Not a Word document');
  const broken = await fetch(`${apiBase}/api/uploads/broken.doc/preview`);
  assert.equal(broken.status, 422);
  assert.ok((await broken.text()).includes('Preview unavailable'));
  await fs.unlink(path.join(temp, 'uploads', 'broken.doc'));
  await preview.close();
  console.log('PASS Word document opens in a separate window with escaped text and no download');

  const token = await page.evaluate(() => localStorage.getItem('accessToken'));
  const invalid = new FormData();
  invalid.append('researchTitle', form.researchTitle);
  invalid.append('principalInvestigator', 'Upload Tester');
  invalid.append('documentUploadEnglish', new Blob(['bad']), 'bad.exe');
  invalid.append('formDataJson', JSON.stringify({ documentUploads: [{ englishNewFileCount: 1 }] }));
  assert.equal((await fetch(`${apiBase}/api/submissions`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: invalid })).status, 400);
  const malformed = new FormData();
  malformed.append('documentUploadEnglish', new Blob([pdf('orphan.pdf').buffer]), 'orphan.pdf');
  malformed.append('formDataJson', '{broken');
  assert.equal((await fetch(`${apiBase}/api/submissions`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: malformed })).status, 400);
  await waitFor(async () => (await fs.readdir(path.join(temp, 'uploads'))).length === afterRevision + 1);
  console.log('PASS server rejects invalid/malformed uploads and cleans failed files');
  assert.deepEqual(browserErrors, []);
  console.log('PASS no browser runtime errors; all document upload E2E checks passed');
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  await browser?.close();
  await mongoose.disconnect();
  await Promise.all(children.reverse().map((child) => new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', resolve);
    child.kill();
  })));
  if (path.dirname(temp) !== path.join(root, 'node_modules')) throw new Error('Unsafe test cleanup path');
  await fs.rm(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
}
