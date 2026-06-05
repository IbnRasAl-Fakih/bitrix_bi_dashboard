import { RefreshCw } from '../icons/index.jsx';

export default function SyncPage({ status, syncNow, syncing }) {
  return (
    <section className="panel p-5">
      <h2 className="mb-4 text-lg font-bold">Синхронизация данных</h2>
      <button className="btn btn-primary" onClick={syncNow} disabled={syncing}>
        <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
        Синхронизировать данные
      </button>
      <div className="mt-5 grid gap-2">
        {(status.logs || []).map((log) => (
          <div className={`rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800 ${tone(log.level)}`} key={log.id}>
            <span className="block text-xs text-slate-500">{new Date(log.at).toLocaleString('ru-RU')}</span>
            <strong>{log.message}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function tone(level) {
  return {
    success: 'border-l-4 border-l-emerald-500',
    warn: 'border-l-4 border-l-amber-500',
    error: 'border-l-4 border-l-red-500',
    info: 'border-l-4 border-l-brand-500'
  }[level] || '';
}
