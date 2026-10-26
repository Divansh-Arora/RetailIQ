import { Validator, parseId } from '../utils/validate.js';
import { AppError } from '../utils/errors.js';
import * as svc from '../services/orders.service.js';

const MAX_LINES = 50;
const KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;

export async function list(req, res) {
  const v = new Validator();
  const q = req.query;
  const opts = {
    status: v.oneOf(q.status, 'status', ['PENDING', 'COMPLETED', 'CANCELLED']),
    paymentStatus: v.oneOf(q.payment_status, 'payment_status', ['NONE', 'PENDING', 'PARTIAL', 'PAID', 'FAILED']),
    customerId: v.int(q.customer_id, 'customer_id', { min: 1 }),
    search: v.string(q.search, 'search', { max: 100 }),
    ...v.dateRange(q),
    ...v.pagination(q),
    ...v.sort(q, svc.ORDER_SORTS, 'order_date', 'desc'),
  };
  v.assert();
  res.json(await svc.listOrders(opts));
}
export const get = async (req, res) => res.json(await svc.getOrder(parseId(req.params.id)));

export async function create(req, res) {
  const b = req.body ?? {};
  const v = new Validator();
  const customer_id = v.int(b.customer_id, 'customer_id', { required: true, min: 1 });
  const payment_method = v.oneOf(b.payment_method, 'payment_method', ['CASH', 'CARD_DEMO', 'UPI_DEMO'], { def: 'CASH' });
  const payment_status = v.oneOf(b.payment_status, 'payment_status', ['SUCCESS', 'PENDING'], { def: 'SUCCESS' });
  const rawKey = req.get('Idempotency-Key') ?? b.idempotency_key;
  let idempotency_key;
  if (rawKey !== undefined && rawKey !== null && rawKey !== '') {
    if (typeof rawKey !== 'string' || !KEY_RE.test(rawKey)) v.fail('idempotency_key', 'Idempotency key must be 8-64 letters, digits, "-" or "_".');
    else idempotency_key = rawKey;
  }
  const items = [];
  if (!Array.isArray(b.items) || b.items.length === 0) v.fail('items', 'An order needs at least one item.');
  else if (b.items.length > MAX_LINES) v.fail('items', `An order can have at most ${MAX_LINES} lines.`);
  else {
    const merged = new Map(); // duplicate product lines are normalised by summing quantities
    b.items.forEach((it, i) => {
      const pid = v.int(it?.product_id, `items[${i}].product_id`, { required: true, min: 1 });
      const qty = v.int(it?.quantity, `items[${i}].quantity`, { required: true, min: 1, max: 10000 });
      if (pid && qty) merged.set(pid, (merged.get(pid) ?? 0) + qty);
    });
    for (const [product_id, quantity] of merged) {
      if (quantity > 10000) v.fail('items', `Total quantity for product #${product_id} exceeds 10000.`);
      items.push({ product_id, quantity }); // NOTE: any client-sent price/total is ignored on purpose
    }
  }
  v.assert();
  const { order, replayed } = await svc.createOrder({ customer_id, items, payment_method, payment_status, idempotency_key });
  res.status(replayed ? 200 : 201).json({ ...order, idempotent_replay: replayed });
}

export async function cancel(req, res) {
  const id = parseId(req.params.id);
  if (!id) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid order id.');
  res.json(await svc.cancelOrder(id));
}
