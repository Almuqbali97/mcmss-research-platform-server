import crypto from 'crypto';
import OTP from '../models/OTP.model.js';
import { config } from '../config/index.js';
import { sendOTPEmail, sendSignupOTPEmail } from './email.service.js';

const generateNumericOTP = (length = config.otp.length) => {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[crypto.randomInt(0, 10)];
  }
  return otp;
};

export const createAndSendOTP = async (email, purpose, userName = 'User') => {
  const otp = generateNumericOTP();
  const expiresAt = new Date(Date.now() + config.otp.expiresInMinutes * 60 * 1000);

  await OTP.deleteMany({ email, purpose });

  await OTP.create({
    email: email.toLowerCase(),
    otp,
    purpose,
    expiresAt,
  });

  if (purpose === 'email_verification') {
    await sendSignupOTPEmail(email, userName, otp, config.otp.expiresInMinutes);
  } else {
    await sendOTPEmail(email, userName, otp, purpose, config.otp.expiresInMinutes);
  }

  return { otp, expiresAt };
};

export const verifyOTP = async (email, otp, purpose) => {
  const record = await OTP.findOne({
    email: email.toLowerCase(),
    purpose,
    used: false,
  }).sort({ createdAt: -1 });

  if (!record) {
    return { valid: false, message: 'Invalid or expired OTP.' };
  }

  if (record.expiresAt < new Date()) {
    return { valid: false, message: 'OTP has expired.' };
  }

  if (record.otp !== otp) {
    return { valid: false, message: 'Invalid OTP.' };
  }

  record.used = true;
  await record.save();

  return { valid: true };
};
