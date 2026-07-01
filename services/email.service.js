import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

const logoUrl = config.app.logoUrl || `${config.app.frontendUrl}/src/assets/logo.png`;

const BRANDING = {
  appName: 'Medical Research and Studies Committee',
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

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const formatSubmissionReceivedDate = (d) => {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
};

const sendEmail = async ({ to, cc, subject, html, text }) => {
  const transport = getTransporter();
  if (!transport) {
    console.log('Email (not sent - no SMTP config):', { to, cc, subject });
    return { sent: false, messageId: null };
  }

  try {
    const info = await transport.sendMail({
      from: `"${BRANDING.appName}" <${config.email.from}>`,
      to,
      ...(cc ? { cc } : {}),
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
  newSubmissionAdmin: (adminName, formType, title, applicantName, referenceId, appName) => ({
    subject: `New ${formType} Submitted - ${appName}`,
    content: `
      <p style="margin: 0 0 16px;">Dear ${escapeHtml(adminName)},</p>
      <p style="margin: 0 0 16px;">A new <strong>${escapeHtml(formType)}</strong> has been submitted for review.</p>
      <table role="presentation" style="margin: 16px 0; width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 6px 0; color: #7f8c8d; width: 140px;">Reference</td><td style="padding: 6px 0;"><strong>${escapeHtml(referenceId || 'N/A')}</strong></td></tr>
        <tr><td style="padding: 6px 0; color: #7f8c8d;">Title</td><td style="padding: 6px 0;">${escapeHtml(title || 'Untitled')}</td></tr>
        <tr><td style="padding: 6px 0; color: #7f8c8d;">Submitted by</td><td style="padding: 6px 0;">${escapeHtml(applicantName || 'N/A')}</td></tr>
      </table>
      <p style="margin: 0 0 16px;">Please log in to the admin panel to review this submission.</p>
      <p style="margin: 24px 0 0;">Sincerely,<br/><strong>${appName} Team</strong></p>
    `,
  }),
  supervisorApprovalRequest: (supervisorName, studentName, title, approveUrl, rejectUrl, appName) => ({
    subject: `Research Supervision Approval Requested - ${appName}`,
    content: `
      <p style="margin: 0 0 16px;">Dear ${escapeHtml(supervisorName || 'Supervisor')},</p>
      <p style="margin: 0 0 16px;">${escapeHtml(studentName || 'A research student')} has listed you as their supervisor for the following research submission and requests your approval:</p>
      <p style="margin: 16px 0; padding: 16px; background-color: #f8f9fa; border-left: 4px solid #2980b9; border-radius: 4px;"><strong>${escapeHtml(title || 'Untitled')}</strong></p>
      <p style="margin: 0 0 16px;">Please confirm whether you approve this submission:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 8px 0;">
        <tr>
          <td style="padding-right: 12px;">
            <a href="${approveUrl}" style="display: inline-block; padding: 12px 28px; background-color: #27ae60; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">Approve</a>
          </td>
          <td>
            <a href="${rejectUrl}" style="display: inline-block; padding: 12px 28px; background-color: #c0392b; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">Reject</a>
          </td>
        </tr>
      </table>
      <p style="margin: 16px 0 0; font-size: 13px; color: #7f8c8d;">If you did not expect this request, you may ignore this email.</p>
      <p style="margin: 24px 0 0;">Sincerely,<br/><strong>${appName} Team</strong></p>
    `,
  }),
  supervisorDecisionNotice: (recipientName, title, decision, supervisorEmail, appName) => ({
    subject: `Supervisor ${decision === 'approved' ? 'Approved' : 'Rejected'} Your Submission - ${appName}`,
    content: `
      <p style="margin: 0 0 16px;">Dear ${escapeHtml(recipientName || 'Researcher')},</p>
      <p style="margin: 0 0 16px;">Your supervisor (${escapeHtml(supervisorEmail || '')}) has <strong>${decision === 'approved' ? 'approved' : 'rejected'}</strong> the submission:</p>
      <p style="margin: 16px 0; padding: 16px; background-color: #f8f9fa; border-left: 4px solid ${decision === 'approved' ? '#27ae60' : '#c0392b'}; border-radius: 4px;"><strong>${escapeHtml(title || 'Untitled')}</strong></p>
      <p style="margin: 24px 0 0;">Sincerely,<br/><strong>${appName} Team</strong></p>
    `,
  }),
  piDeclarationApprovalRequest: (piName, submitterName, title, approveUrl, rejectUrl, appName) => ({
    subject: `Research Declaration Approval Requested - ${appName}`,
    content: `
      <p style="margin: 0 0 16px;">Dear ${escapeHtml(piName || 'Principal Investigator')},</p>
      <p style="margin: 0 0 16px;">${escapeHtml(submitterName || 'A researcher')} has named you as the Principal Investigator on the following research submission and requests your approval of the Declaration of Investigator:</p>
      <p style="margin: 16px 0; padding: 16px; background-color: #f8f9fa; border-left: 4px solid #2980b9; border-radius: 4px;"><strong>${escapeHtml(title || 'Untitled')}</strong></p>
      <p style="margin: 0 0 16px;">By approving, you certify that the information in this application is correct and a true representation of the research to be undertaken. Please confirm your decision:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 8px 0;">
        <tr>
          <td style="padding-right: 12px;">
            <a href="${approveUrl}" style="display: inline-block; padding: 12px 28px; background-color: #27ae60; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">Approve</a>
          </td>
          <td>
            <a href="${rejectUrl}" style="display: inline-block; padding: 12px 28px; background-color: #c0392b; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">Disapprove</a>
          </td>
        </tr>
      </table>
      <p style="margin: 16px 0 0; font-size: 13px; color: #7f8c8d;">Review of this submission cannot begin until you record your decision. If you did not expect this request, you may ignore this email.</p>
      <p style="margin: 24px 0 0;">Sincerely,<br/><strong>${appName} Team</strong></p>
    `,
  }),
  piDeclarationDecisionNotice: (recipientName, title, decision, piEmail, appName) => ({
    subject: `Principal Investigator ${decision === 'approved' ? 'Approved' : 'Disapproved'} the Declaration - ${appName}`,
    content: `
      <p style="margin: 0 0 16px;">Dear ${escapeHtml(recipientName || 'Researcher')},</p>
      <p style="margin: 0 0 16px;">The Principal Investigator (${escapeHtml(piEmail || '')}) has <strong>${decision === 'approved' ? 'approved' : 'disapproved'}</strong> the Declaration of Investigator for the submission:</p>
      <p style="margin: 16px 0; padding: 16px; background-color: #f8f9fa; border-left: 4px solid ${decision === 'approved' ? '#27ae60' : '#c0392b'}; border-radius: 4px;"><strong>${escapeHtml(title || 'Untitled')}</strong></p>
      ${decision === 'approved' ? '<p style="margin: 0 0 16px;">The submission can now proceed to review.</p>' : ''}
      <p style="margin: 24px 0 0;">Sincerely,<br/><strong>${appName} Team</strong></p>
    `,
  }),
  reviewerAssignmentRequest: (reviewerName, title, acceptUrl, rejectUrl, appName) => ({
    subject: `Review Request - ${appName}`,
    content: `
      <p style="margin: 0 0 16px;">Dear ${escapeHtml(reviewerName || 'Reviewer')},</p>
      <p style="margin: 0 0 16px;">You have been requested to review the following research submission:</p>
      <p style="margin: 16px 0; padding: 16px; background-color: #f8f9fa; border-left: 4px solid #2980b9; border-radius: 4px;"><strong>${escapeHtml(title || 'Untitled')}</strong></p>
      <p style="margin: 0 0 16px;">Please accept or decline this review request:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 8px 0;">
        <tr>
          <td style="padding-right: 12px;">
            <a href="${acceptUrl}" style="display: inline-block; padding: 12px 28px; background-color: #27ae60; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">Accept</a>
          </td>
          <td>
            <a href="${rejectUrl}" style="display: inline-block; padding: 12px 28px; background-color: #c0392b; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">Decline</a>
          </td>
        </tr>
      </table>
      <p style="margin: 16px 0 0; font-size: 13px; color: #7f8c8d;">If you decline, the administrator will assign the review to another reviewer.</p>
      <p style="margin: 24px 0 0;">Sincerely,<br/><strong>${appName} Team</strong></p>
    `,
  }),
  reviewerRejectedAssignment: (adminName, reviewerName, title, appName) => ({
    subject: `Reviewer Declined a Review - ${appName}`,
    content: `
      <p style="margin: 0 0 16px;">Dear ${escapeHtml(adminName || 'Admin')},</p>
      <p style="margin: 0 0 16px;"><strong>${escapeHtml(reviewerName || 'A reviewer')}</strong> has declined the review request for:</p>
      <p style="margin: 16px 0; padding: 16px; background-color: #f8f9fa; border-left: 4px solid #c0392b; border-radius: 4px;"><strong>${escapeHtml(title || 'Untitled')}</strong></p>
      <p style="margin: 0 0 16px;">The submission is now unassigned. Please assign it to another reviewer.</p>
      <p style="margin: 24px 0 0;">Sincerely,<br/><strong>${appName} Team</strong></p>
    `,
  }),
  submissionAcknowledgment: (recipientName, title, receivedDateStr) => {
    const safeTitle = escapeHtml(title);
    return {
      subject: 'Acknowledgment of Proposal Submission',
      content: `
      <p style="margin: 0 0 16px;">Dear ${escapeHtml(recipientName)},</p>
      <p style="margin: 0 0 16px;">This is to confirm that your research proposal entitled &ldquo;<strong>${safeTitle}</strong>&rdquo; was received by the Medical Research Ethics Committee at the Medical City for Military and Security Services (MCMSS) on <strong>${escapeHtml(receivedDateStr)}</strong>.</p>
      <p style="margin: 0 0 16px;">Your submission will undergo formal review by the Committee.</p>
      <p style="margin: 0 0 16px;">You will be notified of the outcome by email within 4-6 weeks of the submission date.</p>
      <p style="margin: 0 0 16px;">Kindly refrain from contacting the Ethics Committee (via phone, email, or text) regarding the proposal status before the 4-6-week review period has elapsed, as all updates will be communicated once the review is complete.</p>
      <p style="margin: 0 0 16px;">If additional information is required during the review process, the Committee will contact you directly.</p>
      <p style="margin: 24px 0 0;">Best regards,<br/><strong>Medical Research Ethics Committee</strong><br/>Medical City for Military and Security Services<br/>Muscat, Oman</p>
    `,
    };
  },
  revisionReminder: (name, title, deadlineStr, daysLeft, reviseUrl, appName) => ({
    subject: `Reminder: Revisions Due in ${daysLeft} Day${daysLeft === 1 ? '' : 's'} - ${appName}`,
    content: `
      <p style="margin: 0 0 16px;">Dear ${escapeHtml(name)},</p>
      <p style="margin: 0 0 16px;">This is a reminder that your submission "<strong>${escapeHtml(title)}</strong>" requires revisions.</p>
      <p style="margin: 16px 0; padding: 16px; background-color: #fff8e1; border-left: 4px solid #f39c12; border-radius: 4px;">
        <strong>${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong> remaining. The deadline is <strong>${escapeHtml(deadlineStr)}</strong>.
      </p>
      <p style="margin: 0 0 16px;">If the revised submission is not resubmitted before the deadline, the form will be automatically cancelled (archived).</p>
      <p style="margin: 24px 0;"><a href="${reviseUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2980b9; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">Revise Submission</a></p>
      <p style="margin: 24px 0 0;">Sincerely,<br/><strong>${appName} Team</strong></p>
    `,
  }),
  revisionArchived: (name, title, proposalNo, appName) => ({
    subject: `Application Closed - Revision Deadline Passed - ${appName}`,
    content: `
      <p style="margin: 0 0 16px;">Dear ${escapeHtml(name)},</p>
      <p style="margin: 0 0 16px;">This is to inform you that more than 30 days have passed since the ethics committee requested revisions to your study titled &ldquo;<strong>${escapeHtml(title)}</strong>&rdquo;${proposalNo ? ` [${escapeHtml(proposalNo)}]` : ''}. As we have not received the revised documents within this period, the original application is now considered closed according to our committee procedures.</p>
      <p style="margin: 0 0 16px;">Any further submission related to this project will need to be submitted as a new application and will undergo the full ethics review process from the beginning.</p>
      <p style="margin: 0 0 16px;">If you plan to re-submit, please ensure that all required documents are updated in line with the previous reviewer comments and current guidelines. Our office will be happy to clarify any procedural questions you may have.</p>
      <p style="margin: 24px 0 0;">Sincerely,<br/><strong>Medical Research Ethics Committee</strong><br/>Medical City for Military and Security Services<br/>Muscat, Oman</p>
    `,
  }),
  approvalGranted: (name, appName) => ({
    subject: `Research Ethics Approval Granted - ${appName}`,
    content: `
      <p style="margin: 0 0 16px;">Dear ${escapeHtml(name)},</p>
      <p style="margin: 0 0 16px;">Thank you for submitting your research proposal for ethical review. The Ethics Committee at the Medical City for Military and Security Services (MCMSS) has completed its evaluation and has <strong>APPROVED</strong> your research protocol. This approval is granted according to the details provided in your application and is subject to the following conditions:</p>
      <ul style="margin: 0 0 16px; padding-left: 20px; color: #2c3e50;">
        <li style="margin: 0 0 8px;">All data collection and procedures are conducted in strict adherence to the approved research protocol.</li>
        <li style="margin: 0 0 8px;">Any amendments to the research design and changes to the project must be relayed to the Ethics Committee for approval prior to its&rsquo; implementation.</li>
        <li style="margin: 0 0 8px;">Any event which may affect the ethical acceptability of the study (adverse events, unexpected outcomes, or new information related to the study) must be reported to the Ethics Committee as soon as possible.</li>
        <li style="margin: 0 0 8px;">Please notify the Ethics Committee upon completion of the research study.</li>
        <li style="margin: 0 0 8px;">Please apply for extension if the research study is not complete by the date of study completion entered in the ethics approval form.</li>
      </ul>
      <p style="margin: 0 0 16px;">Please log in to the platform to download the letter of approval from the Medical Research Ethics Committee.</p>
      <p style="margin: 24px 0 0;">Sincerely,<br/><strong>Medical Research Ethics Committee</strong><br/>Medical City for Military and Security Services<br/>Muscat, Oman</p>
    `,
  }),
  rejectionNotice: (name, title, proposalNo, appName) => ({
    subject: `Research Ethics Review Outcome - ${appName}`,
    content: `
      <p style="margin: 0 0 16px;">Dear ${escapeHtml(name)},</p>
      <p style="margin: 0 0 16px;">The Research Ethics Committee at MCMSS has reviewed your proposal entitled &ldquo;<strong>${escapeHtml(title)}</strong>&rdquo;${proposalNo ? ` [${escapeHtml(proposalNo)}]` : ''}. Following careful consideration, the Committee regrets to inform you that the proposal is not approved at this time.</p>
      <p style="margin: 0 0 16px;">The Committee appreciates the effort invested in the preparation of the proposal and thanks you for your interest in conducting research.</p>
      <p style="margin: 0 0 16px;">Please log in to the platform to view full details.</p>
      <p style="margin: 24px 0 0;">Sincerely,<br/><strong>Medical Research Ethics Committee</strong><br/>Medical City for Military and Security Services<br/>Muscat, Oman</p>
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

/* Asks a reviewer to accept or decline a review assignment via email links. */
export const sendReviewerAssignmentEmail = async (reviewerEmail, reviewerName, title, acceptUrl, rejectUrl) => {
  if (!reviewerEmail) return { sent: false, messageId: null };
  const { subject, content } = templates.reviewerAssignmentRequest(reviewerName, title, acceptUrl, rejectUrl, BRANDING.appName);
  return sendEmail({ to: reviewerEmail, subject, html: getEmailLayout(content) });
};

/* Notifies the admin that a reviewer declined an assignment. */
export const sendReviewerRejectedAdminEmail = async (adminEmail, adminName, reviewerName, title) => {
  if (!adminEmail) return { sent: false, messageId: null };
  const { subject, content } = templates.reviewerRejectedAssignment(adminName, reviewerName, title, BRANDING.appName);
  return sendEmail({ to: adminEmail, subject, html: getEmailLayout(content) });
};

export const sendSubmissionStatusEmail = async (email, name, submissionTitle, status, piEmailRaw) => {
  const { subject, content } = templates.submissionStatusUpdate(name, submissionTitle, status, BRANDING.appName);
  const piEmail = typeof piEmailRaw === 'string' ? piEmailRaw.trim().toLowerCase() : '';
  const submitterLower = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const cc =
    piEmail && EMAIL_RE.test(piEmail) && piEmail !== submitterLower ? piEmail : undefined;
  return sendEmail({ to: email, cc, subject, html: getEmailLayout(content) });
};

/* Emails the supervisor an approval request with approve/reject links. */
export const sendSupervisorApprovalEmail = async (
  supervisorEmail,
  supervisorName,
  studentName,
  title,
  approveUrl,
  rejectUrl
) => {
  if (!supervisorEmail) return { sent: false, messageId: null };
  const { subject, content } = templates.supervisorApprovalRequest(
    supervisorName,
    studentName,
    title,
    approveUrl,
    rejectUrl,
    BRANDING.appName
  );
  return sendEmail({ to: supervisorEmail, subject, html: getEmailLayout(content) });
};

/* Notifies the submitter of the supervisor's decision. */
export const sendSupervisorDecisionEmail = async (email, name, title, decision, supervisorEmail) => {
  if (!email) return { sent: false, messageId: null };
  const { subject, content } = templates.supervisorDecisionNotice(
    name,
    title,
    decision,
    supervisorEmail,
    BRANDING.appName
  );
  return sendEmail({ to: email, subject, html: getEmailLayout(content) });
};

export const sendPiDeclarationApprovalEmail = async (
  piEmail,
  piName,
  submitterName,
  title,
  approveUrl,
  rejectUrl
) => {
  if (!piEmail) return { sent: false, messageId: null };
  const { subject, content } = templates.piDeclarationApprovalRequest(
    piName,
    submitterName,
    title,
    approveUrl,
    rejectUrl,
    BRANDING.appName
  );
  return sendEmail({ to: piEmail, subject, html: getEmailLayout(content) });
};

/* Notifies the submitter of the Principal Investigator's declaration decision. */
export const sendPiDeclarationDecisionEmail = async (email, name, title, decision, piEmail) => {
  if (!email) return { sent: false, messageId: null };
  const { subject, content } = templates.piDeclarationDecisionNotice(
    name,
    title,
    decision,
    piEmail,
    BRANDING.appName
  );
  return sendEmail({ to: email, subject, html: getEmailLayout(content) });
};

/* Notifies the configured admin that a new form was submitted. */
export const sendNewSubmissionAdminEmail = async (
  adminEmail,
  adminName,
  { formType, title, applicantName, referenceId }
) => {
  if (!adminEmail) return { sent: false, messageId: null };
  const { subject, content } = templates.newSubmissionAdmin(
    adminName || 'Admin',
    formType,
    title,
    applicantName,
    referenceId,
    BRANDING.appName
  );
  return sendEmail({ to: adminEmail, subject, html: getEmailLayout(content) });
};

const EMAIL_RE = /^\S+@\S+\.\S+$/;

/**
 * Notifies the submitter and CCs the Principal Investigator (when a distinct valid email is on file).
 */
export const sendSubmissionAcknowledgmentEmail = async (
  submitterEmail,
  submitterName,
  researchTitle,
  submittedAt,
  piEmailRaw
) => {
  if (!submitterEmail) {
    return { sent: false, messageId: null };
  }
  const receivedDateStr = formatSubmissionReceivedDate(submittedAt);
  const { subject, content } = templates.submissionAcknowledgment(
    submitterName || 'Researcher',
    researchTitle || 'your proposal',
    receivedDateStr
  );
  const piEmail = typeof piEmailRaw === 'string' ? piEmailRaw.trim().toLowerCase() : '';
  const submitterLower = submitterEmail.trim().toLowerCase();
  const cc =
    piEmail && EMAIL_RE.test(piEmail) && piEmail !== submitterLower ? piEmail : undefined;

  return sendEmail({
    to: submitterEmail,
    cc,
    subject,
    html: getEmailLayout(content),
  });
};

/* Reminds the submitter to resubmit before the revision deadline. */
export const sendRevisionReminderEmail = async (email, name, title, deadline, daysLeft) => {
  if (!email) return { sent: false, messageId: null };
  const deadlineStr = formatSubmissionReceivedDate(deadline);
  const reviseUrl = `${config.app.frontendUrl}/dashboard`;
  const { subject, content } = templates.revisionReminder(
    name || 'Researcher',
    title || 'your submission',
    deadlineStr,
    daysLeft,
    reviseUrl,
    BRANDING.appName
  );
  return sendEmail({ to: email, subject, html: getEmailLayout(content) });
};

/* Notifies the submitter their application was closed after the revision deadline passed. */
export const sendRevisionArchivedEmail = async (email, name, title, proposalNo) => {
  if (!email) return { sent: false, messageId: null };
  const { subject, content } = templates.revisionArchived(
    name || 'Researcher',
    title || 'your submission',
    proposalNo || '',
    BRANDING.appName
  );
  return sendEmail({ to: email, subject, html: getEmailLayout(content) });
};

/* Notifies the submitter that ethics approval was granted. CCs the PI when distinct. */
export const sendApprovalGrantedEmail = async (email, name, piEmailRaw) => {
  if (!email) return { sent: false, messageId: null };
  const { subject, content } = templates.approvalGranted(name || 'Researcher', BRANDING.appName);
  const piEmail = typeof piEmailRaw === 'string' ? piEmailRaw.trim().toLowerCase() : '';
  const submitterLower = email.trim().toLowerCase();
  const cc = piEmail && EMAIL_RE.test(piEmail) && piEmail !== submitterLower ? piEmail : undefined;
  return sendEmail({ to: email, cc, subject, html: getEmailLayout(content) });
};

/* Notifies the submitter that the proposal was not approved. CCs the PI when distinct. */
export const sendRejectionNoticeEmail = async (email, name, title, proposalNo, piEmailRaw) => {
  if (!email) return { sent: false, messageId: null };
  const { subject, content } = templates.rejectionNotice(
    name || 'Researcher',
    title || 'your proposal',
    proposalNo || '',
    BRANDING.appName
  );
  const piEmail = typeof piEmailRaw === 'string' ? piEmailRaw.trim().toLowerCase() : '';
  const submitterLower = email.trim().toLowerCase();
  const cc = piEmail && EMAIL_RE.test(piEmail) && piEmail !== submitterLower ? piEmail : undefined;
  return sendEmail({ to: email, cc, subject, html: getEmailLayout(content) });
};
