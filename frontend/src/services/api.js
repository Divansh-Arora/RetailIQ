const BASE = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details || [];
  }
  /** { field: message } for form display */
  get fieldErrors() {
    return Object.fromEntries(this.details.filter((d) => d.field).map((d) => [d.field, d.message]));
  }
}

function buildUrl(path, params) {
  const url = new URL(BASE + path, window.location.origin);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== false) url.searchParams.set(k, String(v));
  });
  return url;
}

async function request(method, path, { params, body, headers } = {}) {
  let res;
  try {
    res = await fetch(buildUrl(path, params), {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check that the API is running and try again.');
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty or non-JSON body */ }
  if (!res.ok) {
    const e = data?.error;
    throw new ApiError(res.status, e?.code || 'REQUEST_FAILED', e?.message || `Request failed (${res.status}).`, e?.details);
  }
  return data;
}

export const api = {
  get: (path, params) => request('GET', path, { params }),
  post: (path, body, headers) => request('POST', path, { body: body ?? {}, headers }),
  put: (path, body) => request('PUT', path, { body }),
  /** Fetches every page of a paginated list endpoint (bounded). */
  async all(path, params) {
    const out = [];
    for (let page = 1; page <= 10; page++) {
      const r = await request('GET', path, { params: { ...params, page, limit: 100 } });
      out.push(...r.data);
      if (page >= r.pagination.totalPages) break;
    }
    return out;
  },
  /** URL for a CSV download that matches the on-screen filters. */
  csvUrl: (path, params) => buildUrl(path, { ...params, format: 'csv' }).toString(),
};
