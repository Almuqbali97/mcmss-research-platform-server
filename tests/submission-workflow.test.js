import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Submission from '../models/Submission.model.js';
import { forViewer } from '../controllers/submission.controller.js';

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
