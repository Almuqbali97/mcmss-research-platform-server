import { errorResponse } from '../utils/apiResponse.js';

export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Authentication required.', 401);
    }

    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      return errorResponse(
        res,
        `Access denied. Required role(s): ${allowedRoles.join(', ')}`,
        403
      );
    }

    next();
  };
};
