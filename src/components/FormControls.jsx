import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Search } from '../icons/index.jsx';
import Dropdown from './Dropdown.jsx';

const presets = [
  ['30d', '30 дней'],
  ['90d', '90 дней'],
  ['year', 'Год']
];

const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function Select({ value, onChange, options, placeholder = 'Все', icon, className = '', searchable = true, multiple = false }) {
  return (
    <Dropdown
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      icon={icon}
      className={className}
      searchable={searchable}
      multiple={multiple}
    />
  );
}

export function SearchField({ value, onChange, placeholder = 'Поиск', className = '' }) {
  return (
    <label className={`field transition focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-blue-100 dark:focus-within:ring-blue-950 ${className}`}>
      <Search size={16} />
      <input className="field-input w-44" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

export function DateRangePicker({ period, startDate, endDate, onChange }) {
  const [open, setOpen] = useState(false);
  const [monthMode, setMonthMode] = useState(false);
  const [cursor, setCursor] = useState(() => startDate ? monthStart(parseIsoDate(startDate)) : monthStart(new Date()));
  const ref = useRef(null);
  const selectedStart = parseIsoDate(startDate);
  const selectedEnd = parseIsoDate(endDate);
  const label = period === 'month'
    ? formatMonthLabel(selectedStart)
    : period === 'custom'
      ? formatRangeLabel(selectedStart, selectedEnd)
      : presets.find(([value]) => value === period)?.[1] || 'Период';

  useEffect(() => {
    function handleClick(event) {
      if (!ref.current?.contains(event.target)) setOpen(false);
    }

    function handleKey(event) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  useEffect(() => {
    if (open && selectedStart) setCursor(monthStart(selectedStart));
  }, [open, startDate]);

  const days = useMemo(() => buildMonthDays(cursor), [cursor]);

  function choosePreset(nextPeriod) {
    setMonthMode(false);
    onChange({ period: nextPeriod, startDate: '', endDate: '' });
    setOpen(false);
  }

  function chooseDay(day) {
    if (monthMode) {
      return;
    }

    const value = toInputDate(day);
    if (!selectedStart || selectedEnd) {
      onChange({ period: 'custom', startDate: value, endDate: '' });
      return;
    }

    const start = selectedStart <= day ? selectedStart : day;
    const end = selectedStart <= day ? day : selectedStart;
    onChange({ period: 'custom', startDate: toInputDate(start), endDate: toInputDate(end) });
  }

  function chooseVisibleMonth() {
    const start = monthStart(cursor);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    onChange({ period: 'month', startDate: toInputDate(start), endDate: toInputDate(end) });
    setMonthMode(false);
    setOpen(false);
  }

  return (
    <div className={`relative ${open ? 'z-[130]' : 'z-0'}`} ref={ref}>
      <button
        type="button"
        className={`flex h-10 min-w-40 items-center gap-2 rounded-lg border px-3 text-sm transition ${
          open
            ? 'border-brand-500 bg-white shadow-lg shadow-blue-500/10 ring-4 ring-blue-100 dark:bg-slate-900 dark:ring-blue-950'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
        }`}
        onClick={() => setOpen((current) => !current)}
      >
        <Calendar size={16} className="text-slate-400" />
        <span className="flex-1 truncate text-left text-slate-900 dark:text-slate-100">{label}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-12 z-[130] w-[360px] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-3 grid grid-cols-4 gap-1.5">
            {presets.map(([value, presetLabel]) => (
              <button
                key={value}
                type="button"
                className={`rounded-lg px-2.5 py-2 text-xs font-semibold transition ${
                  period === value && !monthMode
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
                onClick={() => choosePreset(value)}
              >
                {presetLabel}
              </button>
            ))}
            <button
              type="button"
              className={`rounded-lg px-2.5 py-2 text-xs font-semibold transition ${
                monthMode || period === 'month'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
              onClick={chooseVisibleMonth}
            >
              Месяц
            </button>
          </div>

          <div className="mb-3 rounded-xl bg-slate-50 p-2 dark:bg-slate-800/70">
            <div className="mb-2 flex items-center justify-between">
              <button type="button" className="icon-btn h-8 w-8 border-0 bg-white dark:bg-slate-900" onClick={() => setCursor(addMonths(cursor, -1))} aria-label="Предыдущий месяц">
                <ChevronLeft size={16} />
              </button>
              <strong className="text-sm capitalize text-slate-900 dark:text-slate-100">
                {cursor.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
              </strong>
              <button type="button" className="icon-btn h-8 w-8 border-0 bg-white dark:bg-slate-900" onClick={() => setCursor(addMonths(cursor, 1))} aria-label="Следующий месяц">
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase text-slate-400">
              {weekDays.map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {days.map((day) => {
                const active = isSameDay(day, selectedStart) || isSameDay(day, selectedEnd);
                const inRange = selectedStart && selectedEnd && day >= selectedStart && day <= selectedEnd;
                const inCursorMonth = day.getMonth() === cursor.getMonth();
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    className={`h-9 rounded-lg text-sm font-semibold transition ${
                      active
                        ? 'bg-brand-500 text-white shadow-sm'
                        : monthMode && inCursorMonth
                          ? 'bg-blue-100 text-brand-700 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-200'
                          : inRange
                          ? 'bg-blue-100 text-brand-700 dark:bg-blue-950 dark:text-blue-200'
                          : inCursorMonth
                            ? 'text-slate-700 hover:bg-white dark:text-slate-200 dark:hover:bg-slate-900'
                            : 'text-slate-300 hover:bg-white dark:text-slate-600 dark:hover:bg-slate-900'
                    }`}
                    onClick={() => chooseDay(day)}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="min-w-0 flex-1 truncate">{monthMode ? cursor.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) : period === 'month' ? formatMonthLabel(selectedStart) : formatRangeLabel(selectedStart, selectedEnd)}</span>
            <button
              type="button"
              className="rounded-lg px-2.5 py-1.5 font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
              onClick={() => {
                setMonthMode(false);
                onChange({ period: '', startDate: '', endDate: '' });
              }}
            >
              Очистить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function buildMonthDays(date) {
  const start = monthStart(date);
  const offset = (start.getDay() + 6) % 7;
  const first = new Date(start);
  first.setDate(start.getDate() - offset);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(first);
    day.setDate(first.getDate() + index);
    day.setHours(0, 0, 0, 0);
    return day;
  });
}

function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function parseIsoDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isSameDay(left, right) {
  return Boolean(right && left.toDateString() === right.toDateString());
}

function formatRangeLabel(start, end) {
  const format = (date) => date?.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
  if (start && end) return `${format(start)} - ${format(end)}`;
  if (start) return `С ${format(start)}`;
  return 'Выберите период';
}

function formatMonthLabel(date) {
  if (!date) return 'Месяц';
  return date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
}
