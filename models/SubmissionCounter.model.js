import mongoose from 'mongoose';

const submissionCounterSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    sequence: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

const SubmissionCounter = mongoose.model('SubmissionCounter', submissionCounterSchema);
export default SubmissionCounter;
