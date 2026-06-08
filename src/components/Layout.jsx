import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  BriefcaseBusiness,
  Calendar,
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
import { Select, SearchField } from './FormControls.jsx';
import SourceBadge from './SourceBadge.jsx';
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

export function Sidebar({ collapsed, setCollapsed }) {
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

export function Topbar({ filters, setFilters, data, status, theme, setTheme, syncNow, syncing }) {
  const departments = [...new Set(data.users.map((user) => user.department))];

  return (
    <>
      <header className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Select icon={<Calendar size={16} />} value={filters.period} onChange={(period) => setFilters({ ...filters, period })} options={[['30d', '30 дней'], ['90d', '90 дней'], ['180d', '180 дней'], ['year', 'Год']]} />
          <Select value={filters.project} onChange={(project) => setFilters({ ...filters, project })} placeholder="Все проекты" options={data.projects.map((project) => [project.id, project.name])} />
          <Select value={filters.employee} onChange={(employee) => setFilters({ ...filters, employee })} placeholder="Все сотрудники" options={data.users.map((user) => [user.id, user.name])} />
          <Select value={filters.department} onChange={(department) => setFilters({ ...filters, department })} placeholder="Все отделы" options={departments.map((department) => [department, department])} />
          <Select value={filters.taskStatus} onChange={(taskStatus) => setFilters({ ...filters, taskStatus })} placeholder="Статус задачи" options={[['open', 'Открытые'], ['progress', 'В работе'], ['closed', 'Закрытые']]} />
          <SearchField value={filters.query} onChange={(query) => setFilters({ ...filters, query })} />
          <button className="icon-btn" title="Сбросить фильтры" onClick={() => setFilters({ period: '90d', project: '', employee: '', department: '', projectStatus: '', taskStatus: '', query: '' })}>
            <FilterX size={18} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button className="icon-btn" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <button className="btn btn-primary" onClick={syncNow} disabled={syncing}>
            <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
            Синхронизировать данные
          </button>
        </div>
      </header>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>Статус: {statusLabel(status.status)}</span>
        <span>Последнее обновление: {status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString('ru-RU') : 'еще не выполнялось'}</span>
        {status.error && <span className="text-red-500">{status.error}</span>}
      </div>
    </>
  );
}
