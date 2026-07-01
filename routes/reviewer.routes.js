import { Router } from 'express';
import * as reviewerController from '../controllers/reviewer.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/rbac.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createReviewerSchema, updateReviewerSchema } from '../validators/reviewer.validator.js';

const router = Router();

router.use(authenticate);

router.get('/', reviewerController.getReviewers);
router.get('/candidates', authorize('admin'), reviewerController.getReviewerCandidates);
router.get('/:id', reviewerController.getReviewer);

router.post('/', authorize('admin'), validate(createReviewerSchema), reviewerController.createReviewer);
router.put('/:id', authorize('admin'), validate(updateReviewerSchema), reviewerController.updateReviewer);
router.delete('/:id', authorize('admin'), reviewerController.deleteReviewer);

export default router;
