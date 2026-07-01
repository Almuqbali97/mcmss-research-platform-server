import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Submission from '../models/Submission.model.js';
import Reviewer from '../models/Reviewer.model.js';
import { config } from '../config/index.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { generateSubmissionId } from '../utils/generateSubmissionId.js';
import {
  sendReviewAssignedEmail,
  sendSubmissionStatusEmail,
  sendSubmissionAcknowledgmentEmail,
  sendSupervisorApprovalEmail,
  sendSupervisorDecisionEmail,
} from '../services/email.service.js';
import { notifyAdminOfSubmission } from '../services/notification.service.js';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

/* Renders a minimal standalone HTML page for the supervisor decision link. */
const decisionPage = (heading, message, ok = true) => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${heading}</title></head>
<body style="margin:0;font-family:'Segoe UI',Tahoma,sans-serif;background:#f5f5f5;">
<div style="max-width:520px;margin:60px auto;background:#fff;border-radius:8px;padding:40px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.08);">
<h1 style="color:${ok ? '#27ae60' : '#c0392b'};font-size:22px;margin:0 0 12px;">${heading}</h1>
<p style="color:#2c3e50;font-size:15px;line-height:1.6;margin:0;">${message}</p>
</div></body></html>`;

const RESEARCHER_EDITABLE_STATUSES = ['draft', 'revisions_required'];
const RESEARCHER_SUBMITTABLE_STATUSES = ['draft', 'revisions_required'];

const uploadsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../uploads');

const SUBMISSION_FILE_FIELDS = [
  'informationSheetFiles',
  'consentFormFiles',
  'grantDocuments',
  'ethicsApprovalDocuments',
  'sampleSizeFiles',
  'dataVariablesFiles',
  'researchProposalFiles',
  'bloodTissueAbroadDocuments',
];

/* Best-effort removal of uploaded files referenced in a submission's formData. */
const removeSubmissionFiles = (formData) => {
  if (!formData) return;
  for (const field of SUBMISSION_FILE_FIELDS) {
    const refs = formData[field];
    if (!Array.isArray(refs)) continue;
    for (const ref of refs) {
      if (!ref?.filename) continue;
      const filePath = path.join(uploadsDir, path.basename(ref.filename));
      fs.promises.unlink(filePath).catch(() => {});
    }
  }
};

const isAssignedReviewer = (assignedReviewerId, reviewerId) => {
  if (!assignedReviewerId || !reviewerId) return false;
  const assignedId = assignedReviewerId._id || assignedReviewerId;
  return assignedId.equals(reviewerId);
};

const canAccessSubmission = async (submission, user) => {
  if (user.role === 'admin') return true;
  if (user.role === 'researcher') {
    return submission.submittedBy?._id?.equals(user._id) || submission.submittedBy?.equals?.(user._id);
  }
  if (user.role === 'reviewer') {
    const reviewer = await Reviewer.findOne({ userId: user._id });
    if (!reviewer) return false;
    return isAssignedReviewer(submission.assignedReviewerId, reviewer._id);
  }
  return false;
};

export const getSubmissions = async (req, res, next) => {
  try {
    const { status } = req.query;
    const user = req.user;
    const query = {};

    if (user.role === 'admin') {
      // Admin sees all
    } else if (user.role === 'reviewer') {
      const reviewer = await Reviewer.findOne({ userId: user._id });
      if (!reviewer) {
        return successResponse(res, []);
      }
      query.assignedReviewerId = reviewer._id;
    } else {
      query.submittedBy = user._id;
    }

    if (status) query.status = status;

    const submissions = await Submission.find(query)
      .populate('submittedBy', 'firstName lastName email')
      .populate('assignedReviewerId', 'name email specialization')
      .sort({ createdAt: -1 });

    return successResponse(res, submissions);
  } catch (error) {
    next(error);
  }
};

export const getSubmission = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const submission = await Submission.findById(id)
      .populate('submittedBy', 'firstName lastName email')
      .populate('assignedReviewerId', 'name email specialization');

    if (!submission) {
      return errorResponse(res, 'Submission not found.', 404);
    }

    if (user.role === 'researcher' && !submission.submittedBy?._id?.equals(user._id)) {
      return errorResponse(res, 'Access denied.', 403);
    }

    if (user.role === 'reviewer') {
      const reviewer = await Reviewer.findOne({ userId: user._id });
      if (reviewer && !submission.assignedReviewerId?._id?.equals(reviewer._id)) {
        return errorResponse(res, 'Access denied.', 403);
      }
      if (!reviewer) {
        return errorResponse(res, 'Access denied.', 403);
      }
    }

    return successResponse(res, submission);
  } catch (error) {
    next(error);
  }
};

export const createSubmission = async (req, res, next) => {
  try {
    const user = req.user;
    const count = await Submission.countDocuments();
    const numericId = count + 1;
    const submissionId = generateSubmissionId(numericId);

    const submission = await Submission.create({
      ...req.body,
      submissionId,
      submittedBy: user._id,
      principalInvestigator: req.body.principalInvestigator || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
    });

    const populated = await Submission.findById(submission._id)
      .populate('submittedBy', 'firstName lastName email')
      .populate('assignedReviewerId', 'name email specialization');

    return successResponse(res, populated, 'Submission created.', 201);
  } catch (error) {
    next(error);
  }
};

export const updateSubmission = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const submission = await Submission.findById(id);
    if (!submission) return errorResponse(res, 'Submission not found.', 404);

    if (user.role === 'researcher') {
      if (!submission.submittedBy.equals(user._id)) {
        return errorResponse(res, 'Access denied.', 403);
      }
      if (!RESEARCHER_EDITABLE_STATUSES.includes(submission.status)) {
        return errorResponse(res, 'Only draft or revision-required submissions can be edited.', 400);
      }
    } else if (user.role !== 'admin') {
      return errorResponse(res, 'Access denied.', 403);
    }

    Object.assign(submission, req.body);
    await submission.save();

    const updated = await Submission.findById(id)
      .populate('submittedBy', 'firstName lastName email')
      .populate('assignedReviewerId', 'name email specialization');

    return successResponse(res, updated);
  } catch (error) {
    next(error);
  }
};

export const deleteSubmission = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const submission = await Submission.findById(id);
    if (!submission) return errorResponse(res, 'Submission not found.', 404);

    if (user.role === 'researcher') {
      if (!submission.submittedBy.equals(user._id)) {
        return errorResponse(res, 'Access denied.', 403);
      }
    } else if (user.role !== 'admin') {
      return errorResponse(res, 'Access denied.', 403);
    }

    if (submission.status !== 'draft') {
      return errorResponse(res, 'Only draft submissions can be deleted.', 400);
    }

    removeSubmissionFiles(submission.formData);
    await submission.deleteOne();

    return successResponse(res, { id }, 'Draft deleted.');
  } catch (error) {
    next(error);
  }
};

export const submitForReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const submission = await Submission.findById(id).populate('submittedBy', 'firstName lastName email');
    if (!submission) return errorResponse(res, 'Submission not found.', 404);

    if (!submission.submittedBy._id.equals(user._id)) {
      return errorResponse(res, 'Access denied.', 403);
    }

    if (!RESEARCHER_SUBMITTABLE_STATUSES.includes(submission.status)) {
      return errorResponse(res, 'Only draft or revision-required submissions can be submitted for review.', 400);
    }

    submission.status = 'under_review';
    submission.submittedDate = new Date();
    submission.reviewStatus = 'pending';
    if (submission.reviewComments) {
      submission.reviewComments = '';
    }
    await submission.save();

    if (submission.submittedBy?.email) {
      try {
        const piEmail = submission.formData?.principalInvestigator?.email;
        await sendSubmissionAcknowledgmentEmail(
          submission.submittedBy.email,
          submission.submittedBy.name,
          submission.researchTitle,
          submission.submittedDate,
          piEmail
        );
      } catch (emailErr) {
        console.error('Submission acknowledgment email failed:', emailErr.message);
      }
    }

    await notifyAdminOfSubmission({
      formType: 'Research Ethics Submission',
      title: submission.researchTitle,
      applicantName: submission.principalInvestigator,
      referenceId: submission.submissionId,
    });

    // Masters/PhD submissions require supervisor approval via email.
    const supervisorEmail = submission.formData?.supervisorEmail?.trim();
    if (submission.formData?.mastersOrPhd === 'Yes' && supervisorEmail && EMAIL_RE.test(supervisorEmail)) {
      try {
        const token = crypto.randomBytes(24).toString('hex');
        submission.supervisorApproval = {
          email: supervisorEmail,
          token,
          status: 'pending',
          decidedAt: null,
        };
        await submission.save();

        const base = `${config.app.backendUrl}/api/submissions/supervisor-decision/${token}`;
        await sendSupervisorApprovalEmail(
          supervisorEmail,
          submission.formData?.supervisorName,
          submission.principalInvestigator,
          submission.researchTitle,
          `${base}?decision=approve`,
          `${base}?decision=reject`
        );
      } catch (supErr) {
        console.error('Supervisor approval email failed:', supErr.message);
      }
    }

    const updated = await Submission.findById(id)
      .populate('submittedBy', 'firstName lastName email')
      .populate('assignedReviewerId', 'name email specialization');

    return successResponse(res, updated, 'Submission submitted for review.');
  } catch (error) {
    next(error);
  }
};

export const assignReviewer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reviewerId } = req.body;

    const submission = await Submission.findById(id)
      .populate('submittedBy', 'firstName lastName email')
      .populate('assignedReviewerId', 'name email');
    if (!submission) return errorResponse(res, 'Submission not found.', 404);

    const reviewer = await Reviewer.findById(reviewerId);
    if (!reviewer) return errorResponse(res, 'Reviewer not found.', 404);
    if (!reviewer.isActive) return errorResponse(res, 'This reviewer is inactive.', 400);

    submission.assignedReviewer = reviewer.name;
    submission.assignedReviewerId = reviewer._id;
    await submission.save();

    try {
      await sendReviewAssignedEmail(reviewer.email, reviewer.name, submission.researchTitle);
    } catch (emailErr) {
      console.error('Review assignment email failed:', emailErr.message);
    }

    const updated = await Submission.findById(id)
      .populate('submittedBy', 'firstName lastName email')
      .populate('assignedReviewerId', 'name email specialization');

    return successResponse(res, updated, 'Reviewer assigned successfully.');
  } catch (error) {
    next(error);
  }
};

export const submitReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, comments } = req.body;
    const user = req.user;

    const submission = await Submission.findById(id)
      .populate('submittedBy', 'firstName lastName email')
      .populate('assignedReviewerId', 'name email');
    if (!submission) return errorResponse(res, 'Submission not found.', 404);

    const reviewer = await Reviewer.findOne({ userId: user._id });
    const isAssigned = isAssignedReviewer(submission.assignedReviewerId, reviewer?._id);
    const isAdmin = user.role === 'admin';
    if (!isAssigned && !isAdmin) {
      return errorResponse(res, 'You are not assigned to review this submission.', 403);
    }

    submission.reviewStatus = status;
    submission.status = status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'revisions_required';
    submission.reviewComments = comments || '';
    await submission.save();

    if (submission.submittedBy?.email) {
      try {
        const submitterName =
          `${submission.submittedBy.firstName || ''} ${submission.submittedBy.lastName || ''}`.trim() ||
          'Researcher';
        await sendSubmissionStatusEmail(
          submission.submittedBy.email,
          submitterName,
          submission.researchTitle,
          submission.status,
          submission.formData?.principalInvestigator?.email
        );
      } catch (emailErr) {
        console.error('Submission status email failed:', emailErr.message);
      }
    }

    const updated = await Submission.findById(id)
      .populate('submittedBy', 'firstName lastName email')
      .populate('assignedReviewerId', 'name email specialization');

    return successResponse(res, updated, 'Review submitted successfully.');
  } catch (error) {
    next(error);
  }
};

export const updateFieldComments = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fieldComments } = req.body;
    const user = req.user;

    const submission = await Submission.findById(id)
      .populate('submittedBy', 'firstName lastName email')
      .populate('assignedReviewerId', 'name email specialization');

    if (!submission) return errorResponse(res, 'Submission not found.', 404);

    const reviewer = await Reviewer.findOne({ userId: user._id });
    const isAssigned = isAssignedReviewer(submission.assignedReviewerId, reviewer?._id);
    const isAdmin = user.role === 'admin';
    if (!isAssigned && !isAdmin) {
      return errorResponse(res, 'You are not authorized to add comments to this submission.', 403);
    }

    submission.fieldComments = fieldComments || {};
    await submission.save();

    const updated = await Submission.findById(id)
      .populate('submittedBy', 'firstName lastName email')
      .populate('assignedReviewerId', 'name email specialization');

    return successResponse(res, updated, 'Field comments saved.');
  } catch (error) {
    next(error);
  }
};

/* Public endpoint hit from the supervisor approval email. Records the decision. */
export const supervisorDecision = async (req, res) => {
  try {
    const { token } = req.params;
    const decisionRaw = (req.query.decision || '').toLowerCase();
    const decision = decisionRaw === 'approve' ? 'approved' : decisionRaw === 'reject' ? 'rejected' : null;

    if (!decision) {
      return res.status(400).send(decisionPage('Invalid Request', 'The approval link is malformed.', false));
    }

    const submission = await Submission.findOne({ 'supervisorApproval.token': token })
      .select('+supervisorApproval.token')
      .populate('submittedBy', 'firstName lastName email');

    if (!submission) {
      return res.status(404).send(decisionPage('Link Not Found', 'This approval link is invalid or has expired.', false));
    }

    if (submission.supervisorApproval.status && submission.supervisorApproval.status !== 'pending') {
      return res
        .status(200)
        .send(decisionPage('Already Recorded', `This submission was already ${submission.supervisorApproval.status}. No further action is needed.`, submission.supervisorApproval.status === 'approved'));
    }

    submission.supervisorApproval.status = decision;
    submission.supervisorApproval.decidedAt = new Date();
    submission.supervisorApproval.token = null;
    await submission.save();

    if (submission.submittedBy?.email) {
      try {
        await sendSupervisorDecisionEmail(
          submission.submittedBy.email,
          submission.submittedBy.name,
          submission.researchTitle,
          decision,
          submission.supervisorApproval.email
        );
      } catch (mailErr) {
        console.error('Supervisor decision notice failed:', mailErr.message);
      }
    }

    return res
      .status(200)
      .send(decisionPage(
        decision === 'approved' ? 'Submission Approved' : 'Submission Rejected',
        `Thank you. Your decision to ${decision === 'approved' ? 'approve' : 'reject'} this submission has been recorded.`,
        decision === 'approved'
      ));
  } catch (error) {
    console.error('Supervisor decision error:', error.message);
    return res.status(500).send(decisionPage('Something Went Wrong', 'Please try again later.', false));
  }
};

export const exportSubmission = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const submission = await Submission.findById(id)
      .populate('submittedBy', 'firstName lastName email')
      .populate('assignedReviewerId', 'name email specialization');

    if (!submission) return errorResponse(res, 'Submission not found.', 404);

    const hasAccess = await canAccessSubmission(submission, user);
    if (!hasAccess) {
      return errorResponse(res, 'Access denied.', 403);
    }

    return successResponse(res, {
      submission: submission.toObject ? submission.toObject() : submission,
    });
  } catch (error) {
    next(error);
  }
};
