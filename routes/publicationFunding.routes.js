import { Router } from 'express';
import * as publicationFundingController from '../controllers/publicationFunding.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/rbac.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { publicationFundingUpload } from '../middlewares/upload.middleware.js';
import { parseMultipartPublicationFunding } from '../middlewares/parsePublicationFunding.middleware.js';
import {
  createPublicationFundingSchema,
  updatePublicationFundingSchema,
  assignReviewerSchema,
  submitReviewSchema,
  committeeReviewSchema,
} from '../validators/publicationFunding.validator.js';

const router = Router();

const maybeMultipart = (req, res, next) => {
  if (req.is('multipart/form-data')) {
    publicationFundingUpload(req, res, (err) => {
      if (err) return next(err);
      parseMultipartPublicationFunding(req, res, next);
    });
  } else {
    next();
  }
};

router.use(authenticate);

router.get('/', publicationFundingController.getPublicationFundingApplications);
router.get('/:id', publicationFundingController.getPublicationFundingApplication);
router.post(
  '/',
  authorize('researcher', 'admin'),
  maybeMultipart,
  validate(createPublicationFundingSchema),
  publicationFundingController.createPublicationFundingApplication
);
router.put(
  '/:id',
  authorize('researcher', 'admin'),
  maybeMultipart,
  validate(updatePublicationFundingSchema),
  publicationFundingController.updatePublicationFundingApplication
);
router.delete(
  '/:id',
  authorize('researcher', 'admin'),
  publicationFundingController.deletePublicationFundingApplication
);
router.post(
  '/:id/submit',
  authorize('researcher', 'admin'),
  publicationFundingController.submitPublicationFundingForReview
);
router.post(
  '/:id/assign-reviewer',
  authorize('admin'),
  validate(assignReviewerSchema),
  publicationFundingController.assignPublicationFundingReviewer
);
router.post(
  '/:id/review',
  authorize('reviewer', 'admin'),
  validate(submitReviewSchema),
  publicationFundingController.submitPublicationFundingReview
);
router.patch(
  '/:id/committee-review',
  authorize('admin'),
  validate(committeeReviewSchema),
  publicationFundingController.updateCommitteeReview
);
router.get('/:id/export', publicationFundingController.exportPublicationFundingApplication);

export default router;
