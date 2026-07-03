import mongoose from 'mongoose';

const sectionSchema = new mongoose.Schema({
  section1: { type: Boolean, default: false },
  section2: { type: Boolean, default: false },
  section3: { type: Boolean, default: false },
  section4: { type: Boolean, default: false },
  section5: { type: Boolean, default: false },
  section6: { type: Boolean, default: false },
  section7: { type: Boolean, default: false },
  section8: { type: Boolean, default: false },
  section9: { type: Boolean, default: false },
});

const publicationFundingSchema = new mongoose.Schema(
  {
    applicationId: {
      type: String,
      required: true,
      unique: true,
    },
    manuscriptTitle: {
      type: String,
      required: [true, 'Manuscript title is required'],
    },
    applicantName: {
      type: String,
      required: [true, 'Applicant name is required'],
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
    reviewStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'revisions_required'],
      default: null,
    },
    reviewComments: {
      type: String,
    },
    formData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    committeeReview: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    sections: {
      type: sectionSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

publicationFundingSchema.index({ submittedBy: 1 });
publicationFundingSchema.index({ status: 1 });
publicationFundingSchema.index({ applicationId: 1 });

const PublicationFunding = mongoose.model('PublicationFunding', publicationFundingSchema);
export default PublicationFunding;
