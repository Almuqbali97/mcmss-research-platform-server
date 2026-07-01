import Reviewer from '../models/Reviewer.model.js';
import User from '../models/User.model.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

export const getReviewers = async (req, res, next) => {
  try {
    const reviewers = await Reviewer.find({ isActive: true })
      .populate('userId', 'firstName lastName email')
      .sort({ name: 1 });

    return successResponse(res, reviewers);
  } catch (error) {
    next(error);
  }
};

/* Active platform users the admin can promote to reviewers (not admins, not already reviewers). */
export const getReviewerCandidates = async (req, res, next) => {
  try {
    const activeReviewers = await Reviewer.find({ isActive: true }).select('userId');
    const takenIds = activeReviewers.map((r) => r.userId).filter(Boolean);

    const users = await User.find({
      isActive: true,
      role: { $ne: 'admin' },
      _id: { $nin: takenIds },
    })
      .select('firstName lastName email')
      .sort({ firstName: 1 });

    return successResponse(res, users);
  } catch (error) {
    next(error);
  }
};

export const getReviewer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const reviewer = await Reviewer.findById(id).populate('userId', 'firstName lastName email');

    if (!reviewer) {
      return errorResponse(res, 'Reviewer not found.', 404);
    }

    return successResponse(res, reviewer);
  } catch (error) {
    next(error);
  }
};

/* Promotes an existing platform user to a reviewer. Reviewers are selected from users only. */
export const createReviewer = async (req, res, next) => {
  try {
    const { userId, specialization } = req.body;

    const user = await User.findById(userId);
    if (!user || !user.isActive) {
      return errorResponse(res, 'Selected user was not found or is inactive.', 400);
    }
    if (user.role === 'admin') {
      return errorResponse(res, 'Admin accounts cannot be reviewers.', 400);
    }

    const existing = await Reviewer.findOne({ userId: user._id, isActive: true });
    if (existing) {
      return errorResponse(res, 'This user is already a reviewer.', 400);
    }

    const reviewer = await Reviewer.create({
      name: user.name,
      email: user.email,
      specialization: specialization || '',
      userId: user._id,
    });

    user.isReviewer = true;
    await user.save({ validateBeforeSave: false });

    const populated = await Reviewer.findById(reviewer._id).populate('userId', 'firstName lastName email');
    return successResponse(res, populated, 'Reviewer added.', 201);
  } catch (error) {
    next(error);
  }
};

export const updateReviewer = async (req, res, next) => {
  try {
    const { id } = req.params;
    // Only specialization is editable; name/email/userId come from the linked user account.
    const reviewer = await Reviewer.findByIdAndUpdate(
      id,
      { specialization: req.body.specialization ?? '' },
      { new: true, runValidators: true }
    ).populate('userId', 'firstName lastName email');

    if (!reviewer) {
      return errorResponse(res, 'Reviewer not found.', 404);
    }

    return successResponse(res, reviewer);
  } catch (error) {
    next(error);
  }
};

export const deleteReviewer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const reviewer = await Reviewer.findByIdAndUpdate(id, { isActive: false }, { new: true });

    if (!reviewer) {
      return errorResponse(res, 'Reviewer not found.', 404);
    }

    // Drop reviewer capability from the linked user account.
    if (reviewer.userId) {
      await User.findByIdAndUpdate(reviewer.userId, { isReviewer: false });
    }

    return successResponse(res, null, 'Reviewer deactivated successfully.');
  } catch (error) {
    next(error);
  }
};
