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
      enum: ['draft', 'under_review', 'approved', 'rejected', 'revisions_required', 'conditional_minor', 'major_revisions', 'archived'],
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
      enum: ['pending', 'approved', 'rejected', 'revisions_required', 'conditional_minor', 'major_revisions'],
      default: null,
    },
    reviewComments: {
      type: String,
    },
    reviewerAcceptance: {
      status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: null,
      },
      token: { type: String, default: null, select: false },
      decidedAt: { type: Date, default: null },
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
    piDeclarationApproval: {
      email: { type: String, default: null },
      token: { type: String, default: null, select: false },
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: null,
      },
      decidedAt: { type: Date, default: null },
    },
    // Tracks the revision cycle: round 1 grants 30 days, round 2+ grants a
    // reviewer-chosen 1 or 2 weeks. Past the deadline the submission is archived.
    revision: {
      round: { type: Number, default: 0 },
      startedAt: { type: Date, default: null },
      deadline: { type: Date, default: null },
      firstReminderSent: { type: Boolean, default: false },
      finalReminderSent: { type: Boolean, default: false },
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
