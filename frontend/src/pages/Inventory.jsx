import { useState } from 'react';
import { api } from '../services/api.js';
import { useDebounced, useFetch } from '../hooks/useFetch.js';
import { dateTime, num } from '../services/format.js';
import { Async, Empty } from '../components/StateViews.jsx';
import Table, { Pagination } from '../components/Table.jsx';
import Modal from '../components/Modal.jsx';
import Badge from '../components/Badge.jsx';
import { FormAlert, SelectField, TextField, Field } from '../components/Field.jsx';
import { useToast } from '../components/Toast.jsx';

function AdjustForm({ product, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({ quantity_change: '', reason: 'RESTOCK', notes: '' });
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const fe = err?.fieldErrors || {};
  const delta = Number(f.quantity_change);
  async function submit(e) {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const r = await api.post('/inventory/adjustments', { product_id: product.product_id, ...f });
      toast(`${r.name}: stock ${r.stock_before} → ${r.stock_after}`);
      onSaved();
    } catch (ex) { setErr(ex); setSaving(false); }
  }
  return (
    <Modal title={`Adjust stock: ${product.name}`} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose}>Cancel</button>
      <button form="adjust-form" className="btn primary" disabled={saving || !Number.isInteger(delta) || delta === 0}>{saving ? 'Saving…' : 'Record adjustment'}</button></>}>
      <form id="adjust-form" onSubmit={submit} noValidate className="form-grid">
        <div className="full"><FormAlert error={err && !err.details?.some((d) => d.field) ? err : null} /></div>
        <p className="full muted" style={{ margin: 0 }}>Current stock: <strong>{num(product.stock_qty)}</strong> · reorder level {num(product.reorder_level)}</p>
        <SelectField label="Reason" value={f.reason} onChange={set('reason')} error={fe.reason}><option value="RESTOCK">Restock (add stock)</option><option value="ADJUSTMENT">Correction / write-off</option></SelectField>
        <TextField label="Quantity change" type="number" step="1" value={f.quantity_change} onChange={set('quantity_change')} error={fe.quantity_change} hint={f.reason === 'RESTOCK' ? 'Positive number, e.g. 25' : 'Use a negative number to remove stock, e.g. -2'} />
        <TextField className="full" label={f.reason === 'ADJUSTMENT' ? 'Notes (required)' : 'Notes'} value={f.notes} onChange={set('notes')} error={fe.notes} maxLength={255} placeholder="e.g. Supplier delivery PO-1042" />
        {Number.isInteger(delta) && delta !== 0 && <p className="full hint">New stock level would be {num(product.stock_qty + delta)}.</p>}
      </form>
    </Modal>
  );
}

function Levels() {
  const [search, setSearch] = useState('');
  const [low, setLow] = useState(false);
  const [page, setPage] = useState(1);
  const [adjust, setAdjust] = useState(null);
  const q = useDebounced(search);
  const list = useFetch(() => api.get('/products', { search: q, low_stock: low, active: true, page, limit: 15, sort: 'stock_qty', dir: 'asc' }), [q, low, page]);
  return (<>
    <div className="toolbar">
      <div className="field" style={{ minWidth: 240 }}><label htmlFor="i-search">Search name or SKU</label><input id="i-search" className="input" type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>
      <label className="check"><input type="checkbox" checked={low} onChange={(e) => { setLow(e.target.checked); setPage(1); }} /> Low stock only</label>
    </div>
    <section className="panel">
      <Async state={list} isEmpty={(d) => d.data.length === 0} empty={<Empty title={low ? 'No low-stock products' : 'No products match'} />}>
        {(d) => (<>
          <Table rowKey="product_id" caption="Stock levels" rows={d.data} columns={[
            { key: 'sku', header: 'SKU' }, { key: 'name', header: 'Product' }, { key: 'category_name', header: 'Category' },
            { key: 'stock_qty', header: 'In stock', num: true, render: (r) => num(r.stock_qty) }, { key: 'reorder_level', header: 'Reorder at', num: true },
            { key: 'is_low_stock', header: 'Status', render: (r) => (r.stock_qty === 0 ? <Badge value="OUT" tone="bad" /> : r.is_low_stock ? <Badge value="LOW" tone="warn" /> : <Badge value="OK" tone="ok" />) },
            { key: 'act', header: '', render: (r) => <button className="btn small" onClick={() => setAdjust(r)}>Adjust</button> },
          ]} />
          <Pagination pagination={d.pagination} onPage={setPage} />
        </>)}
      </Async>
    </section>
    {adjust && <AdjustForm product={adjust} onClose={() => setAdjust(null)} onSaved={() => { setAdjust(null); list.reload(); }} />}
  </>);
}

const REF = { ORDER: 'Order', MANUAL: 'Manual' };

function Movements() {
  const [f, setF] = useState({ product_id: '', reason: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const products = useFetch(() => api.all('/products', { sort: 'name' }), []);
  const bad = f.from && f.to && f.from > f.to;
  const list = useFetch(() => (bad ? Promise.resolve({ data: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 1 } }) : api.get('/inventory/movements', { ...f, page, limit: 25 })), [f.product_id, f.reason, f.from, f.to, page]);
  const set = (k) => (e) => { setF((s) => ({ ...s, [k]: e.target.value })); setPage(1); };
  return (<>
    <div className="toolbar">
      <div className="field"><label htmlFor="m-prod">Product</label><select id="m-prod" className="select" value={f.product_id} onChange={set('product_id')}><option value="">All products</option>{products.data?.map((p) => <option key={p.product_id} value={p.product_id}>{p.name}</option>)}</select></div>
      <div className="field"><label htmlFor="m-reason">Reason</label><select id="m-reason" className="select" value={f.reason} onChange={set('reason')}><option value="">All</option>{['SALE', 'RESTOCK', 'ADJUSTMENT', 'CANCELLATION', 'OPENING'].map((r) => <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>)}</select></div>
      <div className="field"><label htmlFor="m-from">From</label><input id="m-from" className="input" type="date" value={f.from} onChange={set('from')} /></div>
      <div className="field"><label htmlFor="m-to">To</label><input id="m-to" className="input" type="date" value={f.to} onChange={set('to')} /></div>
    </div>
    {bad && <div className="alert bad" role="alert" style={{ marginBottom: 12 }}>“From” must be on or before “To”.</div>}
    <p className="legend-note">History is append-only. Mistakes are fixed with a compensating entry, never by editing a row.</p>
    <section className="panel">
      <Async state={list} isEmpty={(d) => d.data.length === 0} empty={<Empty title="No movements found">Change the filters to widen the search.</Empty>}>
        {(d) => (<>
          <Table rowKey="movement_id" caption="Inventory movements" rows={d.data} columns={[
            { key: 'created_at', header: 'When', className: 'nowrap', render: (r) => dateTime(r.created_at) }, { key: 'product_name', header: 'Product', render: (r) => <>{r.product_name}<div className="muted small">{r.sku}</div></> },
            { key: 'quantity_change', header: 'Change', num: true, render: (r) => <strong style={{ color: r.quantity_change > 0 ? 'var(--ok)' : 'var(--bad)' }}>{r.quantity_change > 0 ? '+' : ''}{num(r.quantity_change)}</strong> },
            { key: 'reason', header: 'Reason', render: (r) => <Badge value={r.reason} tone="" /> },
            { key: 'reference_type', header: 'Reference', render: (r) => (r.reference_id ? `${REF[r.reference_type] || r.reference_type} #${r.reference_id}` : REF[r.reference_type] || '-') }, { key: 'notes', header: 'Notes', render: (r) => r.notes || '' },
          ]} />
          <Pagination pagination={d.pagination} onPage={setPage} />
        </>)}
      </Async>
    </section>
  </>);
}
void Field;

export default function Inventory() {
  const [tab, setTab] = useState('levels');
  return (<>
    <div className="page-head"><div><h1>Inventory</h1><p>Check stock against reorder levels, record adjustments with a reason, and trace every change.</p></div></div>
    <div className="tabs" role="tablist">
      <button className="tab" role="tab" aria-selected={tab === 'levels'} onClick={() => setTab('levels')}>Stock levels</button>
      <button className="tab" role="tab" aria-selected={tab === 'history'} onClick={() => setTab('history')}>Movement history</button>
    </div>
    {tab === 'levels' ? <Levels /> : <Movements />}
  </>);
}
