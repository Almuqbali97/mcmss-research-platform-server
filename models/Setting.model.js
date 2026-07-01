import mongoose from 'mongoose';

/**
 * Singleton settings document (key: 'global') holding platform-wide admin settings.
 */
const settingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'global',
    },
    // Admin user who receives a notification when a new form is submitted.
    submissionNotificationRecipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

settingSchema.statics.getGlobal = async function () {
  let doc = await this.findOne({ key: 'global' });
  if (!doc) {
    doc = await this.create({ key: 'global' });
  }
  return doc;
};

const Setting = mongoose.model('Setting', settingSchema);
export default Setting;
