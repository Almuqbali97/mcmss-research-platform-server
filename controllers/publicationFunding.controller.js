import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PublicationFunding from '../models/PublicationFunding.model.js';
import Reviewer from '../models/Reviewer.model.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { generatePublicationFundingId } from '../utils/generatePublicationFundingId.js';
import {
  sendReviewAssignedEmail,
  sendSubmissionStatusEmail,
  sendSubmissionAcknowledgmentEmail,
} from '../services/email.service.js';
import { notifyAdminOfSubmission } from '../services/notification.service.js';

const RESEARCHER_EDITABLE_STATUSES = ['draft', 'revisions_required'];
const RESEARCHER_SUBMITTABLE_STATUSES = ['draft', 'revisions_required'];

const uploadsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../uploads');

const PF_FILE_FIELDS = [
  'frontPageOrArticleFiles',
  'proofOfPaymentFiles',
  'acceptanceLetterFiles',
  'publishedArticleFiles',
  'invoiceReceiptFiles',
  'irbApprovalFiles',
  'copeDoajProofFiles',
  'additionalSupportingFiles',
];

/* Best-effort removal of uploaded files referenced in an application's formData. */
const removeApplicationFiles = (formData) => {
  if (!formData) return;
  for (const field of PF_FILE_FIELDS) {
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

const canAccessApplication = async (application, user) => {
  if (user.role === 'admin') return true;
  const isSubmitter =
    application.submittedBy?._id?.equals(user._id) || application.submittedBy?.equals?.(user._id);
  if (isSubmitter) return true;
  if (user.isReviewer) {
    const reviewer = await Reviewer.findOne({ userId: user._id, isActive: true });
    if (reviewer && isAssignedReviewer(application.assignedReviewerId, reviewer._id)) return true;
  }
  return false;
};

const populateOptions = [
  { path: 'submittedBy', select: 'firstName lastName email' },
  { path: 'assignedReviewerId', select: 'name email specialization' },
];

export const getPublicationFundingApplications = async (req, res, next) => {
  try {
    const { status } = req.query;
    const user = req.user;
    const query = {};

    if (user.role === 'admin') {
      // Admin sees all
    } else {
      // Researchers (including reviewers) see their own applications here.
      query.submittedBy = user._id;
    }

    if (status) query.status = status;

    const applications = await PublicationFunding.find(query)
      .populate(populateOptions)
      .sort({ createdAt: -1 });

    return successResponse(res, applications);
  } catch (error) {
    next(error);
  }
};

export const getPublicationFundingApplication = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const application = await PublicationFunding.findById(id).populate(populateOptions);

    if (!application) {
      return errorResponse(res, 'Application not found.', 404);
    }

    if (!(await canAccessApplication(application, user))) {
      return errorResponse(res, 'Access denied.', 403);
    }

    return successResponse(res, application);
  } catch (error) {
    next(error);
  }
};

export const createPublicationFundingApplication = async (req, res, next) => {
  try {
    const user = req.user;
    const count = await PublicationFunding.countDocuments();
    const applicationId = generatePublicationFundingId(count + 1);

    const application = await PublicationFunding.create({
      ...req.body,
      applicationId,
      submittedBy: user._id,
      applicantName: req.body.applicantName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
    });

    const populated = await PublicationFunding.findById(application._id).populate(populateOptions);

    return successResponse(res, populated, 'Application created.', 201);
  } catch (error) {
    next(error);
  }
};

export const updatePublicationFundingApplication = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const application = await PublicationFunding.findById(id);
    if (!application) return errorResponse(res, 'Application not found.', 404);

    if (user.role === 'researcher') {
      if (!application.submittedBy.equals(user._id)) {
        return errorResponse(res, 'Access denied.', 403);
      }
      if (!RESEARCHER_EDITABLE_STATUSES.includes(application.status)) {
        return errorResponse(res, 'Only draft or revision-required applications can be edited.', 400);
      }
    } else if (user.role !== 'admin') {
      return errorResponse(res, 'Access denied.', 403);
    }

    Object.assign(application, req.body);
    await application.save();

    const updated = await PublicationFunding.findById(id).populate(populateOptions);

    return successResponse(res, updated);
  } catch (error) {
    next(error);
  }
};

export const deletePublicationFundingApplication = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const application = await PublicationFunding.findById(id);
    if (!application) return errorResponse(res, 'Application not found.', 404);

    if (user.role === 'researcher') {
      if (!application.submittedBy.equals(user._id)) {
        return errorResponse(res, 'Access denied.', 403);
      }
    } else if (user.role !== 'admin') {
      return errorResponse(res, 'Access denied.', 403);
    }

    if (application.status !== 'draft') {
      return errorResponse(res, 'Only draft applications can be deleted.', 400);
    }

    removeApplicationFiles(application.formData);
    await application.deleteOne();

    return successResponse(res, { id }, 'Draft deleted.');
  } catch (error) {
    next(error);
  }
};

export const submitPublicationFundingForReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const application = await PublicationFunding.findById(id).populate('submittedBy', 'firstName lastName email');
    if (!application) return errorResponse(res, 'Application not found.', 404);

    if (!application.submittedBy._id.equals(user._id)) {
      return errorResponse(res, 'Access denied.', 403);
    }

    if (!RESEARCHER_SUBMITTABLE_STATUSES.includes(application.status)) {
      return errorResponse(res, 'Only draft or revision-required applications can be submitted for review.', 400);
    }

    application.status = 'under_review';
    application.submittedDate = new Date();
    application.reviewStatus = 'pending';
    if (application.reviewComments) {
      application.reviewComments = '';
    }
    await application.save();

    if (application.submittedBy?.email) {
      try {
        await sendSubmissionAcknowledgmentEmail(
          application.submittedBy.email,
          `${application.submittedBy.firstName} ${application.submittedBy.lastName}`.trim(),
          application.manuscriptTitle,
          application.submittedDate,
          application.formData?.email
        );
      } catch (emailErr) {
        console.error('Publication funding acknowledgment email failed:', emailErr.message);
      }
    }

    await notifyAdminOfSubmission({
      formType: 'Publication Funding Application',
      title: application.manuscriptTitle,
      applicantName: application.applicantName,
      referenceId: application.applicationId,
    });

    const updated = await PublicationFunding.findById(id).populate(populateOptions);

    return successResponse(res, updated, 'Application submitted for review.');
  } catch (error) {
    next(error);
  }
};

export const assignPublicationFundingReviewer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reviewerId } = req.body;

    const application = await PublicationFunding.findById(id).populate(populateOptions);
    if (!application) return errorResponse(res, 'Application not found.', 404);

    const reviewer = await Reviewer.findById(reviewerId);
    if (!reviewer) return errorResponse(res, 'Reviewer not found.', 404);
    if (!reviewer.isActive) return errorResponse(res, 'This reviewer is inactive.', 400);

    application.assignedReviewer = reviewer.name;
    application.assignedReviewerId = reviewer._id;
    await application.save();

    try {
      await sendReviewAssignedEmail(reviewer.email, reviewer.name, application.manuscriptTitle);
    } catch (emailErr) {
      console.error('Publication funding review assignment email failed:', emailErr.message);
    }

    const updated = await PublicationFunding.findById(id).populate(populateOptions);

    return successResponse(res, updated, 'Reviewer assigned successfully.');
  } catch (error) {
    next(error);
  }
};

export const submitPublicationFundingReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, comments } = req.body;
    const user = req.user;

    const application = await PublicationFunding.findById(id)
      .populate('submittedBy', 'firstName lastName email')
      .populate('assignedReviewerId', 'name email specialization');
    if (!application) return errorResponse(res, 'Application not found.', 404);

    const reviewer = await Reviewer.findOne({ userId: user._id });
    const isAssigned = isAssignedReviewer(application.assignedReviewerId, reviewer?._id);
    const isAdmin = user.role === 'admin';
    if (!isAssigned && !isAdmin) {
      return errorResponse(res, 'You are not assigned to review this application.', 403);
    }

    application.reviewStatus = status;
    application.status = status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'revisions_required';
    application.reviewComments = comments || '';
    await application.save();

    if (application.submittedBy?.email) {
      try {
        await sendSubmissionStatusEmail(
          application.submittedBy.email,
          `${application.submittedBy.firstName} ${application.submittedBy.lastName}`.trim(),
          application.manuscriptTitle,
          application.status
        );
      } catch (emailErr) {
        console.error('Publication funding status email failed:', emailErr.message);
      }
    }

    const updated = await PublicationFunding.findById(id).populate(populateOptions);

    return successResponse(res, updated, 'Review submitted successfully.');
  } catch (error) {
    next(error);
  }
};

export const updateCommitteeReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { committeeReview } = req.body;

    const application = await PublicationFunding.findById(id);
    if (!application) return errorResponse(res, 'Application not found.', 404);

    application.committeeReview = committeeReview;
    await application.save();

    const updated = await PublicationFunding.findById(id).populate(populateOptions);

    return successResponse(res, updated, 'Committee review saved.');
  } catch (error) {
    next(error);
  }
};

export const exportPublicationFundingApplication = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const application = await PublicationFunding.findById(id).populate(populateOptions);

    if (!application) return errorResponse(res, 'Application not found.', 404);

    const hasAccess = await canAccessApplication(application, user);
    if (!hasAccess) {
      return errorResponse(res, 'Access denied.', 403);
    }

    return successResponse(res, {
      application: application.toObject ? application.toObject() : application,
    });
  } catch (error) {
    next(error);
  }
};
