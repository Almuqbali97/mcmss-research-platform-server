import Joi from 'joi';

export const createSubmissionSchema = Joi.object({
  researchTitle: Joi.string().trim().required(),
  principalInvestigator: Joi.string().trim().required(),
  formData: Joi.object().unknown(true),
  data: Joi.object().unknown(true),
  status: Joi.string().valid('draft').optional(),
  sections: Joi.object({
    section1: Joi.boolean(),
    section2: Joi.boolean(),
    section3: Joi.boolean(),
    section4: Joi.boolean(),
    section5: Joi.boolean(),
    section6: Joi.boolean(),
    section7: Joi.boolean(),
  }),
});

export const updateSubmissionSchema = Joi.object({
  researchTitle: Joi.string().trim(),
  principalInvestigator: Joi.string().trim(),
  formData: Joi.object().unknown(true),
  data: Joi.object().unknown(true),
  status: Joi.string().valid('draft', 'revisions_required').optional(),
  sections: Joi.object({
    section1: Joi.boolean(),
    section2: Joi.boolean(),
    section3: Joi.boolean(),
    section4: Joi.boolean(),
    section5: Joi.boolean(),
    section6: Joi.boolean(),
    section7: Joi.boolean(),
  }),
}).min(1);

export const assignReviewerSchema = Joi.object({
  reviewerId: Joi.string().hex().length(24).required(),
});

export const submitReviewSchema = Joi.object({
  status: Joi.string().valid('approved', 'rejected', 'revisions_required').required(),
  comments: Joi.string().allow(''),
});

export const fieldCommentsSchema = Joi.object({
  fieldComments: Joi.object().pattern(
    Joi.string().valid('introduction', 'objectives', 'targetPopulation', 'methodology', 'statisticalAnalysis', 'intervention', 'expectedOutcomes', 'references'),
    Joi.string().allow('')
  ).required(),
});
