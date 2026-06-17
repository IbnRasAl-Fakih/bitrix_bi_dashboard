import { cloneElement, isValidElement, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Download, Maximize2, MoreHorizontal, RotateCw, X } from '../icons/index.jsx';
import { EmptyState } from './DataState.jsx';

export default function ChartCard({ title, children, empty = false, emptyText = 'Для этого графика нет данных в Bitrix24.' }) {
  const [fullscreen, setFullscreen] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [wide, setWide] = useState(false);
  const [version, setVersion] = useState(0);
  const cardRef = useRef(null);

  const chart = empty
    ? <EmptyState title="Нет данных для графика" description={emptyText} />
    : isValidElement(children)
    ? cloneElement(children, { showLegend, key: version })
    : children;

  async function exportPng() {
    if (!cardRef.current || empty) return;
    const dataUrl = await toPng(cardRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff',
      filter: (node) => node.dataset?.exportIgnore !== 'true'
    });
    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = `${safeFilename(title)}.png`;
    anchor.click();
  }

  return (
    <>
      <section className={`panel min-w-0 p-4 ${wide ? 'xl:col-span-2' : ''}`} ref={cardRef}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="truncate text-base font-bold">{title}</h2>
          <div className="flex items-center gap-1" data-export-ignore="true">
            <button className="icon-btn h-8 w-8" title="Скачать PNG" disabled={empty} onClick={exportPng}>
              <Download size={15} />
            </button>
            <button className="icon-btn h-8 w-8" title="Обновить график" onClick={() => setVersion((current) => current + 1)}>
              <RotateCw size={15} />
            </button>
            <button className="icon-btn h-8 w-8" title={showLegend ? 'Скрыть легенду' : 'Показать легенду'} onClick={() => setShowLegend(!showLegend)}>
              <MoreHorizontal size={16} />
            </button>
            <button className="icon-btn h-8 w-8" title={wide ? 'Обычная ширина' : 'Широкий режим'} onClick={() => setWide(!wide)}>
              <span className="text-xs font-bold">{wide ? '1x' : '2x'}</span>
            </button>
            <button className="icon-btn h-8 w-8" title="На весь экран" onClick={() => setFullscreen(true)}>
              <Maximize2 size={15} />
            </button>
          </div>
        </div>
        <div className="h-[340px] min-w-0 overflow-hidden">{chart}</div>
      </section>

      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 p-6 backdrop-blur-sm">
          <section className="flex h-full flex-col rounded-xl bg-white p-5 shadow-2xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">{title}</h2>
              <div className="flex items-center gap-2">
                <button className="btn" onClick={() => setShowLegend(!showLegend)}>{showLegend ? 'Скрыть легенду' : 'Показать легенду'}</button>
                <button className="icon-btn" onClick={() => setFullscreen(false)} title="Закрыть"><X size={18} /></button>
              </div>
            </div>
            <div className="min-h-0 flex-1">{chart}</div>
          </section>
        </div>
      )}
    </>
  );
}

function safeFilename(value) {
  return String(value || 'chart')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'chart';
}
