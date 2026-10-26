import { Validator, parseId } from '../utils/validate.js';
import * as svc from '../services/customers.service.js';

function body(b) {
  const v = new Validator();
  const d = {
    name: v.string(b.name, 'name', { required: true, max: 100 }),
    email: v.email(b.email, 'email'),
    city: v.string(b.city, 'city', { max: 80 }),
    is_active: v.bool(b.is_active, 'is_active', { def: true }),
  };
  v.assert();
  return d;
}
export async function list(req, res) {
  const v = new Validator();
  const q = req.query;
  const opts = { search: v.string(q.search, 'search', { max: 100 }), active: v.bool(q.active, 'active'), ...v.pagination(q), ...v.sort(q, svc.CUSTOMER_SORTS, 'name') };
  v.assert();
  res.json(await svc.listCustomers(opts));
}
export const get = async (req, res) => res.json(await svc.getCustomer(parseId(req.params.id)));
export const create = async (req, res) => res.status(201).json(await svc.createCustomer(body(req.body ?? {})));
export async function update(req, res) {
  const id = parseId(req.params.id);
  res.json(await svc.updateCustomer(id, body(req.body ?? {})));
}
