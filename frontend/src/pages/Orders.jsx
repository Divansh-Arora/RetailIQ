import { useRef, useState } from 'react';
import { api } from '../services/api.js';
import { useDebounced, useFetch } from '../hooks/useFetch.js';
import { dateTime, money, moneyExact, num } from '../services/format.js';
import { Async, Empty, Loading } from '../components/StateViews.jsx';
import Table, { Pagination, nextSort } from '../components/Table.jsx';
import Modal from '../components/Modal.jsx';
import Badge from '../components/Badge.jsx';
import { FormAlert, SelectField } from '../components/Field.jsx';
import { useToast } from '../components/Toast.jsx';

const newKey = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);

function CustomerPicker({ value, onChange, error }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const q = useDebounced(text, 250);
  const res = useFetch(() => api.get('/customers', { search: q, active: true, limit: 8, sort: 'name' }), [q]);
  if (value) return (
    <div className="field"><span className="field-label">Customer</span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><strong>{value.name}</strong><span className="muted small">{value.email}</span><button type="button" className="btn small" onClick={() => onChange(null)}>Change</button></div></div>
  );
  return (
    <div className="field picker">
      <label htmlFor="cust-search">Customer</label>
      <input id="cust-search" className="input" autoComplete="off" placeholder="Search by name or email" value={text} aria-invalid={error ? 'true' : undefined}
        onChange={(e) => { setText(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} />
      {error && <span className="field-error">{error}</span>}
      {open && (
        <ul className="picker-list">
          {res.loading && !res.data && <li className="hint" style={{ padding: 8 }}>Searching…</li>}
          {res.data?.data.length === 0 && <li className="hint" style={{ padding: 8 }}>No active customers found</li>}
          {res.data?.data.map((c) => <li key={c.customer_id}><button type="button" onClick={() => { onChange(c); setOpen(false); }}>{c.name} <span className="muted small">{c.email}</span></button></li>)}
        </ul>
      )}
    </div>
  );
}

function OrderForm({ onClose, onSaved }) {
  const toast = useToast();
  const products = useFetch(() => api.all('/products', { active: true, sort: 'name' }), []);
  const [customer, setCustomer] = useState(null);
  const [lines, setLines] = useState([{ product_id: '', quantity: 1 }]);
  const [method, setMethod] = useState('CASH');
  const [payNow, setPayNow] = useState('SUCCESS');
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const key = useRef(newKey()); // reused on retry so an accidental double submit cannot create two orders
  const byId = new Map((products.data || []).map((p) => [String(p.product_id), p]));
  const setLine = (i, patch) => setLines((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const chosen = lines.filter((l) => l.product_id);
  const estimate = chosen.reduce((s, l) => s + (byId.get(String(l.product_id))?.unit_price || 0) * (Number(l.quantity) || 0), 0);
  const valid = customer && chosen.length > 0 && chosen.every((l) => Number.isInteger(Number(l.quantity)) && Number(l.quantity) >= 1);
  const chosenIds = chosen.map((l) => String(l.product_id));

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const o = await api.post('/orders', {
        customer_id: customer.customer_id, payment_method: method, payment_status: payNow,
        items: chosen.map((l) => ({ product_id: Number(l.product_id), quantity: Number(l.quantity) })),
      }, { 'Idempotency-Key': key.current });
      toast(`Order #${o.order_id} created${o.idempotent_replay ? ' (already existed)' : ''}`);
      onSaved();
    } catch (ex) { setErr(ex); setSaving(false); }
  }

  return (
    <Modal wide title="New order" onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose}>Cancel</button>
      <button form="order-form" className="btn primary" disabled={saving || !valid}>{saving ? 'Placing order…' : 'Place order'}</button></>}>
      {products.loading && !products.data ? <Loading label="Loading products…" /> : products.error ? <div className="alert bad">{products.error.message}</div> : (
        <form id="order-form" onSubmit={submit} noValidate className="stack">
          <FormAlert error={err} />
          <CustomerPicker value={customer} onChange={setCustomer} error={err?.code === 'CUSTOMER_NOT_FOUND' ? err.message : undefined} />
          <div className="stack" role="group" aria-label="Order lines">
            {lines.map((l, i) => {
              const p = byId.get(String(l.product_id));
              const over = p && Number(l.quantity) > p.stock_qty;
              return (
                <div className="line-row" key={i}>
                  <div className="field">
                    <label className="sr-only" htmlFor={`line-p-${i}`}>Product {i + 1}</label>
                    <select id={`line-p-${i}`} className="select" value={l.product_id} onChange={(e) => setLine(i, { product_id: e.target.value })}>
                      <option value="">Choose a product…</option>
                      {products.data.map((x) => <option key={x.product_id} value={x.product_id} disabled={x.stock_qty === 0 || (chosenIds.includes(String(x.product_id)) && String(x.product_id) !== String(l.product_id))}>{x.name} · {money(x.unit_price)} · {x.stock_qty} in stock</option>)}
                    </select>
                    {over && <span className="field-error">Only {p.stock_qty} in stock</span>}
                  </div>
                  <div className="field"><label className="sr-only" htmlFor={`line-q-${i}`}>Quantity {i + 1}</label><input id={`line-q-${i}`} className="input" type="number" min="1" step="1" value={l.quantity} aria-invalid={over ? 'true' : undefined} onChange={(e) => setLine(i, { quantity: e.target.value })} /></div>
                  <div className="line-total right" style={{ paddingTop: 8, fontWeight: 700 }}>{p ? money(p.unit_price * (Number(l.quantity) || 0)) : '-'}</div>
                  <button type="button" className="btn small" aria-label={`Remove line ${i + 1}`} disabled={lines.length === 1} onClick={() => setLines((x) => x.filter((_, j) => j !== i))}>✕</button>
                </div>
              );
            })}
            <div><button type="button" className="btn small" onClick={() => setLines((l) => [...l, { product_id: '', quantity: 1 }])}>Add another product</button></div>
          </div>
          <div className="form-grid">
            <SelectField label="Payment method (demo)" value={method} onChange={setMethod}><option value="CASH">Cash</option><option value="CARD_DEMO">Card (demo)</option><option value="UPI_DEMO">UPI (demo)</option></SelectField>
            <SelectField label="Payment" value={payNow} onChange={setPayNow}><option value="SUCCESS">Paid now (simulated)</option><option value="PENDING">Pay later</option></SelectField>
          </div>
          <div className="total-bar"><span>Estimated total</span><span className="big">{money(estimate)}</span></div>
          <p className="hint">The server recalculates prices and totals from the catalogue when the order is placed. No card details are collected.</p>
        </form>
      )}
    </Modal>
  );
}

function OrderDrawer({ id, onClose, onChanged }) {
  const toast = useToast();
  const d = useFetch(() => api.get(`/orders/${id}`), [id]);
  const [busy, setBusy] = useState(false);
  async function cancel() {
    if (!window.confirm(`Cancel order #${id}? Stock will be returned to inventory.`)) return;
    setBusy(true);
    try { await api.post(`/orders/${id}/cancel`); toast(`Order #${id} cancelled and stock restored`); d.reload(); onChanged(); }
    catch (ex) { toast(ex.message, 'error'); } finally { setBusy(false); }
  }
  return (
    <Modal drawer title={`Order #${id}`} onClose={onClose}>
      <Async state={d}>{(o) => (<>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Badge value={o.order_status} /><Badge value={o.payment_status} /></div>
        <dl className="dl"><dt>Customer</dt><dd>{o.customer_name}<div className="muted small">{o.customer_email}</div></dd><dt>Placed</dt><dd>{dateTime(o.order_date)}</dd>
          {o.cancelled_at && <><dt>Cancelled</dt><dd>{dateTime(o.cancelled_at)}</dd></>}</dl>
        <h3>Items</h3>
        <Table rowKey="order_item_id" caption="Order items" rows={o.items} columns={[
          { key: 'name', header: 'Product', render: (r) => <>{r.name}<div className="muted small">{r.sku}</div></> }, { key: 'quantity', header: 'Qty', num: true },
          { key: 'unit_price', header: 'Unit price', num: true, render: (r) => moneyExact(r.unit_price) }, { key: 'line_total', header: 'Line total', num: true, render: (r) => moneyExact(r.line_total) }]} />
        <div className="total-bar"><span>Order total</span><span className="big">{moneyExact(o.total_amount)}</span></div>
        <h3>Payments (demo)</h3>
        {o.payments.length === 0 ? <p className="muted">No payment records.</p> : (
          <Table rowKey="payment_id" caption="Payments" rows={o.payments} columns={[
            { key: 'payment_method', header: 'Method', render: (r) => r.payment_method.replace('_', ' ') }, { key: 'amount', header: 'Amount', num: true, render: (r) => moneyExact(r.amount) },
            { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> }, { key: 'paid_at', header: 'Paid', render: (r) => dateTime(r.paid_at) }]} />
        )}
        {o.order_status === 'COMPLETED' && <div><button className="btn danger" disabled={busy} onClick={cancel}>{busy ? 'Cancelling…' : 'Cancel order'}</button><p className="hint">Cancelling returns every item to stock and records a compensating inventory movement.</p></div>}
        <p className="hint">{num(o.units)} units across {num(o.line_count)} lines.</p>
      </>)}</Async>
    </Modal>
  );
}

export default function Orders() {
  const [f, setF] = useState({ search: '', status: '', payment_status: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: 'order_date', dir: 'desc' });
  const [creating, setCreating] = useState(false);
  const [viewId, setViewId] = useState(null);
  const q = useDebounced(f.search);
  const bad = f.from && f.to && f.from > f.to;
  const list = useFetch(() => (bad ? Promise.resolve({ data: [], pagination: { page: 1, limit: 15, total: 0, totalPages: 1 } }) : api.get('/orders', { ...f, search: q, page, limit: 15, sort: sort.key, dir: sort.dir })), [q, f.status, f.payment_status, f.from, f.to, page, sort.key, sort.dir]);
  const set = (k) => (e) => { setF((s) => ({ ...s, [k]: e.target.value })); setPage(1); };

  return (
    <>
      <div className="page-head">
        <div><h1>Orders</h1><p>Create orders with several products, review line items and payment state, and cancel when needed.</p></div>
        <button className="btn primary" onClick={() => setCreating(true)}>New order</button>
      </div>
      <div className="toolbar">
        <div className="field" style={{ minWidth: 210 }}><label htmlFor="o-search">Order # or customer</label><input id="o-search" className="input" type="search" value={f.search} onChange={set('search')} /></div>
        <div className="field"><label htmlFor="o-status">Order status</label><select id="o-status" className="select" value={f.status} onChange={set('status')}><option value="">All</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option><option value="PENDING">Pending</option></select></div>
        <div className="field"><label htmlFor="o-pay">Payment status</label><select id="o-pay" className="select" value={f.payment_status} onChange={set('payment_status')}><option value="">All</option><option value="PAID">Paid</option><option value="PENDING">Pending</option><option value="FAILED">Failed</option><option value="PARTIAL">Partial</option></select></div>
        <div className="field"><label htmlFor="o-from">From</label><input id="o-from" className="input" type="date" value={f.from} onChange={set('from')} /></div>
        <div className="field"><label htmlFor="o-to">To</label><input id="o-to" className="input" type="date" value={f.to} onChange={set('to')} /></div>
      </div>
      {bad && <div className="alert bad" role="alert" style={{ marginBottom: 12 }}>“From” must be on or before “To”.</div>}
      <section className="panel">
        <Async state={list} isEmpty={(d) => d.data.length === 0} empty={<Empty title="No orders match">Adjust the filters or create a new order.</Empty>}>
          {(d) => (<>
            <Table rowKey="order_id" caption="Orders" rows={d.data} sort={sort} onSort={(k) => { setSort(nextSort(sort, k)); setPage(1); }} onRowClick={(r) => setViewId(r.order_id)} columns={[
              { key: 'order_id', header: 'Order', sortKey: 'order_id', render: (r) => `#${r.order_id}` }, { key: 'customer_name', header: 'Customer', sortKey: 'customer' },
              { key: 'order_date', header: 'Date', sortKey: 'order_date', className: 'nowrap', render: (r) => dateTime(r.order_date) }, { key: 'units', header: 'Units', num: true },
              { key: 'total_amount', header: 'Total', sortKey: 'total_amount', num: true, render: (r) => money(r.total_amount) },
              { key: 'order_status', header: 'Order', sortKey: 'status', render: (r) => <Badge value={r.order_status} /> }, { key: 'payment_status', header: 'Payment', render: (r) => <Badge value={r.payment_status} /> },
            ]} />
            <Pagination pagination={d.pagination} onPage={setPage} />
          </>)}
        </Async>
      </section>
      {viewId && <OrderDrawer id={viewId} onClose={() => setViewId(null)} onChanged={list.reload} />}
      {creating && <OrderForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); list.reload(); }} />}
    </>
  );
}
