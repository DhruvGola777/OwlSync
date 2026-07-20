export const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  import('fs').then(fs => {
    const errorLog = `[${new Date().toISOString()}] Error 💥: ${err.stack || err}\n`;
    try { fs.appendFileSync('api-error.log', errorLog); } catch (e) {}
  });
  console.error('Error 💥:', err);

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    return res.status(400).json({
      status: 'fail',
      message: 'Validation Error',
      errors: err.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message
      }))
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: 'fail',
      message: 'Invalid token. Please log in again.'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      status: 'fail',
      message: 'Your token has expired. Please log in again.'
    });
  }

  if (err.isOperational) {
    // Operational, trusted error: send message to client
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message
    });
  }
  
  // Programming or other unknown error: don't leak error details
  res.status(500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went very wrong!'
  });
};
