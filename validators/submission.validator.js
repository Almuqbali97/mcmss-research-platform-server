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
  status: Joi.string().valid('approved', 'rejected', 'conditional_minor', 'major_revisions').required(),
  comments: Joi.string().allow(''),
});

export const fieldCommentsSchema = Joi.object({
  fieldComments: Joi.object().pattern(
    Joi.string().valid(
      'introduction',
      'rationaleForStudy',
      'studyDesignSettingDuration',
      'objectives',
      'studyPopulationAndSampling',
      'sampleSize',
      'variables',
      'intervention',
      'statisticalAnalysis',
      'informedConsentProcess',
      'expectedOutcomes',
      'additionalComments',
      'references',
      // Legacy keys remain accepted so comments on older submissions are not lost.
      'targetPopulation',
      'methodology'
    ),
    Joi.string().allow('')
  ).required(),
});
