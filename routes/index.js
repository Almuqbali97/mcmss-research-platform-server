import { Router } from 'express';
import authRoutes from './auth.routes.js';
import submissionRoutes from './submission.routes.js';
import publicationFundingRoutes from './publicationFunding.routes.js';
import reviewerRoutes from './reviewer.routes.js';
import settingsRoutes from './settings.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/submissions', submissionRoutes);
router.use('/publication-funding', publicationFundingRoutes);
router.use('/reviewers', reviewerRoutes);
router.use('/settings', settingsRoutes);

export default router;
