import { sourceLabel } from '../utils/format.js';

export default function SourceBadge({ source }) {
  const tone = source === 'bitrix'
    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
    : source === 'bitrix-demo'
      ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100'
    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>
      {sourceLabel(source)}
    </span>
  );
}
