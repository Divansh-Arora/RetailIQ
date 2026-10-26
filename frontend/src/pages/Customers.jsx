import { useState } from 'react';
import { api } from '../services/api.js';
import { useDebounced, useFetch } from '../hooks/useFetch.js';
import { date, money, num } from '../services/format.js';
import { Async, Empty } from '../components/StateViews.jsx';
import Table, { Pagination, nextSort } from '../components/Table.jsx';
import Modal from '../components/Modal.jsx';
import Badge from '../components/Badge.jsx';
import { FormAlert, TextField } from '../components/Field.jsx';
import { useToast } from '../components/Toast.jsx';

function CustomerForm({ customer, onClose, onSaved }) {
  const editing = !!customer;
  const toast = useToast();
  const [f, setF] = useState({ name: customer?.name ?? '', email: customer?.email ?? '', city: customer?.city ?? '', is_active: customer?.is_active ?? true });
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const fe = err?.fieldErrors || {};
  async function submit(e) {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      if (editing) await api.put(`/customers/${customer.customer_id}`, f); else await api.post('/customers', f);
      toast(editing ? 'Customer updated' : 'Customer added');
      onSaved();
    } catch (ex) { setErr(ex); setSaving(false); }
  }
  return (
    <Modal title={editing ? `Edit ${customer.name}` : 'Add customer'} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose}>Cancel</button>
      <button form="customer-form" className="btn primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add customer'}</button></>}>
      <form id="customer-form" onSubmit={submit} noValidate className="form-grid">
        {err && !err.details?.length && <div className="full"><FormAlert error={err} /></div>}
        <TextField label="Name" value={f.name} onChange={set('name')} error={fe.name} maxLength={100} required />
        <TextField label="Email" type="email" value={f.email} onChange={set('email')} error={fe.email || (err?.code === 'DUPLICATE_EMAIL' ? err.message : undefined)} maxLength={150} required />
        <TextField label="City" value={f.city} onChange={set('city')} error={fe.city} maxLength={80} />
        {editing && <label className="check"><input type="checkbox" checked={f.is_active} onChange={(e) => set('is_active')(e.target.checked)} /> Active customer</label>}
      </form>
    </Modal>
  );
}

function CustomerDrawer({ id, onClose, onEdit }) {
  const d = useFetch(() => api.get(`/customers/${id}`), [id]);
  return (
    <Modal drawer title="Customer" onClose={onClose}>
      <Async state={d}>{(c) => (<>
        <div><h3>{c.name}</h3><div className="muted">{c.email}{c.city ? ` · ${c.city}` : ''}</div></div>
        <dl className="dl">
          <dt>Completed orders</dt><dd>{num(c.summary.total_orders)}</dd>
          <dt>Total spent</dt><dd>{money(c.summary.total_spent)}</dd>
          <dt>Average order</dt><dd>{money(c.summary.avg_order_value)}</dd>
          <dt>Last order</dt><dd>{date(c.summary.last_order_date)}</dd>
          <dt>Cancelled orders</dt><dd>{num(c.summary.cancelled_orders)}</dd>
          <dt>Customer since</dt><dd>{date(c.created_at)}</dd>
        </dl>
        <div><button className="btn small" onClick={() => onEdit(c)}>Edit customer</button></div>
        <h3>Order history</h3>
        {c.orders.length === 0 ? <Empty title="No orders yet" /> : (
          <Table rowKey="order_id" caption="Order history" rows={c.orders} columns={[
            { key: 'order_id', header: 'Order', render: (r) => `#${r.order_id}` }, { key: 'order_date', header: 'Date', render: (r) => date(r.order_date) },
            { key: 'total_amount', header: 'Total', num: true, render: (r) => money(r.total_amount) }, { key: 'order_status', header: 'Status', render: (r) => <Badge value={r.order_status} /> },
          ]} />
        )}
        {c.orders.length >= 50 && <p className="hint">Showing the 50 most recent orders.</p>}
      </>)}</Async>
    </Modal>
  );
}

export default function Customers() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const [form, setForm] = useState(undefined);
  const [viewId, setViewId] = useState(null);
  const q = useDebounced(search);
  const list = useFetch(() => api.get('/customers', { search: q, page, limit: 15, sort: sort.key, dir: sort.dir }), [q, page, sort.key, sort.dir]);
  return (
    <>
      <div className="page-head">
        <div><h1>Customers</h1><p>Look up customers and review what they have bought.</p></div>
        <button className="btn primary" onClick={() => setForm(null)}>Add customer</button>
      </div>
      <div className="toolbar">
        <div className="field" style={{ minWidth: 260 }}><label htmlFor="c-search">Search name or email</label><input id="c-search" className="input" type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>
      </div>
      <section className="panel">
        <Async state={list} isEmpty={(d) => d.data.length === 0} empty={<Empty title="No customers match">Try a different name or email.</Empty>}>
          {(d) => (<>
            <Table rowKey="customer_id" caption="Customers" rows={d.data} sort={sort} onSort={(k) => { setSort(nextSort(sort, k)); setPage(1); }} onRowClick={(r) => setViewId(r.customer_id)} columns={[
              { key: 'name', header: 'Name', sortKey: 'name', render: (r) => <>{r.name} {!r.is_active && <Badge value="INACTIVE" />}</> },
              { key: 'email', header: 'Email', sortKey: 'email' }, { key: 'city', header: 'City', sortKey: 'city', render: (r) => r.city || '-' },
              { key: 'total_orders', header: 'Orders', sortKey: 'total_orders', num: true, render: (r) => num(r.total_orders) },
              { key: 'total_spent', header: 'Total spent', sortKey: 'total_spent', num: true, render: (r) => money(r.total_spent) },
            ]} />
            <Pagination pagination={d.pagination} onPage={setPage} />
          </>)}
        </Async>
      </section>
      {viewId && <CustomerDrawer id={viewId} onClose={() => setViewId(null)} onEdit={(c) => { setViewId(null); setForm(c); }} />}
      {form !== undefined && <CustomerForm customer={form} onClose={() => setForm(undefined)} onSaved={() => { setForm(undefined); list.reload(); }} />}
    </>
  );
}
