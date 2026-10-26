import { AppError } from './errors.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isBlank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/** Collects field errors; call assert() to throw a single 400 VALIDATION_ERROR. */
export class Validator {
  constructor() { this.errors = []; }
  fail(field, message) { this.errors.push({ field, message }); }

  string(v, field, { required = false, min = 1, max = 255, def } = {}) {
    if (isBlank(v)) { if (required) this.fail(field, `${field} is required.`); return def; }
    if (typeof v !== 'string') { this.fail(field, `${field} must be text.`); return def; }
    const s = v.trim();
    if (s.length < min || s.length > max) { this.fail(field, `${field} must be ${min}-${max} characters.`); return def; }
    return s;
  }

  int(v, field, { required = false, min = -2147483648, max = 2147483647, def } = {}) {
    if (isBlank(v)) { if (required) this.fail(field, `${field} is required.`); return def; }
    const n = typeof v === 'number' ? v : (typeof v === 'string' && /^-?\d+$/.test(v.trim()) ? Number(v) : NaN);
    if (!Number.isInteger(n)) { this.fail(field, `${field} must be a whole number.`); return def; }
    if (n < min || n > max) { this.fail(field, `${field} must be between ${min} and ${max}.`); return def; }
    return n;
  }

  money(v, field, { required = false, max = 99999999.99 } = {}) {
    if (isBlank(v)) { if (required) this.fail(field, `${field} is required.`); return undefined; }
    const n = typeof v === 'number' ? v : (typeof v === 'string' && /^\d+(\.\d{1,2})?$/.test(v.trim()) ? Number(v) : NaN);
    if (!Number.isFinite(n) || n < 0) { this.fail(field, `${field} must be a non-negative amount with at most 2 decimals.`); return undefined; }
    if (n > max) { this.fail(field, `${field} is too large.`); return undefined; }
    return Math.round(n * 100) / 100;
  }

  email(v, field, { required = true } = {}) {
    const s = this.string(v, field, { required, max: 150 });
    if (s === undefined) return undefined;
    if (!EMAIL_RE.test(s)) { this.fail(field, `${field} is not a valid email address.`); return undefined; }
    return s.toLowerCase();
  }

  oneOf(v, field, list, { required = false, def } = {}) {
    if (isBlank(v)) { if (required) this.fail(field, `${field} is required.`); return def; }
    const s = typeof v === 'string' ? v.trim().toUpperCase() : v;
    if (!list.includes(s)) { this.fail(field, `${field} must be one of: ${list.join(', ')}.`); return def; }
    return s;
  }

  date(v, field, { required = false } = {}) {
    if (isBlank(v)) { if (required) this.fail(field, `${field} is required.`); return undefined; }
    if (typeof v !== 'string' || !DATE_RE.test(v)) { this.fail(field, `${field} must be a date in YYYY-MM-DD format.`); return undefined; }
    const d = new Date(`${v}T00:00:00Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) { this.fail(field, `${field} is not a real calendar date.`); return undefined; }
    return v;
  }

  bool(v, field, { def } = {}) {
    if (isBlank(v)) return def;
    if (v === true || v === 'true' || v === '1' || v === 1) return true;
    if (v === false || v === 'false' || v === '0' || v === 0) return false;
    this.fail(field, `${field} must be true or false.`);
    return def;
  }

  /** from/to (inclusive) with from <= to and a sane maximum span. */
  dateRange(query) {
    const from = this.date(query.from, 'from');
    const to = this.date(query.to, 'to');
    if (from && to && from > to) this.fail('from', 'from must be on or before to.');
    return { from, to };
  }

  pagination(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
    const page = this.int(query.page, 'page', { min: 1, max: 1000000, def: 1 });
    const limit = this.int(query.limit, 'limit', { min: 1, max: maxLimit, def: defaultLimit });
    return { page, limit, offset: (page - 1) * limit };
  }

  /** Sort column and direction come from an ALLOWLIST - never from raw input. */
  sort(query, allowed, defaultKey, defaultDir = 'asc') {
    const key = isBlank(query.sort) ? defaultKey : String(query.sort);
    const dir = isBlank(query.dir) ? defaultDir : String(query.dir).toLowerCase();
    if (!Object.hasOwn(allowed, key)) { this.fail('sort', `sort must be one of: ${Object.keys(allowed).join(', ')}.`); return { orderBy: allowed[defaultKey] + ' ASC' }; }
    if (dir !== 'asc' && dir !== 'desc') { this.fail('dir', 'dir must be asc or desc.'); return { orderBy: allowed[key] + ' ASC' }; }
    return { orderBy: `${allowed[key]} ${dir.toUpperCase()}` };
  }

  assert() {
    if (this.errors.length === 0) return;
    const msg = this.errors.length === 1 ? this.errors[0].message : `Validation failed for ${this.errors.length} fields.`;
    throw new AppError(400, 'VALIDATION_ERROR', msg, this.errors);
  }
}

export const parseId = (v, field = 'id') => {
  const val = new Validator();
  const id = val.int(v, field, { required: true, min: 1 });
  val.assert();
  return id;
};
