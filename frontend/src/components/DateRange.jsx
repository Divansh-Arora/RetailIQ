import { daysAgo, today } from '../services/format.js';

export const PRESETS = [
  { id: '30', label: 'Last 30 days', range: () => ({ from: daysAgo(30), to: today() }) },
  { id: '90', label: 'Last 90 days', range: () => ({ from: daysAgo(90), to: today() }) },
  { id: '365', label: 'Last 12 months', range: () => ({ from: daysAgo(365), to: today() }) },
  { id: 'all', label: 'All time', range: () => ({ from: '', to: '' }) },
];
export const defaultRange = () => PRESETS[2].range();

export default function DateRange({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <div className="toolbar" style={{ marginBottom: 0 }}>
      <div className="chips" role="group" aria-label="Quick date ranges">
        {PRESETS.map((p) => {
          const r = p.range();
          const pressed = r.from === value.from && r.to === value.to;
          return <button key={p.id} className="chip" aria-pressed={pressed} onClick={() => onChange(r)}>{p.label}</button>;
        })}
      </div>
      <div className="field"><label htmlFor="dr-from">From</label><input id="dr-from" className="input" type="date" value={value.from} max={value.to || undefined} onChange={(e) => set({ from: e.target.value })} /></div>
      <div className="field"><label htmlFor="dr-to">To</label><input id="dr-to" className="input" type="date" value={value.to} min={value.from || undefined} onChange={(e) => set({ to: e.target.value })} /></div>
    </div>
  );
}

export const periodLabel = ({ from, to }) => (from || to ? `${from || 'start'} to ${to || 'today'}` : 'All time');
