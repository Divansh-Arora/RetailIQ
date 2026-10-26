import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../services/api.js';
import { useFetch } from '../hooks/useFetch.js';
import { compact, money, monthLabel, num, pct } from '../services/format.js';
import { Async, Empty } from '../components/StateViews.jsx';
import DateRange, { defaultRange, periodLabel } from '../components/DateRange.jsx';
import Table from '../components/Table.jsx';

const AXIS = { fontSize: 12, fill: '#5a6875' };

function Kpis({ s }) {
  const change = s.previous?.revenue_change_pct;
  return (
    <section className="kpis" aria-label="Key figures">
      <div className="kpi">
        <div className="kpi-label">Revenue</div>
        <div className="kpi-value">{money(s.revenue)}</div>
        <div className="kpi-note">{change === null || change === undefined ? periodLabel(s.period) : <><span className={change >= 0 ? 'delta-up' : 'delta-down'}>{pct(change)}</span> vs previous period</>}</div>
      </div>
      <div className="kpi"><div className="kpi-label">Completed orders</div><div className="kpi-value">{num(s.total_orders)}</div><div className="kpi-note">{s.previous ? `${num(s.previous.total_orders)} previous period` : 'Cancelled excluded'}</div></div>
      <div className="kpi"><div className="kpi-label">Average order value</div><div className="kpi-value">{money(s.avg_order_value)}</div><div className="kpi-note">Revenue ÷ orders</div></div>
      <div className={`kpi ${s.low_stock_count > 0 ? 'alert' : ''}`}><div className="kpi-label">Low-stock products</div><div className="kpi-value">{num(s.low_stock_count)}</div><div className="kpi-note">At or below reorder level (live)</div></div>
    </section>
  );
}

export default function Dashboard() {
  const [range, setRange] = useState(defaultRange());
  const p = { from: range.from, to: range.to };
  const deps = [range.from, range.to];
  const summary = useFetch(() => api.get('/dashboard/summary', p), deps);
  const monthly = useFetch(() => api.get('/dashboard/monthly-sales', p), deps);
  const top = useFetch(() => api.get('/dashboard/top-products', { ...p, limit: 8 }), deps);
  const cats = useFetch(() => api.get('/dashboard/category-sales', p), deps);
  const low = useFetch(() => api.get('/inventory/low-stock', { limit: 8 }), []);

  return (
    <>
      <div className="page-head">
        <div><h1>Dashboard</h1><p>Sales and stock at a glance for {periodLabel(range).toLowerCase()}. Revenue counts completed orders only.</p></div>
      </div>
      <div className="stack">
        <DateRange value={range} onChange={setRange} />
        <Async state={summary} empty={null}>{(s) => <Kpis s={s} />}</Async>

        <section className="panel" aria-labelledby="h-monthly">
          <div className="panel-head"><h2 id="h-monthly">Monthly revenue</h2></div>
          <div className="panel-body">
            <Async state={monthly} isEmpty={(d) => d.data.length === 0} empty={<Empty title="No sales in this period">Try a wider date range.</Empty>}>
              {(d) => (
                <div className="chart-box" role="img" aria-label="Line chart of monthly revenue">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={d.data.map((m) => ({ ...m, label: monthLabel(m.sales_month) }))} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="#e4e8eb" vertical={false} />
                      <XAxis dataKey="label" tick={AXIS} tickLine={false} />
                      <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={compact} width={48} />
                      <Tooltip formatter={(v, n) => [n === 'revenue' ? money(v) : v, n === 'revenue' ? 'Revenue' : 'Orders']} />
                      <Line type="monotone" dataKey="revenue" stroke="#0b6e86" strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Async>
          </div>
        </section>
      </div>

      <div className="grid-2">
        <section className="panel" aria-labelledby="h-top">
          <div className="panel-head"><h2 id="h-top">Top products by revenue</h2></div>
          <div className="panel-body">
            <Async state={top} isEmpty={(d) => d.data.length === 0} empty={<Empty title="No product sales yet" />}>
              {(d) => (
                <div className="chart-box" role="img" aria-label="Bar chart of top products by revenue">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={d.data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="#e4e8eb" horizontal={false} />
                      <XAxis type="number" tick={AXIS} tickFormatter={compact} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={130} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => (v.length > 18 ? `${v.slice(0, 17)}…` : v)} />
                      <Tooltip formatter={(v) => [money(v), 'Revenue']} />
                      <Bar dataKey="revenue" fill="#0b6e86" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Async>
          </div>
        </section>
        <section className="panel" aria-labelledby="h-cat">
          <div className="panel-head"><h2 id="h-cat">Sales by category</h2></div>
          <div className="panel-body">
            <Async state={cats} isEmpty={(d) => d.data.length === 0} empty={<Empty title="No category sales yet" />}>
              {(d) => (
                <div className="chart-box" role="img" aria-label="Bar chart of revenue by category">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={d.data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="#e4e8eb" vertical={false} />
                      <XAxis dataKey="category_name" tick={{ ...AXIS, fontSize: 11 }} interval={0} tickLine={false} tickFormatter={(v) => (v.length > 10 ? `${v.slice(0, 9)}…` : v)} />
                      <YAxis tick={AXIS} tickFormatter={compact} tickLine={false} axisLine={false} width={48} />
                      <Tooltip formatter={(v) => [money(v), 'Revenue']} />
                      <Bar dataKey="revenue" fill="#e3b23c" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Async>
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: 16 }} aria-labelledby="h-low">
        <div className="panel-head"><h2 id="h-low">Low-stock products</h2><Link className="btn small" to="/inventory">Manage inventory</Link></div>
        <Async state={low} isEmpty={(d) => d.data.length === 0} empty={<Empty title="Everything is above its reorder level" />}>
          {(d) => (
            <Table rowKey="product_id" caption="Low-stock products" rows={d.data} columns={[
              { key: 'name', header: 'Product' }, { key: 'sku', header: 'SKU' },
              { key: 'stock_qty', header: 'In stock', num: true, render: (r) => <strong style={{ color: r.stock_qty === 0 ? 'var(--bad)' : 'var(--warn)' }}>{num(r.stock_qty)}</strong> },
              { key: 'reorder_level', header: 'Reorder level', num: true },
            ]} />
          )}
        </Async>
      </section>
    </>
  );
}
