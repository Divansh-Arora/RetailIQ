import { Validator } from '../utils/validate.js';
import * as svc from '../services/inventory.service.js';

export async function lowStock(req, res) {
  const v = new Validator();
  const limit = v.int(req.query.limit, 'limit', { min: 1, max: 500, def: 100 });
  v.assert();
  res.json(await svc.listLowStock({ limit }));
}
export async function movements(req, res) {
  const v = new Validator();
  const q = req.query;
  const opts = {
    productId: v.int(q.product_id, 'product_id', { min: 1 }),
    reason: v.oneOf(q.reason, 'reason', ['SALE', 'RESTOCK', 'ADJUSTMENT', 'CANCELLATION', 'OPENING']),
    ...v.dateRange(q),
    ...v.pagination(q, { defaultLimit: 25 }),
    ...v.sort(q, svc.MOVEMENT_SORTS, 'created_at', 'desc'),
  };
  v.assert();
  res.json(await svc.listMovements(opts));
}
export async function adjust(req, res) {
  const b = req.body ?? {};
  const v = new Validator();
  const product_id = v.int(b.product_id, 'product_id', { required: true, min: 1 });
  const quantity_change = v.int(b.quantity_change, 'quantity_change', { required: true, min: -100000, max: 100000 });
  const reason = v.oneOf(b.reason, 'reason', ['RESTOCK', 'ADJUSTMENT'], { required: true });
  const notes = v.string(b.notes, 'notes', { max: 255 });
  if (quantity_change === 0) v.fail('quantity_change', 'quantity_change must not be zero.');
  if (reason === 'RESTOCK' && quantity_change < 0) v.fail('quantity_change', 'A restock must add stock (positive quantity).');
  if (reason === 'ADJUSTMENT' && !notes) v.fail('notes', 'Explain the adjustment in notes (for example "damaged in storage").');
  v.assert();
  res.status(201).json(await svc.adjustStock({ product_id, quantity_change, reason, notes }));
}
