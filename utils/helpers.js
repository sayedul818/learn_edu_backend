/**
 * Utility Functions for Backend API
 */

/**
 * Consistent error response format
 */
const errorResponse = (res, statusCode, message, error = null) => {
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(error && { details: error })
  });
};

/**
 * Consistent success response format
 */
const successResponse = (res, statusCode, data, message = null, count = null) => {
  const response = {
    success: true,
    ...(message && { message }),
    ...(count !== null && { count }),
    data,
  };
  res.status(statusCode).json(response);
};

/**
 * Validate ObjectId format
 */
const isValidObjectId = (id) => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

/**
 * Build filter object from query params
 */
const buildFilter = (query, allowedFields) => {
  const filter = {};
  
  for (const field of allowedFields) {
    if (query[field]) {
      filter[field] = query[field];
    }
  }
  
  return filter;
};

/**
 * Parse pagination parameters
 */
const getPagination = (query, defaultLimit = 10) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, parseInt(query.limit) || defaultLimit);
  const skip = (page - 1) * limit;
  
  return { page, limit, skip };
};

/**
 * Validate required fields
 */
const validateRequired = (data, fields) => {
  const missing = [];
  
  for (const field of fields) {
    if (!data[field]) {
      missing.push(field);
    }
  }
  
  return missing;
};

/**
 * Safe JSON parse
 */
const safeJsonParse = (json, fallback = null) => {
  try {
    return JSON.parse(json);
  } catch (error) {
    return fallback;
  }
};

module.exports = {
  errorResponse,
  successResponse,
  isValidObjectId,
  buildFilter,
  getPagination,
  validateRequired,
  safeJsonParse,
};
