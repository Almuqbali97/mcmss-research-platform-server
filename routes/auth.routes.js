import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  verifyOTPSchema,
  resendOTPSchema,
  verifySignupSchema,
  resendSignupOTPSchema,
} from '../validators/auth.validator.js';

const router = Router();

router.post('/signup', validate(signupSchema), authController.signup);
router.post('/verify-signup', validate(verifySignupSchema), authController.verifySignup);
router.post('/resend-signup-otp', validate(resendSignupOTPSchema), authController.resendSignupOTP);
router.post('/login', validate(loginSchema), authController.login);

router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

router.post('/send-otp', validate(resendOTPSchema), authController.sendOTP);
router.post('/verify-otp', validate(verifyOTPSchema), authController.verifyOTPHandler);

router.post('/refresh-token', authController.refreshToken);

router.use(authenticate);

router.get('/me', authController.getMe);
router.post('/logout', authController.logout);
router.post('/change-password', validate(changePasswordSchema), authController.changePassword);

export default router;
