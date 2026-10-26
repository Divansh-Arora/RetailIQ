import { useState } from 'react';
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../services/api.js';
import { useFetch } from '../hooks/useFetch.js';
import { compact, money, monthLabel, num, pct } from '../services/format.js';
import { Async, Empty } from '../components/StateViews.jsx';
import DateRange, { defaultRange, periodLabel } from '../components/DateRange.jsx';
import Table from '../components/Table.jsx';
import Badge from '../components/Badge.jsx';

const AXIS = { fontSize: 12, fill: '#5a6875' };

function Section({ id, title, csv, children }) {
  return (
    <section className="panel" aria-labelledby={id}>
      <div className="panel-head"><h2 id={id}>{title}</h2>{csv && <a className="btn small" href={csv} download>Export CSV</a>}</div>
      {children}
    </section>
  );
}

export default function Reports() {
  const [range, setRange] = useState(defaultRange());
  const p = { from: range.from, to: range.to };
  const deps = [range.from, range.to];
  const rev = useFetch(() => api.get('/reports/revenue', p), deps);
  const cats = useFetch(() => api.get('/reports/category-sales', p), deps);
  const prods = useFetch(() => api.get('/reports/top-products', { ...p, limit: 10 }), deps);
  const custs = useFetch(() => api.get('/reports/top-customers', { ...p, limit: 10 }), deps);
  const status = useFetch(() => api.get('/reports/order-status', p), deps);
  const bad = range.from && range.to && range.from > range.to;

  return (
    <>
      <div className="page-head"><div><h1>Reports</h1><p>Reporting period: <strong>{periodLabel(range)}</strong>. Revenue is the gross value of completed orders (cancelled orders and payment state excluded). CSV exports use the period selected here.</p></div></div>
      <DateRange value={range} onChange={setRange} />
      {bad && <div className="alert bad" role="alert" style={{ marginTop: 12 }}>“From” must be on or before “To”.</div>}
      <div className="stack" style={{ marginTop: 16 }}>
        <Section id="r-rev" title="Revenue by month" csv={api.csvUrl('/reports/revenue', p)}>
          <Async state={rev} isEmpty={(d) => d.monthly.length === 0} empty={<Empty title="No completed orders in this period" />}>
            {(d) => (<>
              <p className="legend-note" style={{ padding: '12px 16px 0', margin: 0 }}>Total {money(d.revenue)} from {num(d.total_orders)} orders (average {money(d.avg_order_value)}). The first and last months may be partial when the range starts or ends mid-month.</p>
              <div className="panel-body"><div className="chart-box" role="img" aria-label="Monthly revenue line chart"><ResponsiveContainer width="100%" height="100%">
                <LineChart data={d.monthly.map((m) => ({ ...m, label: monthLabel(m.sales_month) }))} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#e4e8eb" vertical={false} /><XAxis dataKey="label" tick={AXIS} tickLine={false} /><YAxis tick={AXIS} tickFormatter={compact} tickLine={false} axisLine={false} width={48} />
                  <Tooltip formatter={(v) => [money(v), 'Revenue']} /><Line type="monotone" dataKey="revenue" stroke="#0b6e86" strokeWidth={2.5} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div></div>
              <Table rowKey="sales_month" caption="Revenue by month" rows={d.monthly} columns={[
                { key: 'sales_month', header: 'Month' }, { key: 'revenue', header: 'Revenue', num: true, render: (r) => money(r.revenue) }, { key: 'total_orders', header: 'Orders', num: true },
                { key: 'avg_order_value', header: 'Avg order', num: true, render: (r) => money(r.avg_order_value) },
                { key: 'mom_change_pct', header: 'vs previous month', num: true, render: (r) => (r.mom_change_pct === null ? '-' : <span className={r.mom_change_pct >= 0 ? 'delta-up' : 'delta-down'}>{pct(r.mom_change_pct)}</span>) }]} />
            </>)}
          </Async>
        </Section>
        <div className="grid-2" style={{ marginTop: 0 }}>
          <Section id="r-cat" title="Sales by category" csv={api.csvUrl('/reports/category-sales', p)}>
            <Async state={cats} isEmpty={(d) => d.data.length === 0} empty={<Empty title="No category sales" />}>
              {(d) => <Table rowKey="category_id" caption="Category sales" rows={d.data} columns={[{ key: 'category_name', header: 'Category' }, { key: 'units_sold', header: 'Units', num: true, render: (r) => num(r.units_sold) }, { key: 'revenue', header: 'Revenue', num: true, render: (r) => money(r.revenue) }, { key: 'revenue_share_pct', header: 'Share', num: true, render: (r) => `${r.revenue_share_pct}%` }]} />}
            </Async>
          </Section>
          <Section id="r-status" title="Orders by status">
            <Async state={status} isEmpty={(d) => d.data.length === 0} empty={<Empty title="No orders in this period" />}>
              {(d) => <Table rowKey="status" caption="Orders by status" rows={d.data} columns={[{ key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> }, { key: 'orders', header: 'Orders', num: true }, { key: 'order_value', header: 'Order value', num: true, render: (r) => money(r.order_value) }]} />}
            </Async>
          </Section>
        </div>
        <Section id="r-prod" title="Top products" csv={api.csvUrl('/reports/top-products', p)}>
          <Async state={prods} isEmpty={(d) => d.data.length === 0} empty={<Empty title="No product sales" />}>
            {(d) => <Table rowKey="product_id" caption="Top products" rows={d.data} columns={[{ key: 'name', header: 'Product', render: (r) => <>{r.name}<div className="muted small">{r.sku}</div></> }, { key: 'category_name', header: 'Category' }, { key: 'units_sold', header: 'Units sold', num: true, render: (r) => num(r.units_sold) }, { key: 'revenue', header: 'Revenue', num: true, render: (r) => money(r.revenue) }]} />}
          </Async>
        </Section>
        <Section id="r-cust" title="Highest-value customers" csv={api.csvUrl('/reports/top-customers', p)}>
          <Async state={custs} isEmpty={(d) => d.data.length === 0} empty={<Empty title="No customer purchases" />}>
            {(d) => <Table rowKey="customer_id" caption="Top customers" rows={d.data} columns={[{ key: 'name', header: 'Customer', render: (r) => <>{r.name}<div className="muted small">{r.email}</div></> }, { key: 'city', header: 'City', render: (r) => r.city || '-' }, { key: 'total_orders', header: 'Orders', num: true }, { key: 'total_spent', header: 'Total spent', num: true, render: (r) => money(r.total_spent) }, { key: 'avg_order_value', header: 'Avg order', num: true, render: (r) => money(r.avg_order_value) }]} />}
          </Async>
        </Section>
      </div>
    </>
  );
}
