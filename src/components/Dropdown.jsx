import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from '../icons/index.jsx';

export default function Dropdown({
  value,
  onChange,
  options,
  placeholder = 'Все',
  icon,
  searchable = true,
  multiple = false,
  className = ''
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  const selectedValues = useMemo(() => {
    if (!multiple) return value ? [value] : [];
    return Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];
  }, [multiple, value]);
  const selectedValueSet = useMemo(() => new Set(selectedValues), [selectedValues]);
  const selectedOptions = useMemo(
    () => options.filter(([optionValue]) => selectedValueSet.has(optionValue)),
    [options, selectedValueSet]
  );
  const selected = selectedOptions[0];
  const label = multiple
    ? formatMultipleLabel(selectedOptions, placeholder)
    : selected?.[1] || placeholder;

  const filtered = useMemo(() => {
    const normalized = query.toLowerCase();
    return options.filter(([, label]) => String(label).toLowerCase().includes(normalized));
  }, [options, query]);

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

  function choose(nextValue) {
    if (multiple) {
      const nextValues = selectedValueSet.has(nextValue)
        ? selectedValues.filter((currentValue) => currentValue !== nextValue)
        : [...selectedValues, nextValue];
      onChange(nextValues);
      return;
    }

    onChange(nextValue);
    setOpen(false);
    setQuery('');
  }

  function clear() {
    onChange(multiple ? [] : '');
    if (!multiple) setOpen(false);
    setQuery('');
  }

  return (
    <div className={`relative ${open ? 'z-[120]' : 'z-0'} ${className}`} ref={ref}>
      <button
        type="button"
        className={`flex min-h-10 min-w-36 items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
          open
            ? 'border-brand-500 bg-white shadow-lg shadow-blue-500/10 ring-4 ring-blue-100 dark:bg-slate-900 dark:ring-blue-950'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
        }`}
        onClick={() => setOpen((current) => !current)}
      >
        {icon && <span className="text-slate-400">{icon}</span>}
        <span className={`max-w-48 flex-1 whitespace-normal break-words text-left leading-5 ${selectedValues.length ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500'}`}>
          {label}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-12 z-[120] w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900">
          {searchable && options.length > 6 && (
            <label className="m-2 flex h-9 items-center gap-2 rounded-lg bg-slate-50 px-3 text-slate-400 dark:bg-slate-800">
              <Search size={15} />
              <input
                className="w-full border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Найти"
                autoFocus
              />
            </label>
          )}

          <div className="max-h-72 overflow-auto p-1.5">
            <Option active={!selectedValues.length} label={placeholder} onClick={clear} />
            {filtered.map(([optionValue, label]) => (
              <Option
                key={optionValue}
                active={selectedValueSet.has(optionValue)}
                label={label}
                onClick={() => choose(optionValue)}
              />
            ))}
            {!filtered.length && <div className="px-3 py-6 text-center text-sm text-slate-500">Ничего не найдено</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function formatMultipleLabel(selectedOptions, placeholder) {
  if (!selectedOptions.length) return placeholder;
  if (selectedOptions.length === 1) return selectedOptions[0][1];
  return `${selectedOptions[0][1]} +${selectedOptions.length - 1}`;
}

function Option({ active, label, onClick }) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
        active
          ? 'bg-blue-50 font-semibold text-brand-700 dark:bg-blue-950 dark:text-blue-200'
          : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
      }`}
      onClick={onClick}
    >
      <span className="grid h-4 w-4 shrink-0 place-items-center">{active && <Check size={14} />}</span>
      <span className="min-w-0 whitespace-normal break-words leading-5">{label}</span>
    </button>
  );
}
