import Joi from 'joi';

export const createReviewerSchema = Joi.object({
  userId: Joi.string().hex().length(24).required(),
  specialization: Joi.string().trim().allow(''),
});

export const updateReviewerSchema = Joi.object({
  specialization: Joi.string().trim().allow(''),
}).min(1);
