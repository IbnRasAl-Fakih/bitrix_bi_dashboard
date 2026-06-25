import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  LineChart,
  Line,
  PieChart,
  Pie,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend
} from 'recharts';
import { colors } from '../utils/data.js';
import { formatMoneyText } from './MoneyValue.jsx';

const axisTick = { fontSize: 11, fill: 'var(--chart-muted)' };
const grid = { stroke: 'var(--chart-grid)', strokeDasharray: '3 3' };
const tooltipCursor = { fill: 'var(--chart-cursor)' };
const legendStyle = { color: 'var(--chart-muted)', fontSize: 12 };

function shortNumber(value) {
  const number = Number(value || 0);
  const abs = Math.abs(number);
  if (abs >= 1_000_000_000) return `${Math.round(number / 100_000_000) / 10} млрд`;
  if (abs >= 1_000_000) return `${Math.round(number / 100_000) / 10} млн`;
  if (abs >= 1_000) return `${Math.round(number / 100) / 10} тыс`;
  return String(Math.round(number));
}

function ellipsis(value, max = 16) {
  const text = String(value || '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function MoneyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-2 max-w-64 font-semibold text-slate-900 dark:text-white">{label}</div>
      <div className="grid gap-1">
        {payload.map((item) => (
          <div className="flex items-center justify-between gap-4" key={item.dataKey}>
            <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <i className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
              {item.name}
            </span>
            <strong className="text-slate-900 dark:text-white">{formatMoneyText(item.value)} ₸</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label, formatter = shortNumber }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900">
      {label !== undefined && <div className="mb-2 max-w-64 font-semibold text-slate-900 dark:text-white">{label}</div>}
      <div className="grid gap-1">
        {payload.map((item, index) => (
          <div className="flex items-center justify-between gap-4" key={`${item.dataKey}-${index}`}>
            <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <i className="h-2.5 w-2.5 rounded-full" style={{ background: item.color || item.fill }} />
              {item.name}
            </span>
            <strong className="text-slate-900 dark:text-white">{formatter(item.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmployeeBars({ data, onClick, showLegend = true }) {
  const metricName = data.find((row) => row.metricName)?.metricName || 'Факт';
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 18, left: 4, bottom: 30 }} onClick={(event) => event?.activePayload?.[0] && onClick?.(event.activePayload[0].payload)}>
        <CartesianGrid {...grid} />
        <XAxis dataKey="name" tick={axisTick} tickFormatter={(value) => ellipsis(value, 12)} interval={0} angle={-18} textAnchor="end" height={58} />
        <YAxis tick={axisTick} tickFormatter={shortNumber} width={48} />
        <Tooltip cursor={tooltipCursor} content={<ChartTooltip />} />
        {showLegend && <Legend wrapperStyle={legendStyle} />}
        <Bar dataKey="hours" name={metricName} fill="#1d70f7" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function FinanceBars({ data, showLegend = true }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 18, left: 28, bottom: 42 }}>
        <CartesianGrid {...grid} />
        <XAxis dataKey="name" tick={axisTick} tickFormatter={(value) => ellipsis(value, 14)} interval={0} angle={-22} textAnchor="end" height={72} />
        <YAxis tick={axisTick} tickFormatter={shortNumber} width={72} />
        <Tooltip cursor={tooltipCursor} content={<MoneyTooltip />} />
        {showLegend && <Legend wrapperStyle={legendStyle} />}
        <Bar dataKey="income" name="Доход" fill="#1d70f7" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expense" name="Расход" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        <Bar dataKey="profit" name="Прибыль" fill="#14a38b" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LinePanel({ data, first, second, third, showLegend = true, firstName }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 18, left: 16, bottom: 12 }}>
        <CartesianGrid {...grid} />
        <XAxis dataKey="month" tick={axisTick} />
        <YAxis tick={axisTick} tickFormatter={shortNumber} width={58} />
        <Tooltip cursor={tooltipCursor} content={<ChartTooltip />} />
        {showLegend && <Legend wrapperStyle={legendStyle} />}
        <Line type="monotone" dataKey={first} stroke="#1d70f7" strokeWidth={3} name={firstName || nameOf(first)} dot={false} />
        {second && <Line type="monotone" dataKey={second} stroke="#f59e0b" strokeWidth={3} name={nameOf(second)} dot={false} />}
        {third && <Line type="monotone" dataKey={third} stroke="#14a38b" strokeWidth={3} name={nameOf(third)} dot={false} />}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data, showLegend = true }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <Tooltip content={<ChartTooltip />} />
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="50%" outerRadius="72%" paddingAngle={3}>
          {data.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}
        </Pie>
        {showLegend && <Legend wrapperStyle={legendStyle} />}
      </PieChart>
    </ResponsiveContainer>
  );
}

export function Stacked({ data, keys, showLegend = true }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 18, left: 10, bottom: 42 }}>
        <CartesianGrid {...grid} />
        <XAxis dataKey="name" tick={axisTick} tickFormatter={(value) => ellipsis(value, 14)} interval={0} angle={-22} textAnchor="end" height={72} />
        <YAxis tick={axisTick} tickFormatter={shortNumber} width={52} />
        <Tooltip cursor={tooltipCursor} content={<ChartTooltip />} />
        {showLegend && <Legend wrapperStyle={legendStyle} />}
        {keys.map((key, index) => <Bar key={key} dataKey={key} stackId="a" fill={colors[index % colors.length]} radius={index === keys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BarSimple({ data, showLegend = false }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 18, left: 10, bottom: 42 }}>
        <CartesianGrid {...grid} />
        <XAxis dataKey="name" tick={axisTick} tickFormatter={(value) => ellipsis(value, 14)} interval={0} angle={-22} textAnchor="end" height={72} />
        <YAxis tick={axisTick} tickFormatter={shortNumber} width={52} />
        <Tooltip cursor={tooltipCursor} content={<ChartTooltip />} />
        {showLegend && <Legend wrapperStyle={legendStyle} />}
        <Bar dataKey="value" name="Значение" fill="#1d70f7" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function nameOf(key) {
  return {
    income: 'Доход',
    expense: 'Расход',
    profit: 'Прибыль',
    hours: 'Часы',
    closed: 'Выполнено',
    created: 'Создано'
  }[key] || key;
}
