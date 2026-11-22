/**
 * Application error carrying an HTTP status and an optional machine-readable
 * code / details. The central error handler in app.js serialises it as
 * { error, code?, details? }.
 */
class AppError extends Error {
  constructor(status, message, { code, details } = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const validationError = (details) => new AppError(400, 'Validation failed', { details });
const notFound = (message) => new AppError(404, message);

module.exports = { AppError, validationError, notFound };
