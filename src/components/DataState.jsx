import { useMemo, useState } from 'react';
import { AlertTriangle, Bell, Database, RefreshCw, X } from '../icons/index.jsx';

export function EmptyState({ title = 'Нет данных', description = 'По выбранным условиям данные не найдены.', action }) {
  return (
    <div className="panel flex min-h-64 flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800">
        <Database size={26} />
      </div>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-2 max-w-xl text-sm text-slate-500 dark:text-slate-400">{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({ title = 'Синхронизация не выполнена', description, onRetry }) {
  return (
    <div className="panel flex min-h-72 flex-col items-center justify-center border-red-200 bg-red-50/60 p-8 text-center dark:border-red-900 dark:bg-red-950/20">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-950">
        <AlertTriangle size={28} />
      </div>
      <h2 className="text-lg font-bold text-red-950 dark:text-red-100">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm text-red-700 dark:text-red-200">{description}</p>
      {onRetry && (
        <button className="btn btn-primary mt-5" onClick={onRetry}>
          <RefreshCw size={18} />
          Повторить синхронизацию
        </button>
      )}
    </div>
  );
}

export function NotificationCenter({ warnings = [] }) {
  const [open, setOpen] = useState(false);
  const [dismissedKey, setDismissedKey] = useState('');
  const key = useMemo(() => warnings.join('|'), [warnings]);

  if (!warnings.length || dismissedKey === key) return null;

  return (
    <div className="fixed right-5 top-5 z-40">
      {!open ? (
        <button
          className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-900 shadow-xl shadow-slate-900/10 transition hover:bg-amber-50 dark:border-amber-900 dark:bg-slate-900 dark:text-amber-100"
          onClick={() => setOpen(true)}
        >
          <Bell size={17} />
          Уведомления
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">{warnings.length}</span>
        </button>
      ) : (
        <div className="w-[min(520px,calc(100vw-40px))] overflow-hidden rounded-xl border border-amber-200 bg-white shadow-2xl shadow-slate-900/15 dark:border-amber-900 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/30">
            <div className="flex items-center gap-2">
              <Bell size={18} className="text-amber-700 dark:text-amber-200" />
              <strong className="text-sm text-amber-950 dark:text-amber-100">Уведомления по данным</strong>
            </div>
            <button className="icon-btn h-8 w-8" title="Закрыть уведомления" onClick={() => setDismissedKey(key)}>
              <X size={16} />
            </button>
          </div>
          <div className="max-h-80 overflow-auto p-4">
            <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Данные отображаются только по доступным полям Bitrix24</p>
            <ul className="grid gap-2">
              {warnings.map((warning, index) => (
                <li className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100" key={index}>
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
