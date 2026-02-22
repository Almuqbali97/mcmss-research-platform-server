import { Router } from 'express';
import authRoutes from './auth.routes.js';
import submissionRoutes from './submission.routes.js';
import reviewerRoutes from './reviewer.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/submissions', submissionRoutes);
router.use('/reviewers', reviewerRoutes);

export default router;
