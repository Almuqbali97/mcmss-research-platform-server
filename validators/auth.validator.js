import Joi from 'joi';

export const signupSchema = Joi.object({
  firstName: Joi.string().trim().required().min(1).max(50),
  lastName: Joi.string().trim().required().min(1).max(50),
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().min(6).required(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().required(),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
});

export const verifyOTPSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  otp: Joi.string().required(),
  purpose: Joi.string().valid('email_verification', 'password_reset', 'login', 'general').required(),
});

export const resendOTPSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  purpose: Joi.string().valid('email_verification', 'password_reset', 'login', 'general').required(),
});

export const verifySignupSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  otp: Joi.string().required(),
});

export const resendSignupOTPSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
});
