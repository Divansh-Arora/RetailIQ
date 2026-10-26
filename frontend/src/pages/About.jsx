export default function About() {
  return (
    <>
      <div className="page-head"><div><h1>About RetailIQ</h1><p>A retail sales and inventory analytics demo built on MySQL, Express and React.</p></div></div>
      <div className="stack" style={{ maxWidth: 760 }}>
        <section className="panel panel-body"><h2>Demo data</h2><p>Every customer, product, order and payment here is synthetic. Payments are simulated: no card numbers or credentials are collected or stored.</p></section>
        <section className="panel panel-body">
          <h2>How figures are defined</h2>
          <dl className="dl" style={{ marginTop: 10 }}>
            <dt>Revenue</dt><dd>Quantity × the price at time of sale, for items on completed orders. Cancelled orders and payment status do not change it.</dd>
            <dt>Orders</dt><dd>Completed orders in the selected period (by order date, both end dates included).</dd>
            <dt>Average order value</dt><dd>Revenue ÷ completed orders.</dd>
            <dt>Low stock</dt><dd>Active products at or below their reorder level right now.</dd>
            <dt>Order vs payment status</dt><dd>Shown separately. Payment is “Paid” when successful payments cover the order total.</dd>
          </dl>
        </section>
        <section className="panel panel-body"><h2>Stock integrity</h2><p>Placing an order, deducting stock and writing the audit trail happen in one database transaction. Stock can never go negative, and inventory history is append-only.</p></section>
      </div>
    </>
  );
}
