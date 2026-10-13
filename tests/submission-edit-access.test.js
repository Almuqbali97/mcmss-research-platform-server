import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import Submission from '../models/Submission.model.js';
import User from '../models/User.model.js';
import Setting from '../models/Setting.model.js';
import { config } from '../config/index.js';
import {
  forViewer, setResearcherEditAccess, updateSubmission, submitForReview, approveReview,
} from '../controllers/submission.controller.js';
import { researcherEditAccessSchema, updateSubmissionSchema } from '../validators/submission.validator.js';
import { deriveSubmissionStatus } from '../../client/src/utils/submissionStatus.js';

const owner = new User({ firstName: 'Research', lastName: 'Owner', email: 'owner@example.test' });
const researcher = { _id: owner._id, role: 'researcher' };
const admin = { _id: new mongoose.Types.ObjectId(), role: 'admin' };
const response = () => ({ status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
const next = (error) => { throw error; };
const makeSubmission = (status = 'under_review') => new Submission({
  submissionId: 'EDIT-TEST', researchTitle: 'Original title', principalInvestigator: 'PI',
  submittedBy: owner, status, adminViewedAt: new Date(),
  formData: { principalInvestigator: { email: 'OWNER@example.test ' } },
  reviewComments: 'Overall secret', fieldComments: { introduction: 'Section secret' },
  reviewCommentHistory: [{ comment: 'Historical secret', decision: 'major_revisions' }],
  reviewHistory: [{ event: 'decision_released', comment: 'Audit secret', fieldComments: { introduction: 'Audit section secret' } }],
  reviewDraft: { status: 'approved', comments: 'Draft secret', state: 'issued' },
});
function mockSubmission(context, submission) {
  const query = { populate() { return this; }, then(resolve) { resolve(submission); } };
  context.mock.method(Submission, 'findOne', () => query);
  context.mock.method(submission, 'save', async () => submission);
}

test('PI matching submitter is confirmed before the first save without a PI confirmation email', async (context) => {
  const sent = [];
  const originalEmail = config.email;
  config.email = { ...originalEmail, user: 'test', pass: 'test' };
  context.after(() => { config.email = originalEmail; });
  context.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async (mail) => { sent.push(mail); return {}; } }));
  context.mock.method(Setting, 'getGlobal', async () => ({ populate: async () => {}, submissionNotificationRecipient: null }));
  const submission = makeSubmission('draft');
  mockSubmission(context, submission);
  let firstSave = true;
  context.mock.method(submission, 'save', async () => {
    if (firstSave) {
      assert.equal(submission.piDeclarationApproval.status, 'approved');
      firstSave = false;
    }
    return submission;
  });
  const res = response();
  await submitForReview({ params: { id: submission.id }, user: researcher }, res, next);
  assert.equal(res.code, 200);
  assert.equal(submission.status, 'under_review');
  assert.equal(deriveSubmissionStatus(submission), 'under_review');
  assert.equal(submission.piDeclarationApproval.token, null);
  assert.ok(submission.piDeclarationApproval.decidedAt instanceof Date);
  assert.ok(!sent.some((mail) => mail.html.includes('/pi-declaration-decision/')));

  // A different PI must still receive a confirmation request.
  const other = makeSubmission('draft');
  other.formData.principalInvestigator.email = 'pi@example.test';
  mockSubmission(context, other);
  const otherRes = response();
  await submitForReview({ params: { id: other.id }, user: researcher }, otherRes, next);
  assert.equal(otherRes.code, 200);
  assert.equal(other.piDeclarationApproval.status, 'pending');
  assert.equal(deriveSubmissionStatus(other), 'awaiting_pi_confirmation');
  assert.ok(sent.some((mail) => mail.to === 'pi@example.test' && mail.html.includes('/pi-declaration-decision/')));
});

test('admin opens edits, owner saves without changing review, admin closes and stale form saves are rejected', async (context) => {
  const submission = makeSubmission('major_revisions');
  submission.revision.deadline = new Date('2000-01-01');
  mockSubmission(context, submission);
  const req = { params: { id: submission.id }, user: admin, body: { enabled: true } };
  const opened = response();
  await setResearcherEditAccess(req, opened, next);
  assert.equal(opened.code, 200);
  const saved = response();
  await updateSubmission({ ...req, user: researcher, body: { researchTitle: 'Corrected title', status: 'draft' } }, saved, next);
  assert.equal(saved.code, 200);
  assert.equal(submission.researchTitle, 'Corrected title');
  assert.equal(submission.status, 'major_revisions');
  assert.equal(submission.reviewDraft.comments, 'Draft secret');
  assert.deepEqual(submission.$where.researcherEditEnabled, true);
  const privateView = JSON.stringify(saved.body);
  assert.ok(!privateView.includes('secret'));
  assert.equal(forViewer(submission, admin).reviewComments, 'Overall secret');
  const submit = response();
  await submitForReview({ ...req, user: researcher }, submit, next);
  assert.equal(submit.code, 400);

  const closed = response();
  await setResearcherEditAccess({ ...req, body: { enabled: false } }, closed, next);
  assert.equal(closed.code, 200);
  const denied = response();
  await updateSubmission({ ...req, user: researcher, body: { researchTitle: 'Late change' } }, denied, next);
  assert.equal(denied.code, 400);
  assert.equal(submission.researchTitle, 'Corrected title');
  assert.deepEqual(submission.reviewHistory.slice(-2).map((entry) => entry.event), ['edits_enabled', 'edits_closed']);
});

test('edit access is admin-only and cannot be granted through ordinary researcher updates', async (context) => {
  const submission = makeSubmission();
  mockSubmission(context, submission);
  const res = response();
  await setResearcherEditAccess({ params: { id: submission.id }, user: researcher, body: { enabled: true } }, res, next);
  assert.equal(res.code, 403);
  assert.notEqual(submission.researcherEditEnabled, true);
  const validation = updateSubmissionSchema.validate({ researchTitle: 'Title', researcherEditEnabled: true }, { stripUnknown: true });
  assert.equal(validation.value.researcherEditEnabled, undefined);
  assert.ok(researcherEditAccessSchema.validate({ enabled: 'true' }).error);
  assert.ok(researcherEditAccessSchema.validate({}).error);

  submission.researcherEditEnabled = true;
  const stranger = response();
  await updateSubmission({ params: { id: submission.id }, user: { ...researcher, _id: new mongoose.Types.ObjectId() }, body: { researchTitle: 'Other owner' } }, stranger, next);
  assert.equal(stranger.code, 403);
});

test('review cannot be released while correction edits are open', async (context) => {
  const submission = makeSubmission();
  submission.researcherEditEnabled = true;
  mockSubmission(context, submission);
  const res = response();
  await approveReview({ params: { id: submission.id }, user: admin }, res, next);
  assert.equal(res.code, 400);
  assert.equal(submission.status, 'under_review');
});

test('a concurrent admin lock is checked atomically by the database write', async (context) => {
  const submission = Submission.hydrate({ ...makeSubmission().toObject(), researcherEditEnabled: true, submittedBy: owner._id });
  const query = { populate() { return this; }, then(resolve) { resolve(submission); } };
  context.mock.method(Submission, 'findOne', () => query);
  context.mock.method(Submission.collection, 'updateOne', async (filter) => {
    assert.equal(filter.researcherEditEnabled, true);
    assert.equal(filter.status, 'under_review');
    // Simulate an admin closing edits after the form was loaded.
    return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
  });
  const res = response();
  await updateSubmission({ params: { id: submission.id }, user: researcher, body: { researchTitle: 'Concurrent save' } }, res, next);
  assert.equal(res.code, 409);
});

test('status labels cover pending PI decisions and preserve revised/terminal states', () => {
  for (const status of [undefined, 'pending', 'rejected']) {
    assert.equal(deriveSubmissionStatus({ status: 'under_review', piDeclarationApproval: { status } }), 'awaiting_pi_confirmation');
  }
  assert.equal(deriveSubmissionStatus({ status: 'under_review', piDeclarationApproval: { status: 'approved' }, supervisorApproval: { status: 'pending' } }), 'under_review');
  assert.equal(deriveSubmissionStatus({ status: 'under_review_with_revisions', piDeclarationApproval: { status: 'approved' } }), 'under_review_with_revisions');
  assert.equal(deriveSubmissionStatus({ status: 'draft' }), 'draft');
  assert.equal(deriveSubmissionStatus({ status: 'approved' }), 'approved');
});
