const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found.",
  });
};

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  console.error(err);

  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal server error.",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

export { notFoundHandler, errorHandler };
