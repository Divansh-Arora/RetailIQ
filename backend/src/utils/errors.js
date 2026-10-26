export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
export const notFound = (what, id) => new AppError(404, `${what.toUpperCase()}_NOT_FOUND`, `${what} ${id !== undefined ? `#${id} ` : ''}was not found.`);
