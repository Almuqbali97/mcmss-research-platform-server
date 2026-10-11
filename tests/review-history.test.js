import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Submission from '../models/Submission.model.js';
import { recordReviewEvent, recordSubmissionVersion } from '../services/reviewHistory.service.js';
import { forViewer, retrieveReleasedReview, approveReview } from '../controllers/submission.controller.js';
import { buildApprovalGrantedEmail } from '../services/email.service.js';

test('approval email contains study title and proposal number in subject and escaped body', () => {
  const email = buildApprovalGrantedEmail('Researcher', 'Study <A> & B', 'MREC-2026-123');
  assert.ok(email.subject.includes('Study <A> & B'));
  assert.ok(email.subject.includes('MREC-2026-123'));
  assert.ok(email.html.includes('Study &lt;A&gt; &amp; B'));
  assert.ok(email.html.includes('MREC-2026-123'));
});

test('submitted snapshots do not change when the researcher revises answers or documents', () => {
  const submission = new Submission({ formData: { objectives: 'Original', documentUploads: [{ englishFiles: [{ path: '/api/uploads/original.pdf' }] }] } });
  recordSubmissionVersion(submission, false);
  submission.formData.objectives = 'Revised';
  submission.formData.documentUploads[0].englishFiles.push({ path: '/api/uploads/revised.pdf' });
  recordSubmissionVersion(submission, true);
  assert.equal(submission.submissionVersions[0].formData.objectives, 'Original');
  assert.equal(submission.submissionVersions[0].formData.documentUploads[0].englishFiles.length, 1);
  assert.equal(submission.submissionVersions[1].formData.objectives, 'Revised');
  assert.deepEqual(submission.reviewHistory.map((entry) => entry.event), ['submitted', 'revision_submitted']);
});

test('every released decision is retained without overall comments across three rounds', async (context) => {
  const owner = new mongoose.Types.ObjectId();
  const submission = new Submission({ submittedBy: owner, assignedReviewerId: new mongoose.Types.ObjectId(), assignedReviewer: 'Private Reviewer' });
  const query = { populate() { return this; }, then(resolve) { resolve(submission); } };
  context.mock.method(Submission, 'findOne', () => query);
  context.mock.method(submission, 'save', async () => submission);
  for (const decision of ['major_revisions', 'conditional_minor', 'approved']) {
    submission.status = 'under_review';
    submission.reviewDraft = { status: decision, comments: '', fieldComments: { introduction: decision }, state: 'issued' };
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await approveReview({ params: { id: submission.id }, user: { role: 'admin' } }, res, (error) => { throw error; });
    assert.equal(res.code, 200);
  }
  assert.deepEqual(submission.reviewHistory.map((entry) => entry.decision), ['major_revisions', 'conditional_minor', 'approved']);
  assert.equal(submission.reviewHistory[0].fieldComments.introduction, 'major_revisions');
  assert.equal(submission.reviewCommentHistory.length, 3);
  recordReviewEvent(submission, 'review_issued', { comment: 'Private draft' });
  assert.equal(retrieveReleasedReview(submission), true);
  const visible = forViewer(submission, { _id: owner, role: 'researcher' });
  assert.deepEqual(visible.reviewHistory.map((entry) => entry.decision), ['major_revisions', 'conditional_minor']);
  assert.equal(visible.reviewHistory[0].author, undefined);
  assert.equal(submission.reviewHistory.filter((entry) => entry.event === 'decision_released').length, 3);
  assert.equal(submission.reviewHistory.at(-1).event, 'decision_retrieved');
});
