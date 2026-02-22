import jwt from 'jsonwebtoken';
import User from '../models/User.model.js';
import { config } from '../config/index.js';
import { errorResponse } from '../utils/apiResponse.js';

export const authenticate = async (req, res, next) => {
  try {
    let token = req.headers.authorization;

    if (!token || !token.startsWith('Bearer ')) {
      return errorResponse(res, 'Access denied. No token provided.', 401);
    }

    token = token.split(' ')[1];

    const decoded = jwt.verify(token, config.jwt.secret);

    const user = await User.findById(decoded.userId).select('+refreshToken');
    if (!user) {
      return errorResponse(res, 'User not found. Token may be invalid.', 401);
    }

    if (!user.isActive) {
      return errorResponse(res, 'Account has been deactivated.', 403);
    }

    req.user = user;
    req.userId = user._id;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return errorResponse(res, 'Invalid token.', 401);
    }
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 'Token expired. Please log in again.', 401);
    }
    return errorResponse(res, 'Authentication failed.', 401);
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return next();

    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await User.findById(decoded.userId);
    if (user && user.isActive) {
      req.user = user;
      req.userId = user._id;
    }
    next();
  } catch {
    next();
  }
};
