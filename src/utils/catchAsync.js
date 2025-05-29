/**
 * Wraps an async function to catch any errors and pass them to Express error handling middleware
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware function
 */
export const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      next(err);
    });
  };
}; 