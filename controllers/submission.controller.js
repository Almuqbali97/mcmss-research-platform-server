import Submission from '../models/Submission.model.js';
import Reviewer from '../models/Reviewer.model.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { generateSubmissionId } from '../utils/generateSubmissionId.js';
import {
  sendReviewAssignedEmail,
  sendSubmissionStatusEmail,
  sendSubmissionAcknowledgmentEmail,
} from '../services/email.service.js';

const RESEARCHER_EDITABLE_STATUSES = ['draft', 'revisions_required'];
const RESEARCHER_SUBMITTABLE_STATUSES = ['draft', 'revisions_required'];

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
        await sendSubmissionStatusEmail(
          submission.submittedBy.email,
          submission.submittedBy.name,
          submission.researchTitle,
          submission.status
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
