// Deterministic generator for database/seed.sql  (run: node database/generate_seed.js)
// ALL DATA PRODUCED HERE IS SYNTHETIC DEMO DATA. Emails use the reserved example.com domain.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- seeded PRNG (mulberry32) so the output is identical on every run ------
let _s = 20261025;
const rnd = () => {
  _s |= 0; _s = (_s + 0x6d2b79f5) | 0;
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const weighted = (items, weights) => {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rnd() * total;
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
};
const q = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;

// ---- catalogue --------------------------------------------------------------
const CATALOGUE = [
  ['ELE', 'Electronics', [['Wireless Earbuds', 1999], ['Bluetooth Speaker', 2499], ['10000mAh Power Bank', 1299], ['USB-C Fast Charger', 799], ['HDMI Cable 2m', 349], ['Wireless Mouse', 699], ['Mechanical Keyboard', 3499], ['Webcam 1080p', 2199], ['Smart LED Bulb', 499], ['Phone Stand', 299]]],
  ['HOM', 'Home & Kitchen', [['Stainless Steel Bottle', 599], ['Non-Stick Frying Pan', 1199], ['Glass Storage Set', 899], ['Electric Kettle', 1399], ['Chef Knife', 749], ['Cotton Bath Towel', 449], ['LED Desk Lamp', 999], ['Microfiber Bedsheet', 1299], ['Lunch Box Set', 549], ['Dish Rack', 799]]],
  ['GRO', 'Groceries', [['Basmati Rice 5kg', 649], ['Olive Oil 1L', 899], ['Whole Wheat Flour 5kg', 289], ['Green Tea 100 Bags', 349], ['Instant Coffee 200g', 499], ['Almonds 500g', 549], ['Honey 500g', 399], ['Rolled Oats 1kg', 199], ['Peanut Butter 1kg', 349], ['Masala Mix Pack', 249]]],
  ['PCA', 'Personal Care', [['Herbal Shampoo 400ml', 349], ['Face Wash 150ml', 249], ['Sunscreen SPF50', 399], ['Electric Trimmer', 1499], ['Toothbrush 4-Pack', 199], ['Body Lotion 400ml', 329], ['Hand Sanitizer 500ml', 179], ['Perfume 100ml', 1199], ['Hair Oil 200ml', 229], ['Lip Balm 3-Pack', 199]]],
  ['STA', 'Stationery & Office', [['A5 Notebook 3-Pack', 249], ['Gel Pens 10-Pack', 149], ['Desk Organizer', 599], ['Sticky Notes Set', 129], ['Heavy Duty Stapler', 349], ['Whiteboard 60x90', 1299], ['Highlighters 6-Pack', 179], ['File Folders 10-Pack', 299], ['Scientific Calculator', 849], ['A4 Paper 500 Sheets', 449]]],
  ['SPO', 'Sports & Fitness', [['Yoga Mat 6mm', 799], ['Dumbbell Set 10kg', 1899], ['Skipping Rope', 249], ['Resistance Bands Set', 599], ['Running Cap', 399], ['Gym Gloves', 449], ['Football Size 5', 899], ['Badminton Racquet Pair', 1299], ['Shaker Bottle', 349], ['Foam Roller', 999]]],
  ['TOY', 'Toys & Games', [['Building Blocks 500pc', 1299], ['Jigsaw Puzzle 1000pc', 699], ['Remote Control Car', 1599], ['Classic Board Game', 999], ['Plush Bear', 599], ['Art Kit', 799], ['Playing Cards', 149], ['Puzzle Cube', 299], ['Toy Kitchen Set', 1499], ['Water Colour Set', 349]]],
  ['FAS', 'Fashion Accessories', [['Leather Wallet', 899], ['Canvas Backpack', 1499], ['Sunglasses', 1099], ['Analog Watch', 2299], ['Cotton Scarf', 499], ['Leather Belt', 749], ['Baseball Cap', 399], ['Tote Bag', 549], ['Wool Socks 3-Pack', 299], ['Travel Umbrella', 599]]],
  ['BOO', 'Books', [['Python Programming Basics', 699], ['Data Structures Handbook', 899], ['Business Strategy Essentials', 599], ['World Atlas', 1199], ['Everyday Meals Cookbook', 499], ['Mindfulness Journal', 349], ['Kids Story Collection', 399], ['Sketching Guide', 549], ['Personal Finance Primer', 449], ['Poetry Anthology', 299]]],
  ['PET', 'Pet Supplies', [['Dog Food 3kg', 899], ['Cat Litter 5kg', 549], ['Pet Bowl Set', 299], ['Dog Leash', 449], ['Cat Scratching Post', 999], ['Pet Shampoo 250ml', 299], ['Chew Toy', 199], ['Pet Bed Medium', 1299], ['Aquarium Filter', 799], ['Bird Feeder', 349]]],
];
const FIRST = ['Aarav', 'Vivaan', 'Aditya', 'Arjun', 'Rohan', 'Kabir', 'Ishaan', 'Karan', 'Rahul', 'Nikhil', 'Ananya', 'Diya', 'Priya', 'Sneha', 'Kavya', 'Meera', 'Riya', 'Pooja', 'Neha', 'Simran', 'Harpreet', 'Gurpreet', 'Manpreet', 'Jaspreet', 'Amrit', 'Tanvi', 'Isha', 'Varun', 'Sahil', 'Tara'];
const LAST = ['Sharma', 'Singh', 'Kaur', 'Gill', 'Verma', 'Gupta', 'Mehta', 'Kapoor', 'Malhotra', 'Bansal', 'Chopra', 'Arora', 'Sethi', 'Bhatia', 'Joshi', 'Nair', 'Reddy', 'Iyer', 'Das', 'Khanna', 'Grewal', 'Sandhu', 'Dhillon', 'Saini', 'Thakur', 'Jain', 'Agarwal', 'Rao', 'Menon', 'Bose'];
const CITIES = ['Ludhiana', 'Chandigarh', 'Amritsar', 'Jalandhar', 'Patiala', 'Delhi', 'Mumbai', 'Bengaluru', 'Pune', 'Jaipur', 'Hyderabad', 'Kolkata'];

// ---- master data ------------------------------------------------------------
const START = Date.UTC(2025, 10, 1);              // first order: 2025-11-01
const END = Date.UTC(2026, 9, 24, 23, 59, 59);     // last order: 2026-10-24
const OPENING = new Date(Date.UTC(2025, 9, 25, 9, 0, 0));

const categories = CATALOGUE.map(([, name], i) => ({ id: i + 1, name }));
const products = [];
CATALOGUE.forEach(([code, , items], ci) => items.forEach(([name, price], pi) => {
  products.push({ id: products.length + 1, category_id: ci + 1, sku: `${code}-${String(pi + 1).padStart(3, '0')}`, name, price, reorder: int(5, 20), lowTarget: false, movements: [] });
}));
// choose 12 products that will end below their reorder level
const lowIdx = new Set();
while (lowIdx.size < 12) lowIdx.add(int(0, products.length - 1));
products.forEach((p, i) => { p.lowTarget = lowIdx.has(i); });
// popularity weights (shuffled Zipf-like) so rankings are not uniform
const order = products.map((_, i) => i).sort(() => rnd() - 0.5);
order.forEach((pi, rank) => { products[pi].weight = 1 / Math.pow(rank + 1, 0.75); });

const customers = [];
const usedNames = new Set();
while (customers.length < 200) {
  const f = pick(FIRST), l = pick(LAST), key = `${f} ${l}`;
  if (usedNames.has(key)) continue;
  usedNames.add(key);
  const id = customers.length + 1;
  const created = new Date(Date.UTC(2025, 9, 25, 9, 0, 0) - int(0, 120) * 86400000);
  customers.push({ id, name: key, email: `${f}.${l}.${id}@example.com`.toLowerCase(), city: rnd() < 0.05 ? null : pick(CITIES), created, weight: 1 / Math.pow(int(1, 200), 0.9) });
}

// ---- orders -----------------------------------------------------------------
const NUM_ORDERS = 500;
const monthWeight = (d) => { const m = (d.getUTCFullYear() - 2025) * 12 + d.getUTCMonth() - 10; return 0.8 + m * 0.04 + (d.getUTCMonth() === 10 || d.getUTCMonth() === 11 ? 0.35 : 0); };
const dates = [];
while (dates.length < NUM_ORDERS) {
  const t = START + Math.floor(rnd() * (END - START));
  const d = new Date(t);
  if (rnd() * 1.6 > monthWeight(d)) continue;
  d.setUTCHours(int(9, 20), int(0, 59), int(0, 59));
  dates.push(d);
}
dates.sort((a, b) => a - b);

const orders = [], items = [], payments = [], movements = [];
const addMove = (p, qty, reason, refType, refId, when, notes) => { movements.push({ product_id: p.id, qty, reason, refType, refId, when, notes }); p.movements.push({ qty, when }); };

dates.forEach((date, idx) => {
  const id = idx + 1;
  const cust = weighted(customers, customers.map((c) => c.weight));
  const lines = weighted([1, 2, 3, 4, 5], [30, 30, 20, 12, 8]);
  const chosen = new Set();
  let total = 0;
  while (chosen.size < lines) chosen.add(weighted(products, products.map((p) => p.weight)));
  const status = rnd() < 0.12 ? 'CANCELLED' : 'COMPLETED';
  for (const p of chosen) {
    const qty = weighted([1, 2, 3, 4], [55, 25, 12, 8]);
    total += qty * p.price;
    items.push({ order_id: id, product_id: p.id, qty, price: p.price });
    addMove(p, -qty, 'SALE', 'ORDER', id, date, null);
    if (status === 'CANCELLED') addMove(p, qty, 'CANCELLATION', 'ORDER', id, new Date(date.getTime() + int(1, 48) * 3600000), 'Order cancelled - stock restored');
  }
  const method = pick(['CASH', 'CARD_DEMO', 'UPI_DEMO']);
  const paidAt = new Date(date.getTime() + 60000 * int(1, 10));
  if (status === 'CANCELLED') {
    payments.push({ order_id: id, amount: total, method, status: rnd() < 0.6 ? 'FAILED' : 'PENDING', paid_at: null, created: date });
  } else {
    const r = rnd();
    if (r < 0.06) payments.push({ order_id: id, amount: total, method, status: 'PENDING', paid_at: null, created: date });
    else if (r < 0.12) {
      payments.push({ order_id: id, amount: total, method, status: 'FAILED', paid_at: null, created: date });
      payments.push({ order_id: id, amount: total, method, status: 'SUCCESS', paid_at: paidAt, created: paidAt });
    } else payments.push({ order_id: id, amount: total, method, status: 'SUCCESS', paid_at: paidAt, created: date });
  }
  orders.push({ id, customer_id: cust.id, date, status, total, cancelled_at: status === 'CANCELLED' ? new Date(date.getTime() + 3600000) : null });
});

// ---- manual restocks / adjustments (non-low products only) -------------------
products.filter((p) => !p.lowTarget).forEach((p) => {
  if (rnd() < 0.35) addMove(p, int(20, 80), 'RESTOCK', 'MANUAL', null, new Date(START + Math.floor(rnd() * (END - START))), 'Supplier delivery (synthetic demo data)');
  if (rnd() < 0.12) addMove(p, -int(1, 4), 'ADJUSTMENT', 'MANUAL', null, new Date(START + Math.floor(rnd() * (END - START))), 'Damaged stock write-off (synthetic demo data)');
});

// ---- opening balances so stock_qty == SUM(movements) and never dips below 0 --
products.forEach((p) => {
  const mv = movements.filter((m) => m.product_id === p.id).sort((a, b) => a.when - b.when);
  let run = 0, min = 0;
  for (const m of mv) { run += m.qty; min = Math.min(min, run); }
  const tail = run - min;                                     // balance gained after the lowest point
  const extra = p.lowTarget ? Math.max(0, int(0, p.reorder) - tail) : int(p.reorder * 2, p.reorder * 8) + 5;
  p.opening = -min + extra;
  p.final = p.opening + run;
  if (p.lowTarget && p.final > p.reorder) p.reorder = p.final + int(1, 5);   // guarantee a genuine low-stock example
});
products.forEach((p) => movements.push({ product_id: p.id, qty: p.opening, reason: 'OPENING', refType: 'MANUAL', refId: null, when: OPENING, notes: 'Opening balance (synthetic demo data)' }));
movements.sort((a, b) => a.when - b.when || (a.reason === 'OPENING' ? -1 : 1));

// ---- emit SQL ---------------------------------------------------------------
const out = [];
out.push('-- =============================================================================');
out.push('-- RetailIQ seed data - GENERATED FILE (node database/generate_seed.js)');
out.push('-- ALL RECORDS ARE SYNTHETIC DEMO DATA. No real people, emails or payments.');
out.push(`-- ${categories.length} categories, ${products.length} products, ${customers.length} customers, ${orders.length} orders,`);
out.push(`-- ${items.length} order items, ${payments.length} payments, ${movements.length} inventory movements.`);
out.push('-- Safe to re-run: existing rows are truncated first.');
out.push('-- =============================================================================');
out.push('SET NAMES utf8mb4;', 'SET FOREIGN_KEY_CHECKS = 0;');
['inventory_movements', 'payments', 'order_items', 'orders', 'products', 'categories', 'customers'].forEach((t) => out.push(`TRUNCATE TABLE ${t};`));
out.push('SET FOREIGN_KEY_CHECKS = 1;', '');
const emit = (table, cols, rows) => {
  for (let i = 0; i < rows.length; i += 100) {
    out.push(`INSERT INTO ${table} (${cols.join(', ')}) VALUES`);
    out.push(rows.slice(i, i + 100).map((r) => `  (${r.map(q).join(', ')})`).join(',\n') + ';');
  }
  out.push('');
};
emit('categories', ['category_id', 'category_name'], categories.map((c) => [c.id, c.name]));
emit('customers', ['customer_id', 'name', 'email', 'city', 'created_at'], customers.map((c) => [c.id, c.name, c.email, c.city, fmt(c.created)]));
emit('products', ['product_id', 'category_id', 'sku', 'name', 'unit_price', 'stock_qty', 'reorder_level', 'created_at'], products.map((p) => [p.id, p.category_id, p.sku, p.name, p.price, p.final, p.reorder, fmt(OPENING)]));
emit('orders', ['order_id', 'customer_id', 'order_date', 'status', 'total_amount', 'cancelled_at', 'created_at'], orders.map((o) => [o.id, o.customer_id, fmt(o.date), o.status, o.total, o.cancelled_at ? fmt(o.cancelled_at) : null, fmt(o.date)]));
emit('order_items', ['order_id', 'product_id', 'quantity', 'unit_price'], items.map((i) => [i.order_id, i.product_id, i.qty, i.price]));
emit('payments', ['order_id', 'amount', 'payment_method', 'status', 'paid_at', 'created_at'], payments.map((p) => [p.order_id, p.amount, p.method, p.status, p.paid_at ? fmt(p.paid_at) : null, fmt(p.created)]));
emit('inventory_movements', ['product_id', 'quantity_change', 'reason', 'reference_type', 'reference_id', 'created_at', 'notes'], movements.map((m) => [m.product_id, m.qty, m.reason, m.refType, m.refId, fmt(m.when), m.notes]));

fs.writeFileSync(path.join(__dirname, 'seed.sql'), out.join('\n') + '\n');
console.log(`seed.sql written: ${products.length} products, ${customers.length} customers, ${orders.length} orders, ${items.length} items, ${payments.length} payments, ${movements.length} movements`);
