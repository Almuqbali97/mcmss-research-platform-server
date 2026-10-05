import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Submission from '../models/Submission.model.js';
import { forViewer, canRetrieveReleasedReview, retrieveReleasedReview } from '../controllers/submission.controller.js';

const ownerId = new mongoose.Types.ObjectId();
const reviewerId = new mongoose.Types.ObjectId();

const makeSubmission = () => new Submission({
  submissionId: 'MREC-TEST-1',
  researchTitle: 'Privacy study',
  principalInvestigator: 'Investigator',
  submittedBy: ownerId,
  status: 'under_review_with_revisions',
  assignedReviewer: 'Private Reviewer',
  assignedReviewerId: reviewerId,
  reviewDraft: {
    status: 'major_revisions',
    comments: 'Unreleased decision',
    fieldComments: { introduction: 'Unreleased section comment' },
    state: 'issued',
  },
  reviewCommentHistory: [{ comment: 'Released comment', author: 'Private Reviewer' }],
  fieldComments: { introduction: 'Released section comment' },
});

test('revised submissions retain a distinct status', () => {
  const submission = makeSubmission();
  assert.equal(submission.validateSync(), undefined);
  assert.equal(submission.status, 'under_review_with_revisions');
});

test('owner responses omit reviewer identity and unreleased review work', () => {
  const result = forViewer(makeSubmission(), { _id: ownerId, role: 'researcher' });
  assert.equal(result.assignedReviewer, undefined);
  assert.equal(result.assignedReviewerId, undefined);
  assert.equal(result.reviewDraft, undefined);
  assert.equal(result.reviewCommentHistory[0].author, undefined);
  assert.equal(result.fieldComments.introduction, 'Released section comment');
});

test('admin responses retain issued review and reviewer identity', () => {
  const result = forViewer(makeSubmission(), { _id: new mongoose.Types.ObjectId(), role: 'admin' });
  assert.equal(result.assignedReviewer, 'Private Reviewer');
  assert.equal(result.reviewDraft.state, 'issued');
});

test('retrieving a released revision hides that round and preserves its editable draft', () => {
  const submission = makeSubmission();
  submission.status = 'major_revisions';
  submission.reviewStatus = 'major_revisions';
  submission.reviewComments = 'Released current comment';
  submission.fieldComments = { introduction: 'Released current field comment' };
  submission.revision.round = 2;
  submission.revision.deadline = new Date('2026-11-01T00:00:00Z');
  submission.reviewCommentHistory.push({ comment: 'Released current comment', decision: 'major_revisions', round: 2 });
  const currentEntryId = submission.reviewCommentHistory.at(-1)._id;
  submission.reviewDraft = {
    status: 'major_revisions', comments: 'Released current comment',
    fieldComments: { introduction: 'Released current field comment' }, state: 'released',
  };
  submission.reviewRelease = {
    releasedStatus: 'major_revisions', previousStatus: 'under_review_with_revisions',
    previousReviewStatus: 'pending', previousReviewComments: '',
    previousFieldComments: { introduction: 'Earlier round comment' },
    previousRevision: { round: 1, deadline: null, startedAt: null },
    historyEntryId: String(currentEntryId),
  };

  assert.equal(retrieveReleasedReview(submission), true);
  assert.equal(submission.status, 'under_review_with_revisions');
  assert.equal(submission.reviewDraft.state, 'draft');
  assert.equal(submission.reviewDraft.comments, 'Released current comment');
  assert.equal(submission.revision.round, 1);
  assert.equal(submission.reviewCommentHistory.length, 1);
  const researcherView = forViewer(submission, { _id: ownerId, role: 'researcher' });
  assert.equal(researcherView.reviewDraft, undefined);
  assert.equal(researcherView.reviewRelease, undefined);
  assert.equal(researcherView.reviewComments, '');
  assert.equal(researcherView.fieldComments.introduction, 'Earlier round comment');
  assert.equal(researcherView.reviewCommentHistory.some((entry) => entry.comment === 'Released current comment'), false);
});

test('an older approved review can be retrieved until a new submission starts', () => {
  const submission = makeSubmission();
  submission.status = 'approved';
  submission.reviewStatus = 'approved';
  submission.reviewComments = 'Approval comment';
  submission.fieldComments = { introduction: 'Approval field comment' };
  submission.reviewDraft = { status: null, comments: '', fieldComments: {}, state: 'draft' };
  submission.reviewRelease = null;
  submission.reviewCommentHistory.push({ comment: 'Approval comment', decision: 'approved', round: 0 });

  assert.equal(canRetrieveReleasedReview(submission), true);
  assert.equal(retrieveReleasedReview(submission), true);
  assert.equal(submission.status, 'under_review');
  assert.equal(submission.reviewDraft.comments, 'Approval comment');
  assert.equal(submission.reviewCommentHistory.some((entry) => entry.comment === 'Approval comment'), false);
  submission.status = 'under_review_with_revisions';
  assert.equal(canRetrieveReleasedReview(submission), false);
});
