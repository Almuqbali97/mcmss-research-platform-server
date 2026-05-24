import PublicationFunding from '../models/PublicationFunding.model.js';
import Reviewer from '../models/Reviewer.model.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { generatePublicationFundingId } from '../utils/generatePublicationFundingId.js';
import {
  sendReviewAssignedEmail,
  sendSubmissionStatusEmail,
  sendSubmissionAcknowledgmentEmail,
} from '../services/email.service.js';

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

    if (user.role === 'researcher' && !application.submittedBy?._id?.equals(user._id)) {
      return errorResponse(res, 'Access denied.', 403);
    }

    if (user.role === 'reviewer') {
      const reviewer = await Reviewer.findOne({ userId: user._id });
      if (!reviewer) {
        return errorResponse(res, 'Access denied.', 403);
      }
      if (!application.assignedReviewerId?._id?.equals(reviewer._id)) {
        return errorResponse(res, 'Access denied.', 403);
      }
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
      if (application.status !== 'draft') {
        return errorResponse(res, 'Only draft applications can be edited.', 400);
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

export const submitPublicationFundingForReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const application = await PublicationFunding.findById(id).populate('submittedBy', 'firstName lastName email');
    if (!application) return errorResponse(res, 'Application not found.', 404);

    if (!application.submittedBy._id.equals(user._id)) {
      return errorResponse(res, 'Access denied.', 403);
    }

    if (application.status !== 'draft') {
      return errorResponse(res, 'Only draft applications can be submitted for review.', 400);
    }

    application.status = 'under_review';
    application.submittedDate = new Date();
    application.reviewStatus = 'pending';
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

    application.assignedReviewer = reviewer.name;
    application.assignedReviewerId = reviewer._id;
    await application.save();

    await sendReviewAssignedEmail(reviewer.email, reviewer.name, application.manuscriptTitle);

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

    const application = await PublicationFunding.findById(id).populate('submittedBy', 'firstName lastName email');
    if (!application) return errorResponse(res, 'Application not found.', 404);

    const reviewer = await Reviewer.findOne({ userId: user._id });
    const isAssignedReviewer = reviewer && application.assignedReviewerId?._id?.equals(reviewer._id);
    const isAdmin = user.role === 'admin';
    if (!isAssignedReviewer && !isAdmin) {
      return errorResponse(res, 'You are not assigned to review this application.', 403);
    }

    application.reviewStatus = status;
    application.status = status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'revisions_required';
    application.reviewComments = comments || '';
    await application.save();

    if (application.submittedBy?.email) {
      await sendSubmissionStatusEmail(
        application.submittedBy.email,
        `${application.submittedBy.firstName} ${application.submittedBy.lastName}`.trim(),
        application.manuscriptTitle,
        application.status
      );
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

    const application = await PublicationFunding.findById(id).populate(populateOptions);

    if (!application) return errorResponse(res, 'Application not found.', 404);

    return successResponse(res, {
      application: application.toObject ? application.toObject() : application,
    });
  } catch (error) {
    next(error);
  }
};
