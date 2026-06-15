import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.model.js';
import PendingSignup from '../models/PendingSignup.model.js';
import { config } from '../config/index.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
} from '../services/email.service.js';
import { createAndSendOTP, verifyOTP } from '../services/otp.service.js';

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
  const refreshToken = jwt.sign({ userId }, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });
  return { accessToken, refreshToken };
};

/**
 * Step 1: User submits signup form. OTP sent to email. Account not created yet.
 */
export const signup = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    const emailLower = email.toLowerCase();

    const existingUser = await User.findOne({ email: emailLower });
    if (existingUser) {
      return errorResponse(res, 'This email is already registered.', 400);
    }

    const expiresAt = new Date(Date.now() + config.otp.expiresInMinutes * 60 * 1000);
    await PendingSignup.deleteOne({ email: emailLower });

    await PendingSignup.create({
      email: emailLower,
      firstName,
      lastName,
      password,
      role: 'researcher',
      expiresAt,
    });

    await createAndSendOTP(emailLower, 'email_verification', `${firstName} ${lastName}`);

    return successResponse(
      res,
      { email: emailLower, expiresIn: config.otp.expiresInMinutes },
      'Verification code has been sent to your email. Please enter it to complete registration.'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Step 2: User submits OTP. Account created after verification.
 */
export const verifySignup = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const emailLower = email.toLowerCase();

    const result = await verifyOTP(emailLower, otp, 'email_verification');
    if (!result.valid) {
      return errorResponse(res, result.message, 400);
    }

    const pending = await PendingSignup.findOne({ email: emailLower });
    if (!pending) {
      return errorResponse(res, 'Registration session expired. Please sign up again.', 400);
    }

    const existingUser = await User.findOne({ email: emailLower });
    if (existingUser) {
      await PendingSignup.deleteOne({ email: emailLower });
      return errorResponse(res, 'This email is already registered.', 400);
    }

    const user = await User.create({
      firstName: pending.firstName,
      lastName: pending.lastName,
      email: pending.email,
      password: pending.password,
      role: pending.role,
      isEmailVerified: true,
    });

    await PendingSignup.deleteOne({ email: emailLower });
    await sendWelcomeEmail(user.email, `${user.firstName} ${user.lastName}`);

    const { accessToken, refreshToken } = generateTokens(user._id);
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return successResponse(
      res,
      {
        user: user.toAuthJSON(),
        accessToken,
        refreshToken,
        expiresIn: config.jwt.expiresIn,
      },
      'Account created successfully. You are now logged in.',
      201
    );
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return errorResponse(res, 'Invalid email or password.', 401);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return errorResponse(res, 'Invalid email or password.', 401);
    }

    if (!user.isActive) {
      return errorResponse(res, 'Account has been deactivated.', 403);
    }

    user.lastLoginAt = new Date();
    const { accessToken, refreshToken } = generateTokens(user._id);
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return successResponse(res, {
      user: user.toAuthJSON(),
      accessToken,
      refreshToken,
      expiresIn: config.jwt.expiresIn,
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (user) {
      user.refreshToken = undefined;
      await user.save({ validateBeforeSave: false });
    }
    return successResponse(res, null, 'Logged out successfully.');
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      return errorResponse(res, 'Refresh token required.', 400);
    }

    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await User.findById(decoded.userId).select('+refreshToken');
    if (!user || user.refreshToken !== token) {
      return errorResponse(res, 'Invalid refresh token.', 401);
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id);
    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    return successResponse(res, {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: config.jwt.expiresIn,
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 'Refresh token expired.', 401);
    }
    next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return successResponse(res, null, 'If the email exists, a reset link will be sent.');
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    await sendPasswordResetEmail(email, user.name, resetToken, 15);

    return successResponse(res, null, 'If the email exists, a reset link will be sent.');
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return errorResponse(res, 'Invalid or expired reset token.', 400);
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshToken = undefined;
    await user.save();

    await sendPasswordChangedEmail(user.email, user.name);

    return successResponse(res, null, 'Password reset successful. Please log in.');
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.userId).select('+password');
    if (!user) {
      return errorResponse(res, 'User not found.', 401);
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return errorResponse(res, 'Current password is incorrect.', 400);
    }

    user.password = newPassword;
    user.refreshToken = undefined;
    await user.save();

    await sendPasswordChangedEmail(user.email, user.name);

    return successResponse(res, null, 'Password changed successfully.');
  } catch (error) {
    next(error);
  }
};

export const resendSignupOTP = async (req, res, next) => {
  try {
    const { email } = req.body;
    const emailLower = email.toLowerCase();

    const pending = await PendingSignup.findOne({ email: emailLower });
    if (!pending) {
      return errorResponse(res, 'No pending registration found. Please sign up again.', 400);
    }

    pending.expiresAt = new Date(Date.now() + config.otp.expiresInMinutes * 60 * 1000);
    await pending.save();

    await createAndSendOTP(emailLower, 'email_verification', `${pending.firstName} ${pending.lastName}`);
    return successResponse(res, null, 'A new verification code has been sent to your email.');
  } catch (error) {
    next(error);
  }
};

export const sendOTP = async (req, res, next) => {
  try {
    const { email, purpose } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user && purpose !== 'general') {
      return errorResponse(res, 'No account found with this email.', 404);
    }

    let userName = 'User';
    if (user) {
      const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
      if (fullName) userName = fullName;
    }
    await createAndSendOTP(email, purpose, userName);
    return successResponse(res, null, 'OTP sent to your email.');
  } catch (error) {
    next(error);
  }
};

export const verifyOTPHandler = async (req, res, next) => {
  try {
    const { email, otp, purpose } = req.body;
    const result = await verifyOTP(email, otp, purpose);

    if (!result.valid) {
      return errorResponse(res, result.message, 400);
    }

    return successResponse(res, { verified: true }, 'OTP verified successfully.');
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return errorResponse(res, 'User not found.', 401);
    }
    return successResponse(res, user.toAuthJSON());
  } catch (error) {
    next(error);
  }
};
