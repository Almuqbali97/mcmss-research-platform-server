import { Router } from 'express';
import * as submissionController from '../controllers/submission.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/rbac.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { submissionUpload } from '../middlewares/upload.middleware.js';
import { parseMultipartSubmission } from '../middlewares/parseMultipart.middleware.js';
import {
  createSubmissionSchema,
  updateSubmissionSchema,
  assignReviewerSchema,
  submitReviewSchema,
  fieldCommentsSchema,
} from '../validators/submission.validator.js';

const router = Router();

const maybeMultipart = (req, res, next) => {
  if (req.is('multipart/form-data')) {
    submissionUpload(req, res, (err) => {
      if (err) return next(err);
      parseMultipartSubmission(req, res, next);
    });
  } else {
    next();
  }
};

router.use(authenticate);

router.get('/', submissionController.getSubmissions);
router.get('/:id', submissionController.getSubmission);
router.post('/', authorize('researcher', 'admin'), maybeMultipart, validate(createSubmissionSchema), submissionController.createSubmission);
router.put('/:id', authorize('researcher', 'admin'), maybeMultipart, validate(updateSubmissionSchema), submissionController.updateSubmission);
router.post('/:id/submit', authorize('researcher', 'admin'), submissionController.submitForReview);
router.post('/:id/assign-reviewer', authorize('admin'), validate(assignReviewerSchema), submissionController.assignReviewer);
router.post('/:id/review', authorize('reviewer', 'admin'), validate(submitReviewSchema), submissionController.submitReview);
router.patch('/:id/field-comments', authorize('reviewer', 'admin'), validate(fieldCommentsSchema), submissionController.updateFieldComments);
router.get('/:id/export', submissionController.exportSubmission);

export default router;
