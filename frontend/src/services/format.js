const LOCALE = import.meta.env.VITE_LOCALE || 'en-IN';
const CURRENCY = import.meta.env.VITE_CURRENCY || 'INR';

const money0 = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY, maximumFractionDigits: 0 });
const money2 = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY, minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numFmt = new Intl.NumberFormat(LOCALE);

export const money = (n) => (n === null || n === undefined ? '-' : Number.isInteger(Number(n)) ? money0.format(n) : money2.format(n));
export const moneyExact = (n) => (n === null || n === undefined ? '-' : money2.format(n));
export const num = (n) => (n === null || n === undefined ? '-' : numFmt.format(n));
export const pct = (n) => (n === null || n === undefined ? '-' : `${n > 0 ? '+' : ''}${n.toFixed(1)}%`);

// API timestamps are 'YYYY-MM-DD HH:MM:SS' with no timezone; display them exactly as stored.
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const date = (s) => (s ? `${Number(s.slice(8, 10))} ${MON[Number(s.slice(5, 7)) - 1]} ${s.slice(0, 4)}` : '-');
export const dateTime = (s) => (s ? `${date(s)}, ${s.slice(11, 16)}` : '-');
export const monthLabel = (ym) => `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;

export const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
export const today = () => iso(new Date());

export const compact = (n) => new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
