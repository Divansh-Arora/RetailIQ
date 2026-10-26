import { AppError } from '../utils/errors.js';

const DUP_MESSAGES = {
  uq_products_sku: ['DUPLICATE_SKU', 'A product with this SKU already exists.'],
  uq_customers_email: ['DUPLICATE_EMAIL', 'A customer with this email already exists.'],
  uq_categories_name: ['DUPLICATE_CATEGORY', 'A category with this name already exists.'],
};

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: `No route for ${req.method} ${req.path}.` } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } });
  }
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' } });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' } });

  switch (err?.errno) {
    case 1062: { // duplicate key
      const key = Object.keys(DUP_MESSAGES).find((k) => String(err.sqlMessage || '').includes(k));
      const [code, message] = key ? DUP_MESSAGES[key] : ['DUPLICATE_ENTRY', 'A record with the same unique value already exists.'];
      return res.status(409).json({ error: { code, message } });
    }
    case 1452: return res.status(400).json({ error: { code: 'INVALID_REFERENCE', message: 'A referenced record does not exist.' } });
    case 1451: return res.status(409).json({ error: { code: 'RECORD_IN_USE', message: 'This record is referenced by other data and cannot be removed.' } });
    case 3819: return res.status(400).json({ error: { code: 'CONSTRAINT_VIOLATION', message: 'A value violates a data rule (for example a negative price or stock).' } });
    case 1213: return res.status(503).json({ error: { code: 'TRY_AGAIN', message: 'The system was busy. Please retry the request.' } });
    default: break;
  }
  // Log only non-sensitive fields: never the SQL text, params or stack to the client.
  console.error(`[error] ${req.method} ${req.originalUrl} -> ${err?.code || err?.name || 'Error'}: ${err?.message}`);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side. Please try again.' } });
}
