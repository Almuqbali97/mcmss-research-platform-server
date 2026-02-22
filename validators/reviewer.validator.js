import Joi from 'joi';

export const createReviewerSchema = Joi.object({
  name: Joi.string().trim().required(),
  email: Joi.string().email().lowercase().required(),
  specialization: Joi.string().trim().allow(''),
});

export const updateReviewerSchema = Joi.object({
  name: Joi.string().trim(),
  email: Joi.string().email().lowercase(),
  specialization: Joi.string().trim().allow(''),
  isActive: Joi.boolean(),
}).min(1);
