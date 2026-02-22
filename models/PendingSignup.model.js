import mongoose from 'mongoose';

const pendingSignupSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      unique: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['researcher', 'reviewer', 'admin'],
      default: 'researcher',
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 },
    },
  },
  { timestamps: true }
);

const PendingSignup = mongoose.model('PendingSignup', pendingSignupSchema);
export default PendingSignup;
