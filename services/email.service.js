import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

const logoUrl = config.app.logoUrl || `${config.app.frontendUrl}/src/assets/logo.png`;

const BRANDING = {
  appName: 'Research and Studies Committee',
  orgName: 'Medical City for Military and Security Services',
};

const getEmailLayout = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${BRANDING.appName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding: 40px 40px 24px; text-align: center; border-bottom: 1px solid #e8e8e8;">
              <img src="${logoUrl}" alt="${BRANDING.appName}" style="max-width: 180px; height: auto;" onerror="this.style.display='none'">
              <h1 style="margin: 16px 0 0; font-size: 20px; font-weight: 600; color: #2c3e50;">${BRANDING.appName}</h1>
              <p style="margin: 4px 0 0; font-size: 13px; color: #7f8c8d;">${BRANDING.orgName}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px 40px; color: #2c3e50; font-size: 15px; line-height: 1.6;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; background-color: #f8f9fa; border-top: 1px solid #e8e8e8; text-align: center; font-size: 12px; color: #7f8c8d;">
              <p style="margin: 0;">This is an automated message. Please do not reply directly to this email.</p>
              <p style="margin: 8px 0 0;">&copy; ${new Date().getFullYear()} ${BRANDING.appName}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  const emailConfig = config.email;
  if (!emailConfig.user || !emailConfig.pass) {
    console.warn('SMTP credentials not configured. Emails will not be sent.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.secure,
    auth: {
      user: emailConfig.user,
      pass: emailConfig.pass,
    },
  });

  return transporter;
};

const sendEmail = async ({ to, subject, html, text }) => {
  const transport = getTransporter();
  if (!transport) {
    console.log('Email (not sent - no SMTP config):', { to, subject });
    return { sent: false, messageId: null };
  }

  try {
    const info = await transport.sendMail({
      from: `"${BRANDING.appName}" <${config.email.from}>`,
      to,
      subject,
      html: html || text,
      text: text || (html ? html.replace(/<[^>]*>/g, '') : ''),
    });
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email send error:', error.message);
    throw new Error('Failed to send email.');
  }
};

const templates = {
  signupOTP: (name, otp, appName, expiresMinutes) => ({
    subject: `Email Verification - ${appName}`,
    content: `
      <p style="margin: 0 0 16px;">Dear ${name},</p>
      <p style="margin: 0 0 16px;">Thank you for registering with ${appName}. To complete your account registration, please use the verification code below:</p>
      <p style="margin: 24px 0; padding: 20px; background-color: #f8f9fa; border-radius: 6px; text-align: center; font-size: 28px; font-weight: 600; letter-spacing: 6px; color: #2c3e50;">${otp}</p>
      <p style="margin: 0 0 16px;">This code will expire in <strong>${expiresMinutes} minutes</strong>. If you did not initiate this registration, please disregard this email.</p>
      <p style="margin: 0 0 8px;">For security reasons, please do not share this code with anyone.</p>
      <p style="margin: 24px 0 0;">Sincerely,<br/><strong>${appName} Team</strong></p>
    `,
  }),
  welcome: (name, appName) => ({
    subject: `Account Successfully Activated - ${appName}`,
    content: `
      <p style="margin: 0 0 16px;">Dear ${name},</p>
      <p style="margin: 0 0 16px;">Your account has been successfully created and verified. You may now log in to access the platform.</p>
      <p style="margin: 0 0 16px;">If you did not create this account, please contact our support team immediately.</p>
      <p style="margin: 24px 0 0;">Sincerely,<br/><strong>${appName} Team</strong></p>
    `,
  }),
  passwordReset: (name, resetLink, appName, expiresMinutes) => ({
    subject: `Password Reset Request - ${appName}`,
    content: `
      <p style="margin: 0 0 16px;">Dear ${name},</p>
      <p style="margin: 0 0 16px;">We have received a request to reset the password for your account. To proceed, please click the button below:</p>
      <p style="margin: 24px 0;"><a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #2980b9; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">Reset Password</a></p>
      <p style="margin: 0 0 16px;">This link will expire in <strong>${expiresMinutes} minutes</strong>.</p>
      <p style="margin: 0 0 16px;">If you did not request a password reset, please ignore this email. Your password will remain unchanged.</p>
      <p style="margin: 24px 0 0;">Sincerely,<br/><strong>${appName} Team</strong></p>
    `,
  }),
  passwordChanged: (name, appName) => ({
    subject: `Password Updated - ${appName}`,
    content: `
      <p style="margin: 0 0 16px;">Dear ${name},</p>
      <p style="margin: 0 0 16px;">This is to confirm that your password has been successfully updated.</p>
      <p style="margin: 0 0 16px;">If you did not make this change, please contact our support team immediately.</p>
      <p style="margin: 24px 0 0;">Sincerely,<br/><strong>${appName} Team</strong></p>
    `,
  }),
  otp: (name, otp, purpose, appName, expiresMinutes) => ({
    subject: `Verification Code - ${appName}`,
    content: `
      <p style="margin: 0 0 16px;">Dear ${name},</p>
      <p style="margin: 0 0 16px;">Your verification code for ${purpose} is:</p>
      <p style="margin: 24px 0; padding: 20px; background-color: #f8f9fa; border-radius: 6px; text-align: center; font-size: 28px; font-weight: 600; letter-spacing: 6px; color: #2c3e50;">${otp}</p>
      <p style="margin: 0 0 16px;">This code will expire in <strong>${expiresMinutes} minutes</strong>. Please do not share it with anyone.</p>
      <p style="margin: 24px 0 0;">Sincerely,<br/><strong>${appName} Team</strong></p>
    `,
  }),
  reviewAssigned: (reviewerName, submissionTitle, appName) => ({
    subject: `New Review Assignment - ${appName}`,
    content: `
      <p style="margin: 0 0 16px;">Dear ${reviewerName},</p>
      <p style="margin: 0 0 16px;">You have been assigned to review the following research submission:</p>
      <p style="margin: 16px 0; padding: 16px; background-color: #f8f9fa; border-left: 4px solid #2980b9; border-radius: 4px;"><strong>${submissionTitle}</strong></p>
      <p style="margin: 0 0 16px;">Please log in to the platform to access and complete your review.</p>
      <p style="margin: 24px 0 0;">Sincerely,<br/><strong>${appName} Team</strong></p>
    `,
  }),
  submissionStatusUpdate: (name, submissionTitle, status, appName) => ({
    subject: `Submission Status Update - ${appName}`,
    content: `
      <p style="margin: 0 0 16px;">Dear ${name},</p>
      <p style="margin: 0 0 16px;">The status of your submission "<strong>${submissionTitle}</strong>" has been updated to: <strong>${status.replace(/_/g, ' ')}</strong>.</p>
      <p style="margin: 0 0 16px;">Please log in to the platform to view the full details.</p>
      <p style="margin: 24px 0 0;">Sincerely,<br/><strong>${appName} Team</strong></p>
    `,
  }),
};

export const sendSignupOTPEmail = async (email, name, otp, expiresMinutes = 15) => {
  const { subject, content } = templates.signupOTP(name, otp, BRANDING.appName, expiresMinutes);
  return sendEmail({ to: email, subject, html: getEmailLayout(content) });
};

export const sendWelcomeEmail = async (email, name) => {
  const { subject, content } = templates.welcome(name, BRANDING.appName);
  return sendEmail({ to: email, subject, html: getEmailLayout(content) });
};

export const sendPasswordResetEmail = async (email, name, token, expiresMinutes = 15) => {
  const resetLink = `${config.app.frontendUrl}/reset-password?token=${token}`;
  const { subject, content } = templates.passwordReset(name, resetLink, BRANDING.appName, expiresMinutes);
  return sendEmail({ to: email, subject, html: getEmailLayout(content) });
};

export const sendPasswordChangedEmail = async (email, name) => {
  const { subject, content } = templates.passwordChanged(name, BRANDING.appName);
  return sendEmail({ to: email, subject, html: getEmailLayout(content) });
};

export const sendOTPEmail = async (email, name, otp, purpose = 'Verification', expiresMinutes = 15) => {
  const { subject, content } = templates.otp(name, otp, purpose, BRANDING.appName, expiresMinutes);
  return sendEmail({ to: email, subject, html: getEmailLayout(content) });
};

export const sendReviewAssignedEmail = async (reviewerEmail, reviewerName, submissionTitle) => {
  const { subject, content } = templates.reviewAssigned(reviewerName, submissionTitle, BRANDING.appName);
  return sendEmail({ to: reviewerEmail, subject, html: getEmailLayout(content) });
};

export const sendSubmissionStatusEmail = async (email, name, submissionTitle, status) => {
  const { subject, content } = templates.submissionStatusUpdate(name, submissionTitle, status, BRANDING.appName);
  return sendEmail({ to: email, subject, html: getEmailLayout(content) });
};
