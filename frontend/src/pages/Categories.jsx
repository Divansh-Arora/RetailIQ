import { useState } from 'react';
import { api } from '../services/api.js';
import { useFetch } from '../hooks/useFetch.js';
import { Async, Empty } from '../components/StateViews.jsx';
import { TextField } from '../components/Field.jsx';
import Table from '../components/Table.jsx';
import { useToast } from '../components/Toast.jsx';
import { num } from '../services/format.js';

export default function Categories() {
  const toast = useToast();
  const list = useFetch(() => api.get('/categories'), []);
  const [name, setName] = useState('');
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setErr(null);
    try { await api.post('/categories', { category_name: name }); toast(`Category “${name.trim()}” added`); setName(''); list.reload(); }
    catch (ex) { setErr(ex); } finally { setSaving(false); }
  }
  return (
    <>
      <div className="page-head"><div><h1>Categories</h1><p>Group products so reports can compare category performance.</p></div></div>
      <form className="panel panel-body toolbar" onSubmit={submit} noValidate style={{ marginBottom: 16 }}>
        <TextField label="New category name" value={name} onChange={setName} error={err?.fieldErrors?.category_name || (err && !err.details?.length ? err.message : undefined)} maxLength={100} required />
        <button className="btn primary" disabled={saving || !name.trim()}>{saving ? 'Adding…' : 'Add category'}</button>
      </form>
      <section className="panel">
        <Async state={list} isEmpty={(d) => d.data.length === 0} empty={<Empty title="No categories yet">Add one above to start organising products.</Empty>}>
          {(d) => <Table rowKey="category_id" caption="Categories" rows={d.data} columns={[{ key: 'category_name', header: 'Category' }, { key: 'product_count', header: 'Products', num: true, render: (r) => num(r.product_count) }]} />}
        </Async>
      </section>
    </>
  );
}
