import { useMemo, useState } from 'react';
import { Download } from '../icons/index.jsx';
import { SearchField } from './FormControls.jsx';
import { csvCell, formatCell } from '../utils/format.js';

export default function DataTable({ title, rows, columns }) {
  const [sort, setSort] = useState({ key: columns[0][0], dir: 'asc' });
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

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

  function exportCsv() {
    const csv = [
      columns.map((column) => column[1]).join(';'),
      ...visible.map((row) => columns.map(([key]) => csvCell(row[key])).join(';'))
    ].join('\n');
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${title}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="panel mb-4 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="mr-auto text-base font-bold">{title}</h2>
        <SearchField value={query} onChange={setQuery} placeholder="Поиск в таблице" />
        <button className="icon-btn" title="Экспорт CSV" onClick={exportCsv}><Download size={18} /></button>
      </div>
      <div className="overflow-auto">
        <table className="min-w-[940px] w-full border-collapse">
          <thead>
            <tr>
              {columns.map(([key, label]) => (
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
                {columns.map(([key]) => <td className="table-td" key={key}>{formatCell(key, row[key])}</td>)}
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
