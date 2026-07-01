import Setting from '../models/Setting.model.js';
import { sendNewSubmissionAdminEmail, sendReviewerRejectedAdminEmail } from './email.service.js';

/**
 * Emails the admin configured in settings that a new form has been submitted.
 * No-op when no recipient is configured. Never throws.
 */
export const notifyAdminOfSubmission = async ({ formType, title, applicantName, referenceId }) => {
  try {
    const setting = await Setting.getGlobal();
    await setting.populate('submissionNotificationRecipient', 'firstName lastName email');
    const recipient = setting.submissionNotificationRecipient;
    if (!recipient?.email) return;

    const adminName = `${recipient.firstName || ''} ${recipient.lastName || ''}`.trim();
    await sendNewSubmissionAdminEmail(recipient.email, adminName, {
      formType,
      title,
      applicantName,
      referenceId,
    });
  } catch (err) {
    console.error('Admin submission notification failed:', err.message);
  }
};

/**
 * Emails the configured admin that a reviewer declined a review assignment.
 * No-op when no recipient is configured. Never throws.
 */
export const notifyAdminOfReviewerRejection = async ({ reviewerName, title }) => {
  try {
    const setting = await Setting.getGlobal();
    await setting.populate('submissionNotificationRecipient', 'firstName lastName email');
    const recipient = setting.submissionNotificationRecipient;
    if (!recipient?.email) return;

    const adminName = `${recipient.firstName || ''} ${recipient.lastName || ''}`.trim();
    await sendReviewerRejectedAdminEmail(recipient.email, adminName, reviewerName, title);
  } catch (err) {
    console.error('Reviewer rejection notification failed:', err.message);
  }
};
