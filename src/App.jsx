import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Sidebar, Topbar } from './components/Layout.jsx';
import Skeleton from './components/Skeleton.jsx';
import DetailDrawer from './components/DetailDrawer.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Occupancy from './pages/Occupancy.jsx';
import TimePage from './pages/TimePage.jsx';
import StrategyPage from './pages/StrategyPage.jsx';
import StrategyDetailPage from './pages/StrategyDetailPage.jsx';
import ProjectsPage from './pages/ProjectsPage.jsx';
import FinancePage from './pages/FinancePage.jsx';
import TasksPage from './pages/TasksPage.jsx';
import EmployeesPage from './pages/EmployeesPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import SyncPage from './pages/SyncPage.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import { EmptyState, ErrorState, NotificationCenter } from './components/DataState.jsx';
import { RefreshCw } from './icons/index.jsx';
import { applyFilters, emptyData } from './utils/data.js';

export default function App() {
  const [theme, setTheme] = useState('light');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [payload, setPayload] = useState(null);
  const [status, setStatus] = useState({ status: 'idle', source: 'bitrix', logs: [] });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [detail, setDetail] = useState(null);
  const [filters, setFilters] = useState({
    period: '90d',
    project: '',
    employee: '',
    department: '',
    projectStatus: '',
    taskStatus: '',
    query: ''
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    loadData();
    fetch('/api/status').then((response) => response.json()).then(setStatus).catch(() => {});
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const response = await fetch('/api/data');
      const json = await response.json();
      setPayload(json.data);
      setStatus(json);
    } finally {
      setLoading(false);
    }
  }

  async function syncNow() {
    setSyncing(true);
    try {
      const response = await fetch('/api/sync', { method: 'POST' });
      const json = await response.json();
      setPayload(json.data);
      setStatus(json);
    } finally {
      setSyncing(false);
    }
  }

  const data = payload || emptyData();
  const filtered = useMemo(() => applyFilters(data, filters), [data, filters]);

  return (
    <div className={`grid min-h-screen grid-cols-1 transition-[grid-template-columns] duration-200 ${sidebarCollapsed ? 'lg:grid-cols-[88px_1fr]' : 'lg:grid-cols-[284px_1fr]'}`}>
      <ScrollToTop />
      <NotificationCenter warnings={data.meta?.warnings || []} />
      <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <main className="min-w-0 p-4 md:p-5">
        <Topbar
          filters={filters}
          setFilters={setFilters}
          data={data}
          status={status}
          theme={theme}
          setTheme={setTheme}
          syncNow={syncNow}
          syncing={syncing}
        />
        {loading ? <Skeleton /> : status.status === 'error' ? (
          <ErrorState
            description={status.error || 'Не удалось получить данные из Bitrix24.'}
            onRetry={syncNow}
          />
        ) : !data.meta?.realRecords ? (
          <EmptyState
            title="Данных Bitrix24 не найдено"
            description="Синхронизация не вернула доступные проекты, задачи, сотрудников или сделки. Проверьте права API и выбранный период."
            action={<button className="btn btn-primary mt-5" onClick={syncNow}><RefreshCw size={18} /> Синхронизировать данные</button>}
          />
        ) : (
          <Routes>
            <Route path="/" element={<Dashboard data={filtered} setDetail={setDetail} />} />
            <Route path="/occupancy" element={<Occupancy data={filtered} filters={filters} setFilters={setFilters} />} />
            <Route path="/time" element={<TimePage data={filtered} />} />
            <Route path="/strategy" element={<StrategyPage data={data} setDetail={setDetail} />} />
            <Route path="/strategy/:projectId" element={<StrategyDetailPage data={data} setDetail={setDetail} />} />
            <Route path="/projects" element={<ProjectsPage data={filtered} />} />
            <Route path="/finance" element={<FinancePage data={filtered} />} />
            <Route path="/tasks" element={<TasksPage data={filtered} />} />
            <Route path="/employees" element={<EmployeesPage data={filtered} />} />
            <Route path="/settings" element={<SettingsPage status={status} syncNow={syncNow} data={data} />} />
            <Route path="/sync" element={<SyncPage status={status} syncNow={syncNow} syncing={syncing} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>
      {detail && <DetailDrawer detail={detail} data={detail.scope === 'strategy' ? data : filtered} onClose={() => setDetail(null)} />}
    </div>
  );
}
