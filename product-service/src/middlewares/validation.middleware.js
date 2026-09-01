export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse({ body: req.body, params: req.params, query: req.query });
  if (!result.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: result.error.issues.map(({ path, message }) => ({ path, message })),
    });
  }
  req.validated = result.data;
  next();
};
