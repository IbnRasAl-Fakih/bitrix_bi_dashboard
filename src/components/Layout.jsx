import { NavLink, useLocation } from 'react-router-dom';
import {
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  Clock,
  Database,
  FilterX,
  LayoutDashboard,
  Menu,
  Moon,
  RefreshCw,
  Settings,
  Sun,
  Target,
  Users,
  WalletCards
} from '../icons/index.jsx';
import { DateRangePicker, Select, SearchField } from './FormControls.jsx';
import { statusLabel } from '../utils/format.js';

const nav = [
  ['/', 'Главная', LayoutDashboard],
  ['/occupancy', 'Занятость по проектам', BarChart3],
  ['/time', 'Рабочее время', Clock],
  ['/projects', 'Проекты', BriefcaseBusiness],
  ['/finance', 'Финансы', WalletCards],
  ['/tasks', 'Задачи', CheckCircle2],
  ['/employees', 'Сотрудники', Users],
  ['/strategy', 'Стратегия', Target],
  ['/settings', 'Настройки', Settings],
  ['/sync', 'Синхронизация', Database]
];

const filterPages = new Set(['/', '/occupancy', '/time', '/projects', '/finance', '/tasks', '/employees']);

const initialFilters = {
  period: '90d',
  startDate: '',
  endDate: '',
  project: '',
  employee: '',
  department: '',
  projectStatus: '',
  taskStatus: '',
  query: ''
};

export function Sidebar({ collapsed, setCollapsed, syncNow, syncing, status, theme, setTheme }) {
  const themeLabel = theme === 'light' ? 'Темная тема' : 'Светлая тема';

  return (
    <aside className={`sticky top-0 hidden h-screen border-r border-slate-200 bg-white p-4 transition-[width] duration-200 dark:border-slate-800 dark:bg-slate-900 lg:flex lg:flex-col ${collapsed ? 'w-[88px]' : 'w-[284px]'}`}>
      <div className={`mb-5 flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
        <button
          className="icon-btn shrink-0"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
          aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
        >
          <Menu size={20} />
        </button>
        {!collapsed && (
          <div className="min-w-0">
            <strong className="block truncate leading-tight">Панель руководителя</strong>
            <span className="block truncate text-xs text-slate-500">Битрикс24 аналитика</span>
          </div>
        )}
      </div>

      <nav className="grid gap-1.5">
        {nav.map(([to, label, Icon]) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            title={collapsed ? label : undefined}
            className={({ isActive }) => `flex items-center rounded-lg py-2.5 text-sm transition ${
              collapsed ? 'justify-center px-0' : 'gap-3 px-3 text-left'
            } ${
              isActive
                ? 'bg-blue-50 font-semibold text-slate-950 shadow-[inset_3px_0_0_#1d70f7] dark:bg-slate-800 dark:text-white'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white'
            }`}
          >
            <Icon size={18} />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto border-t border-slate-200 pt-4 dark:border-slate-800">
        {!collapsed && (
          <div className="mb-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span>Статус</span>
              <strong className="text-slate-700 dark:text-slate-200">{statusLabel(status.status)}</strong>
            </div>
            <div className="leading-relaxed">
              {status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString('ru-RU') : 'Синхронизация еще не выполнялась'}
            </div>
            {status.error && <div className="mt-2 text-red-500">{status.error}</div>}
          </div>
        )}

        <div className={`mb-4 flex ${collapsed ? 'flex-col gap-2' : 'gap-2'}`}>
          <button
            className={collapsed ? 'icon-btn w-full' : 'icon-btn shrink-0'}
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            title={themeLabel}
            aria-label={themeLabel}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          <button
            className={collapsed ? 'icon-btn w-full' : 'btn btn-primary min-w-0 flex-1 px-3'}
            onClick={syncNow}
            disabled={syncing}
            title="Синхронизировать данные"
            aria-label="Синхронизировать данные"
          >
            <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
            {!collapsed && <span className="truncate">Синхронизировать</span>}
          </button>
        </div>

        <div className={`flex min-w-0 items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <img className="h-11 w-11 shrink-0 object-contain" src="/logo-iq.svg" alt="IQ" />
          {!collapsed && (
            <div className="min-w-0">
              <strong className="block truncate text-sm leading-tight">Администратор</strong>
              <span className="block truncate text-xs text-slate-500">Руководитель проектов</span>
              <span className="block truncate text-xs text-slate-400">admin@iqs.kz</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

export function Topbar({ filters, setFilters, data }) {
  const location = useLocation();
  const showFilters = filterPages.has(location.pathname);
  const departments = [...new Set(data.users.map((user) => user.department).filter(Boolean))];
  const setFilter = (patch) => setFilters({ ...filters, ...patch });

  if (!showFilters) return null;

  return (
    <header className="relative z-[80] mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <DateRangePicker
          period={filters.period}
          startDate={filters.startDate}
          endDate={filters.endDate}
          onChange={(patch) => setFilter(patch)}
        />
        <Select value={filters.project} onChange={(project) => setFilter({ project })} placeholder="Все проекты" options={data.projects.map((project) => [project.id, project.name])} />
        <Select value={filters.employee} onChange={(employee) => setFilter({ employee })} placeholder="Все сотрудники" options={data.users.map((user) => [user.id, user.name])} />
        <Select value={filters.department} onChange={(department) => setFilter({ department })} placeholder="Все отделы" options={departments.map((department) => [department, department])} />
        <Select value={filters.taskStatus} onChange={(taskStatus) => setFilter({ taskStatus })} placeholder="Статус задачи" options={[['open', 'Открытые'], ['progress', 'В работе'], ['closed', 'Выполненные']]} />
        <SearchField value={filters.query} onChange={(query) => setFilter({ query })} />
        <button className="icon-btn" title="Сбросить фильтры" onClick={() => setFilters(initialFilters)}>
          <FilterX size={18} />
        </button>
      </div>
    </header>
  );
}
