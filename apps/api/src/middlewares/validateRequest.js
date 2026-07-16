const validateRequest = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (err) {
    next(err); // This will be caught by the global error handler
  }
};

export default validateRequest;
