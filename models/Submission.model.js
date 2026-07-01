import mongoose from 'mongoose';

const sectionSchema = new mongoose.Schema({
  section1: { type: Boolean, default: false },
  section2: { type: Boolean, default: false },
  section3: { type: Boolean, default: false },
  section4: { type: Boolean, default: false },
  section5: { type: Boolean, default: false },
  section6: { type: Boolean, default: false },
  section7: { type: Boolean, default: false },
});

const submissionSchema = new mongoose.Schema(
  {
    submissionId: {
      type: String,
      required: true,
      unique: true,
    },
    researchTitle: {
      type: String,
      required: [true, 'Research title is required'],
    },
    principalInvestigator: {
      type: String,
      required: [true, 'Principal investigator is required'],
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'under_review', 'approved', 'rejected', 'revisions_required'],
      default: 'draft',
    },
    submittedDate: {
      type: Date,
    },
    assignedReviewer: {
      type: String,
      default: null,
    },
    assignedReviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reviewer',
      default: null,
    },
    reviewStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'revisions_required'],
      default: null,
    },
    reviewComments: {
      type: String,
    },
    supervisorApproval: {
      email: { type: String, default: null },
      token: { type: String, default: null, select: false },
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: null,
      },
      decidedAt: { type: Date, default: null },
    },
    fieldComments: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    sections: {
      type: sectionSchema,
      default: () => ({}),
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    formData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

submissionSchema.index({ submittedBy: 1 });
submissionSchema.index({ status: 1 });
submissionSchema.index({ assignedReviewerId: 1 });
submissionSchema.index({ submissionId: 1 });

const Submission = mongoose.model('Submission', submissionSchema);
export default Submission;
