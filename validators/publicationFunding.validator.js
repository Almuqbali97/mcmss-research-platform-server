import Joi from 'joi';

const sectionsSchema = Joi.object({
  section1: Joi.boolean(),
  section2: Joi.boolean(),
  section3: Joi.boolean(),
  section4: Joi.boolean(),
  section5: Joi.boolean(),
  section6: Joi.boolean(),
  section7: Joi.boolean(),
  section8: Joi.boolean(),
  section9: Joi.boolean(),
});

export const createPublicationFundingSchema = Joi.object({
  manuscriptTitle: Joi.string().trim().required(),
  applicantName: Joi.string().trim().required(),
  formData: Joi.object().unknown(true),
  status: Joi.string().valid('draft', 'under_review').optional(),
  sections: sectionsSchema,
});

export const updatePublicationFundingSchema = Joi.object({
  manuscriptTitle: Joi.string().trim(),
  applicantName: Joi.string().trim(),
  formData: Joi.object().unknown(true),
  status: Joi.string().valid('draft').optional(),
  sections: sectionsSchema,
}).min(1);

export const assignReviewerSchema = Joi.object({
  reviewerId: Joi.string().hex().length(24).required(),
});

export const submitReviewSchema = Joi.object({
  status: Joi.string().valid('approved', 'rejected', 'revisions_required').required(),
  comments: Joi.string().allow(''),
});

export const committeeReviewSchema = Joi.object({
  committeeReview: Joi.object({
    applicationReceivedOn: Joi.string().allow(''),
    reviewedBy: Joi.string().allow(''),
    journalQualityVerified: Joi.string().valid('Yes', 'No', '').allow(''),
    authorshipEligibilityVerified: Joi.string().valid('Yes', 'No', '').allow(''),
    ethicalComplianceVerified: Joi.string().valid('Yes', 'No', '').allow(''),
    recommendedForFunding: Joi.string().valid('Yes', 'No', '').allow(''),
    approvedAmount: Joi.string().allow(''),
    comments: Joi.string().allow(''),
    finalDecision: Joi.string().allow(''),
    dateOfDecision: Joi.string().allow(''),
  }).required(),
});
