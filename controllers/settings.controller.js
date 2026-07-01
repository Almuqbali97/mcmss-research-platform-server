import Setting from '../models/Setting.model.js';
import User from '../models/User.model.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

/* List active admin accounts (for choosing a notification recipient). */
export const getAdminUsers = async (req, res, next) => {
  try {
    const admins = await User.find({ role: 'admin', isActive: true })
      .select('firstName lastName email')
      .sort({ firstName: 1 });
    return successResponse(res, admins);
  } catch (error) {
    next(error);
  }
};

/* Read the notification settings. */
export const getNotificationSettings = async (req, res, next) => {
  try {
    const setting = await Setting.getGlobal();
    await setting.populate('submissionNotificationRecipient', 'firstName lastName email');
    return successResponse(res, {
      submissionNotificationRecipient: setting.submissionNotificationRecipient || null,
    });
  } catch (error) {
    next(error);
  }
};

/* Update which admin receives submission notifications. */
export const updateNotificationSettings = async (req, res, next) => {
  try {
    const { submissionNotificationRecipient } = req.body;

    let recipientId = null;
    if (submissionNotificationRecipient) {
      const recipient = await User.findById(submissionNotificationRecipient);
      if (!recipient || recipient.role !== 'admin' || !recipient.isActive) {
        return errorResponse(res, 'Selected recipient must be an active admin account.', 400);
      }
      recipientId = recipient._id;
    }

    const setting = await Setting.getGlobal();
    setting.submissionNotificationRecipient = recipientId;
    await setting.save();
    await setting.populate('submissionNotificationRecipient', 'firstName lastName email');

    return successResponse(
      res,
      { submissionNotificationRecipient: setting.submissionNotificationRecipient || null },
      'Notification settings updated.'
    );
  } catch (error) {
    next(error);
  }
};
