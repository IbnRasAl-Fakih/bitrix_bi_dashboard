import { formatKpi } from '../utils/format.js';
import { hintForKpi } from '../utils/data.js';

export default function KpiCard({ metricKey, label, value, onClick }) {
  return (
    <button
      className="panel min-h-32 p-4 text-left transition hover:-translate-y-0.5 hover:border-brand-500"
      onClick={onClick}
    >
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <strong className="mt-3 block text-2xl font-bold text-slate-950 dark:text-white">{formatKpi(metricKey, value)}</strong>
      <small className="mt-3 block text-xs text-slate-500 dark:text-slate-400">{hintForKpi(metricKey)}</small>
    </button>
  );
}
