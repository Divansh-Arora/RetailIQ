import { Validator, parseId } from '../utils/validate.js';
import { AppError } from '../utils/errors.js';
import * as svc from '../services/products.service.js';

function body(b, { creating }) {
  const v = new Validator();
  const d = {
    category_id: v.int(b.category_id, 'category_id', { required: true, min: 1 }),
    sku: v.string(b.sku, 'sku', { required: true, max: 50 }),
    name: v.string(b.name, 'name', { required: true, max: 150 }),
    unit_price: v.money(b.unit_price, 'unit_price', { required: true, max: 99999999.99 }),
    reorder_level: v.int(b.reorder_level, 'reorder_level', { min: 0, max: 1000000, def: 10 }),
    is_active: v.bool(b.is_active, 'is_active', { def: true }),
  };
  if (creating) d.stock_qty = v.int(b.stock_qty, 'stock_qty', { min: 0, max: 10000000, def: 0 });
  else if (b.stock_qty !== undefined) v.fail('stock_qty', 'Stock cannot be edited here. Use a stock adjustment so the change is audited.');
  v.assert();
  return d;
}

export async function list(req, res) {
  const v = new Validator();
  const q = req.query;
  const opts = {
    search: v.string(q.search, 'search', { max: 100 }),
    categoryId: v.int(q.category_id, 'category_id', { min: 1 }),
    lowStock: v.bool(q.low_stock, 'low_stock', { def: false }),
    active: v.bool(q.active, 'active'),
    ...v.pagination(q),
    ...v.sort(q, svc.PRODUCT_SORTS, 'name'),
  };
  v.assert();
  res.json(await svc.listProducts(opts));
}
export const get = async (req, res) => res.json(await svc.getProduct(parseId(req.params.id)));
export const create = async (req, res) => res.status(201).json(await svc.createProduct(body(req.body ?? {}, { creating: true })));
export async function update(req, res) {
  const id = parseId(req.params.id);
  res.json(await svc.updateProduct(id, body(req.body ?? {}, { creating: false })));
}
void AppError;
