import Reviewer from '../models/Reviewer.model.js';
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

export const createReviewer = async (req, res, next) => {
  try {
    const existing = await Reviewer.findOne({ email: req.body.email.toLowerCase() });
    if (existing) {
      return errorResponse(res, 'A reviewer with this email already exists.', 400);
    }

    const reviewer = await Reviewer.create(req.body);
    return successResponse(res, reviewer, 'Reviewer created.', 201);
  } catch (error) {
    next(error);
  }
};

export const updateReviewer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const reviewer = await Reviewer.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

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

    return successResponse(res, null, 'Reviewer deactivated successfully.');
  } catch (error) {
    next(error);
  }
};
