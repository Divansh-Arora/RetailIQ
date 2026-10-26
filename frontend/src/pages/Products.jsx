import { useState } from 'react';
import { api } from '../services/api.js';
import { useDebounced, useFetch } from '../hooks/useFetch.js';
import { money, num } from '../services/format.js';
import { Async, Empty } from '../components/StateViews.jsx';
import Table, { Pagination, nextSort } from '../components/Table.jsx';
import Modal from '../components/Modal.jsx';
import Badge from '../components/Badge.jsx';
import { FormAlert, SelectField, TextField } from '../components/Field.jsx';
import { useToast } from '../components/Toast.jsx';

function ProductForm({ product, categories, onClose, onSaved }) {
  const editing = !!product;
  const toast = useToast();
  const [f, setF] = useState({
    category_id: product?.category_id ?? '', sku: product?.sku ?? '', name: product?.name ?? '', unit_price: product?.unit_price ?? '',
    stock_qty: 0, reorder_level: product?.reorder_level ?? 10, is_active: product?.is_active ?? true,
  });
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const fe = err?.fieldErrors || {};

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setErr(null);
    const body = { category_id: f.category_id, sku: f.sku, name: f.name, unit_price: f.unit_price, reorder_level: f.reorder_level, is_active: f.is_active, ...(editing ? {} : { stock_qty: f.stock_qty }) };
    try {
      if (editing) await api.put(`/products/${product.product_id}`, body); else await api.post('/products', body);
      toast(editing ? 'Product updated' : 'Product added');
      onSaved();
    } catch (ex) { setErr(ex); setSaving(false); }
  }
  return (
    <Modal title={editing ? `Edit ${product.name}` : 'Add product'} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose}>Cancel</button>
      <button form="product-form" className="btn primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add product'}</button></>}>
      <form id="product-form" onSubmit={submit} noValidate className="form-grid">
        {err && !err.details?.length && <div className="full"><FormAlert error={err} /></div>}
        <TextField label="SKU" value={f.sku} onChange={set('sku')} error={fe.sku} maxLength={50} required />
        <TextField label="Product name" value={f.name} onChange={set('name')} error={fe.name} maxLength={150} required />
        <SelectField label="Category" value={f.category_id} onChange={set('category_id')} error={fe.category_id} required>
          <option value="">Choose a category</option>
          {categories.map((c) => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
        </SelectField>
        <TextField label="Unit price" type="number" min="0" step="0.01" value={f.unit_price} onChange={set('unit_price')} error={fe.unit_price} required />
        {!editing && <TextField label="Opening stock" type="number" min="0" step="1" value={f.stock_qty} onChange={set('stock_qty')} error={fe.stock_qty} hint="Recorded as an opening balance in the audit trail." />}
        <TextField label="Reorder level" type="number" min="0" step="1" value={f.reorder_level} onChange={set('reorder_level')} error={fe.reorder_level} hint="Low-stock alert when stock is at or below this." />
        {editing && <label className="check full"><input type="checkbox" checked={f.is_active} onChange={(e) => set('is_active')(e.target.checked)} /> Available for sale</label>}
        {editing && <p className="hint full">Stock changes are made from the Inventory page so they appear in the audit history.</p>}
      </form>
    </Modal>
  );
}

export default function Products() {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new, object = edit
  const q = useDebounced(search);
  const cats = useFetch(() => api.get('/categories'), []);
  const list = useFetch(() => api.get('/products', { search: q, category_id: categoryId, low_stock: lowStock, active, page, limit: 15, sort: sort.key, dir: sort.dir }), [q, categoryId, lowStock, active, page, sort.key, sort.dir]);
  const reset = (fn) => (v) => { fn(v); setPage(1); };

  return (
    <>
      <div className="page-head">
        <div><h1>Products</h1><p>Search the catalogue, adjust prices and reorder levels, and spot items running low.</p></div>
        <button className="btn primary" onClick={() => setEditing(null)} disabled={!cats.data}>Add product</button>
      </div>
      <div className="toolbar">
        <div className="field" style={{ minWidth: 230 }}><label htmlFor="p-search">Search name or SKU</label><input id="p-search" className="input" type="search" value={search} onChange={(e) => reset(setSearch)(e.target.value)} placeholder="e.g. earbuds or ELE-001" /></div>
        <div className="field"><label htmlFor="p-cat">Category</label>
          <select id="p-cat" className="select" value={categoryId} onChange={(e) => reset(setCategoryId)(e.target.value)}><option value="">All categories</option>{cats.data?.data.map((c) => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}</select></div>
        <div className="field"><label htmlFor="p-act">Status</label>
          <select id="p-act" className="select" value={active} onChange={(e) => reset(setActive)(e.target.value)}><option value="">All</option><option value="true">Active</option><option value="false">Inactive</option></select></div>
        <label className="check"><input type="checkbox" checked={lowStock} onChange={(e) => reset(setLowStock)(e.target.checked)} /> Low stock only</label>
      </div>
      <section className="panel">
        <Async state={list} isEmpty={(d) => d.data.length === 0} empty={<Empty title="No products match">Clear a filter or add a new product.</Empty>}>
          {(d) => (<>
            <Table rowKey="product_id" caption="Products" rows={d.data} sort={sort} onSort={(k) => { setSort(nextSort(sort, k)); setPage(1); }} onRowClick={(r) => setEditing(r)} columns={[
              { key: 'sku', header: 'SKU', sortKey: 'sku' }, { key: 'name', header: 'Product', sortKey: 'name' }, { key: 'category_name', header: 'Category', sortKey: 'category' },
              { key: 'unit_price', header: 'Price', sortKey: 'unit_price', num: true, render: (r) => money(r.unit_price) },
              { key: 'stock_qty', header: 'Stock', sortKey: 'stock_qty', num: true, render: (r) => <>{num(r.stock_qty)} {r.is_low_stock && <Badge value="LOW" tone="warn" />}</> },
              { key: 'reorder_level', header: 'Reorder at', num: true },
              { key: 'is_active', header: 'Status', render: (r) => <Badge value={r.is_active ? 'ACTIVE' : 'INACTIVE'} /> },
            ]} />
            <Pagination pagination={d.pagination} onPage={setPage} />
          </>)}
        </Async>
      </section>
      {editing !== undefined && cats.data && <ProductForm product={editing} categories={cats.data.data} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); list.reload(); cats.reload(); }} />}
    </>
  );
}
