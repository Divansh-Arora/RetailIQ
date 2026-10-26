import { NavLink, Outlet } from 'react-router-dom';

const LINKS = [
  ['/', 'Dashboard'], ['/products', 'Products'], ['/categories', 'Categories'], ['/customers', 'Customers'],
  ['/orders', 'Orders'], ['/inventory', 'Inventory'], ['/reports', 'Reports'], ['/about', 'About'],
];

export default function AppLayout() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <NavLink to="/" className="brand" aria-label="RetailIQ home"><span className="brand-mark" aria-hidden="true">IQ</span>RetailIQ</NavLink>
        <nav className="nav" aria-label="Main">
          {LINKS.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>)}
        </nav>
        <div className="sidebar-foot">Demo system · synthetic data<br />No real payments</div>
      </aside>
      <main className="main"><Outlet /></main>
    </div>
  );
}
