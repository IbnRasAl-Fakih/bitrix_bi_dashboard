import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, SlidersHorizontal, X } from '../icons/index.jsx';
import { SearchField } from './FormControls.jsx';
import { csvCell, formatCell } from '../utils/format.js';

export default function DataTable({ title, rows, columns }) {
  const [sort, setSort] = useState({ key: columns[0][0], dir: 'asc' });
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hiddenColumns, setHiddenColumns] = useState([]);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsRef = useRef(null);
  const storageKey = useMemo(() => `datatable-columns:${title}:${columns.map(([key]) => key).join(',')}`, [columns, title]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (!saved) {
        setHiddenColumns([]);
        return;
      }

      const parsed = JSON.parse(saved);
      const allowed = new Set(columns.map(([key]) => key));
      setHiddenColumns(Array.isArray(parsed) ? parsed.filter((key) => allowed.has(key)) : []);
    } catch {
      setHiddenColumns([]);
    }
  }, [columns, storageKey]);

  useEffect(() => {
    function handleClick(event) {
      if (!columnsRef.current?.contains(event.target)) setColumnsOpen(false);
    }

    function handleKey(event) {
      if (event.key === 'Escape') setColumnsOpen(false);
    }

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(hiddenColumns));
  }, [hiddenColumns, storageKey]);

  const activeColumns = useMemo(() => {
    const hidden = new Set(hiddenColumns);
    const filtered = columns.filter(([key]) => !hidden.has(key));
    return filtered.length ? filtered : [columns[0]];
  }, [columns, hiddenColumns]);

  const visible = useMemo(() => {
    const q = query.toLowerCase();
    return [...rows]
      .filter((row) => JSON.stringify(row).toLowerCase().includes(q))
      .sort((a, b) => {
        const va = a[sort.key] ?? '';
        const vb = b[sort.key] ?? '';
        return (va > vb ? 1 : -1) * (sort.dir === 'asc' ? 1 : -1);
      });
  }, [rows, sort, query]);

  const maxPage = Math.max(1, Math.ceil(visible.length / 12));
  const pageRows = visible.slice((page - 1) * 12, page * 12);

  useEffect(() => {
    if (!activeColumns.some(([key]) => key === sort.key)) {
      setSort({ key: activeColumns[0][0], dir: 'asc' });
    }
  }, [activeColumns, sort.key]);

  useEffect(() => {
    if (page > maxPage) setPage(maxPage);
  }, [maxPage, page]);

  function exportCsv() {
    const csv = [
      activeColumns.map((column) => column[1]).join(';'),
      ...visible.map((row) => activeColumns.map(([key]) => csvCell(key, row[key])).join(';'))
    ].join('\n');
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${title}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function toggleColumn(key) {
    setHiddenColumns((current) => {
      if (current.includes(key)) return current.filter((item) => item !== key);
      if (columns.length - current.length <= 1) return current;
      return [...current, key];
    });
  }

  function resetColumns() {
    setHiddenColumns([]);
  }

  return (
    <section className="panel mb-4 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="mr-auto text-base font-bold">{title}</h2>
        <SearchField value={query} onChange={setQuery} placeholder="Поиск в таблице" />
        <div className="relative" ref={columnsRef}>
          <button className="icon-btn" title="Поля таблицы" onClick={() => setColumnsOpen((current) => !current)}>
            <SlidersHorizontal size={18} />
          </button>
          {columnsOpen && (
            <div className="absolute right-0 top-12 z-40 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                <div>
                  <strong className="block text-sm">Поля таблицы</strong>
                  <span className="text-xs text-slate-500">Выберите видимые колонки</span>
                </div>
                <button className="icon-btn h-8 w-8 min-h-8 min-w-8" title="Скрыть" onClick={() => setColumnsOpen(false)}>
                  <X size={16} />
                </button>
              </div>
              <div className="max-h-80 overflow-auto p-2">
                {columns.map(([key, label]) => {
                  const checked = !hiddenColumns.includes(key);
                  const disabled = checked && activeColumns.length === 1;
                  return (
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                        disabled ? 'text-slate-400' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                      key={key}
                    >
                      <input
                        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleColumn(key)}
                      />
                      <span className="truncate">{label}</span>
                    </label>
                  );
                })}
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-700">
                <span className="text-xs text-slate-500">{activeColumns.length} из {columns.length} полей</span>
                <button className="btn h-8 min-h-8 px-3 text-xs" onClick={resetColumns}>Сбросить</button>
              </div>
            </div>
          )}
        </div>
        <button className="icon-btn" title="Экспорт CSV" onClick={exportCsv}><Download size={18} /></button>
      </div>
      <div className="overflow-auto">
        <table className="w-full min-w-[940px] border-collapse">
          <thead>
            <tr>
              {activeColumns.map(([key, label]) => (
                <th
                  className="table-th"
                  key={key}
                  onClick={() => setSort({ key, dir: sort.key === key && sort.dir === 'asc' ? 'desc' : 'asc' })}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, index) => (
              <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/60" key={row.id || index}>
                {activeColumns.map(([key]) => <td className="table-td" key={key}>{formatCell(key, row[key])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!visible.length && <div className="py-8 text-center text-sm text-slate-500">Нет данных под выбранные фильтры</div>}
      <div className="mt-3 flex items-center justify-end gap-3 text-sm text-slate-500">
        <button className="btn" disabled={page === 1} onClick={() => setPage(page - 1)}>Назад</button>
        <span>{page} / {maxPage}</span>
        <button className="btn" disabled={page >= maxPage} onClick={() => setPage(page + 1)}>Вперед</button>
      </div>
    </section>
  );
}
