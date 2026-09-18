export const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (err.name !== 'TokenExpiredError' && err.name !== 'JsonWebTokenError' && err.statusCode !== 401) {
    import('fs').then(fs => {
      const errorLog = `[${new Date().toISOString()}] Error 💥: ${err.stack || err}\n`;
      try { fs.appendFileSync('api-error.log', errorLog); } catch (e) {}
    });
    console.error('Error 💥:', err);
  }

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

  // Return operational or general error with descriptive message
  res.status(err.statusCode || 500).json({
    status: err.status || 'error',
    message: err.message || 'Internal Server Error',
  });
};
