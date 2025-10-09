/**
 * Global error handler middleware
 * Catches all errors and sends appropriate responses without leaking sensitive info
 */
const errorHandler = (err, req, res, next) => {
  // Log error details (but not in production to avoid leaking info)
  if (process.env.NODE_ENV !== 'production') {
    console.error('===== ERROR DETAILS =====');
    console.error('Message:', err.message);
    console.error('Stack:', err.stack);
    console.error('Path:', req.path);
    console.error('Method:', req.method);
    console.error('Body:', JSON.stringify(req.body, null, 2));
    console.error('Query:', JSON.stringify(req.query, null, 2));
    console.error('Params:', JSON.stringify(req.params, null, 2));
    console.error('========================');
  } else {
    // In production, just log the error type without sensitive details
    console.error(`[${new Date().toISOString()}] ${err.name || 'Error'}: ${err.message}`);
  }

  // Default error values
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal server error';
  let errorType = err.name || 'Error';

  // ===== PRISMA ERRORS =====
  
  // Unique constraint violation (duplicate value)
  if (err.code === 'P2002') {
    statusCode = 400;
    const field = err.meta?.target?.[0] || 'field';
    message = process.env.NODE_ENV === 'production'
      ? 'A record with that value already exists'
      : `${field} already exists`;
    errorType = 'DuplicateError';
  }

  // Record not found
  if (err.code === 'P2025') {
    statusCode = 404;
    message = 'Record not found';
    errorType = 'NotFoundError';
  }

  // Foreign key constraint failed
  if (err.code === 'P2003') {
    statusCode = 400;
    message = 'Invalid reference to related record';
    errorType = 'ForeignKeyError';
  }

  // Required field missing
  if (err.code === 'P2011') {
    statusCode = 400;
    message = 'Required field is missing';
    errorType = 'ValidationError';
  }

  // Invalid data type
  if (err.code === 'P2006') {
    statusCode = 400;
    message = 'Invalid data provided';
    errorType = 'ValidationError';
  }

  // Generic Prisma error
  if (err.code?.startsWith('P')) {
    statusCode = 400;
    message = process.env.NODE_ENV === 'production'
      ? 'Database operation failed'
      : `Database error: ${err.message}`;
    errorType = 'DatabaseError';
  }

  // ===== VALIDATION ERRORS =====
  
  // Express-validator or custom validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorType = 'ValidationError';
    
    // Mongoose validation error format
    if (err.errors) {
      const validationErrors = Object.values(err.errors).map(e => e.message);
      message = validationErrors.join(', ');
    }
  }

  // ===== JWT ERRORS =====
  
  // Invalid JWT token
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
    errorType = 'AuthenticationError';
  }

  // Expired JWT token
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired';
    errorType = 'AuthenticationError';
  }

  // Token not yet valid
  if (err.name === 'NotBeforeError') {
    statusCode = 401;
    message = 'Token not yet valid';
    errorType = 'AuthenticationError';
  }

  // ===== MONGODB/MONGOOSE ERRORS =====
  
  // Duplicate key error (MongoDB)
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    message = `${field} already exists`;
    errorType = 'DuplicateError';
  }

  // Invalid ObjectId format
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path} format`;
    errorType = 'ValidationError';
  }

  // ===== NETWORK/CORS ERRORS =====
  
  // CORS error
  if (err.message === 'Not allowed by CORS') {
    statusCode = 403;
    message = 'Request blocked by CORS policy';
    errorType = 'CORSError';
  }

  // ===== RATE LIMITING ERRORS =====
  
  // Rate limit exceeded
  if (err.message?.includes('Too many requests') || err.message?.includes('Too many attempts')) {
    statusCode = 429;
    message = err.message || 'Too many requests, please try again later';
    errorType = 'RateLimitError';
  }

  // ===== FILE UPLOAD ERRORS =====
  
  // File too large
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    message = 'File size exceeds the maximum allowed limit';
    errorType = 'FileSizeError';
  }

  // File type not allowed
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400;
    message = 'Invalid file type or field name';
    errorType = 'FileTypeError';
  }

  // ===== HTTP ERRORS =====
  
  // Bad request
  if (statusCode === 400 && !message) {
    message = 'Bad request';
  }

  // Unauthorized
  if (statusCode === 401 && !message) {
    message = 'Authentication required';
  }

  // Forbidden
  if (statusCode === 403 && !message) {
    message = 'Access forbidden';
  }

  // Not found
  if (statusCode === 404 && !message) {
    message = 'Resource not found';
  }

  // ===== PREPARE RESPONSE =====
  
  const errorResponse = {
    success: false,
    error: errorType,
    message: process.env.NODE_ENV === 'production' 
      ? message // In production, use sanitized message
      : err.message || message, // In development, show actual error
  };

  // Include additional details in development
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.stack = err.stack;
    errorResponse.path = req.path;
    errorResponse.method = req.method;
    
    // Include Prisma meta data if available
    if (err.meta) {
      errorResponse.meta = err.meta;
    }
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler
 * Use this as the last route before error handler
 */
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  error.name = 'NotFoundError';
  next(error);
};

/**
 * Async error wrapper
 * Wraps async route handlers to automatically catch errors
 * 
 * Usage:
 * router.get('/path', asyncHandler(async (req, res) => {
 *   const data = await someAsyncOperation();
 *   res.json(data);
 * }));
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Custom error class for creating consistent errors
 * 
 * Usage:
 * throw new AppError('User not found', 404);
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = errorHandler;
module.exports.notFoundHandler = notFoundHandler;
module.exports.asyncHandler = asyncHandler;
module.exports.AppError = AppError;