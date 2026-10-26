const TONE = {
  COMPLETED: 'ok', PAID: 'ok', SUCCESS: 'ok', ACTIVE: 'ok',
  PENDING: 'warn', PARTIAL: 'warn', LOW: 'warn',
  CANCELLED: 'bad', FAILED: 'bad',
};
const LABEL = { NONE: 'No payment' };
export default function Badge({ value, tone }) {
  const t = tone ?? TONE[value] ?? '';
  const text = LABEL[value] ?? value.charAt(0) + value.slice(1).toLowerCase().replace('_', ' ');
  return <span className={`badge ${t}`}>{text}</span>;
}
