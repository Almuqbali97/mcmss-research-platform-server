import { config } from '../config/index.js';
import { errorResponse } from '../utils/apiResponse.js';

export const notFound = (req, res, next) => {
  return errorResponse(res, `Route ${req.originalUrl} not found.`, 404);
};

export const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.message = err.message || 'Internal Server Error';

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    return errorResponse(res, 'Validation failed.', 400, errors);
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return errorResponse(res, `${field} already exists.`, 400);
  }

  if (err.name === 'JsonWebTokenError') {
    return errorResponse(res, 'Invalid token.', 401);
  }
  if (err.name === 'TokenExpiredError') {
    return errorResponse(res, 'Token expired.', 401);
  }

  if (config.nodeEnv === 'development') {
    console.error('Error:', err);
  }

  return errorResponse(res, err.message, err.statusCode);
};
