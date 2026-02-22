import mongoose from 'mongoose';

const reviewerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Reviewer name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Reviewer email is required'],
      lowercase: true,
      trim: true,
    },
    specialization: {
      type: String,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

reviewerSchema.index({ email: 1 });
reviewerSchema.index({ userId: 1 });

const Reviewer = mongoose.model('Reviewer', reviewerSchema);
export default Reviewer;
