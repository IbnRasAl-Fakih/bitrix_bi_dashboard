import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ChartCard from '../components/ChartCard.jsx';
import { EmptyState } from '../components/DataState.jsx';
import Metric from '../components/Metric.jsx';
import MoneyValue from '../components/MoneyValue.jsx';
import { BarSimple, Donut, FinanceBars } from '../components/charts.jsx';
import { AlertTriangle, ArrowRight, BriefcaseBusiness, Calendar, CheckCircle2, Target } from '../icons/index.jsx';

const COMPANY_FILTERS = [['all', 'Все компании'], ['iqs', 'iQ-Solutions'], ['iqse', 'IQS Engineering']];

export default function StrategyPage({ data, setDetail }) {
  const [company, setCompany] = useState('all');
  const goals = useMemo(() => [
    ...data.projects
      .filter((project) => hasTag(project, 'цель'))
      .map((project) => buildGoal(project, data.tasks.filter((task) => task.projectId === project.id))),
    ...buildUnlinkedGoals(data)
  ], [data.projects, data.tasks]);
  const visibleGoals = company === 'all' ? goals : goals.filter((goal) => goal.companyKey === company);
  const summary = summarizeGoals(visibleGoals);
  const goalColumns = [['name', 'Цель'], ['companyLabel', 'Компания'], ['completion', 'Выполнение, %'], ['taskCount', 'Задач'], ['overdueTasks', 'Просрочено'], ['income', 'Доход'], ['profit', 'Прибыль'], ['periodLabel', 'Период'], ['risk', 'Риск']];

  function openGoals(label, rows, description = 'Детализация стратегических целей по выбранному показателю.') {
    setDetail({ scope: 'strategy', label, title: label, description, rows, columns: goalColumns });
  }

  if (!goals.length) {
    return <EmptyState title="Цели не найдены" description="Добавьте проектам Bitrix24 тег «цель», а также тег компании «iqs» или «iqse», затем запустите синхронизацию." />;
  }

  return (
    <>
      <OverviewHero summary={summary} />
      <div className="mb-4 flex flex-wrap gap-2">
        {COMPANY_FILTERS.map(([key, label]) => <button className={`btn ${company === key ? 'btn-primary' : ''}`} key={key} onClick={() => setCompany(key)}>{label}</button>)}
      </div>

      <section className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric title="Целей" value={summary.count} onClick={() => openGoals('Все цели', visibleGoals)} />
        <Metric title="Среднее выполнение" value={`${summary.completion}%`} onClick={() => openGoals('Выполнение целей', visibleGoals)} />
        <Metric title="Доход по целям" value={<MoneyValue value={summary.income} />} onClick={() => openGoals('Доход по целям', visibleGoals.filter(hasFinance))} />
        <Metric title="Прибыль по целям" value={<MoneyValue value={summary.profit} />} onClick={() => openGoals('Прибыль по целям', visibleGoals.filter(hasFinance))} />
        <Metric title="Требуют внимания" value={summary.atRisk} onClick={() => openGoals('Цели, требующие внимания', visibleGoals.filter((goal) => goal.risk !== 'low'))} />
      </section>

      <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard title="Выполнение целей" empty={!visibleGoals.length}><BarSimple data={visibleGoals.map((goal) => ({ name: goal.name, value: goal.completion }))} /></ChartCard>
        <ChartCard title="Состояние портфеля" empty={!visibleGoals.length}><Donut data={summary.riskDistribution} /></ChartCard>
        <ChartCard title="Финансовый результат целей" empty={!visibleGoals.some(hasFinance)}><FinanceBars data={visibleGoals.filter(hasFinance)} /></ChartCard>
      </section>

      {['iqs', 'iqse'].map((companyKey) => {
        const companyGoals = visibleGoals.filter((goal) => goal.companyKey === companyKey);
        if (!companyGoals.length) return null;
        return (
          <section className="panel mb-4 p-4" key={companyKey}>
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-brand-600 dark:bg-blue-950/40"><BriefcaseBusiness size={20} /></span>
              <div><h2 className="text-lg font-bold">{companyKey === 'iqs' ? 'iQ-Solutions' : 'IQS Engineering'}</h2><p className="text-sm text-slate-500">{companyGoals.length} {goalWord(companyGoals.length)} в портфеле</p></div>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">{companyGoals.map((goal) => <GoalCard goal={goal} key={goal.id} />)}</div>
          </section>
        );
      })}
    </>
  );
}

function OverviewHero({ summary }) {
  return (
    <section className="panel relative mb-4 overflow-hidden border-0 bg-gradient-to-br from-slate-950 via-blue-950 to-brand-700 p-6 text-white">
      <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl" />
      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div><span className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-100"><Target size={15} /> Стратегия компании</span><h1 className="text-3xl font-black tracking-tight md:text-4xl">Портфель стратегических целей</h1><p className="mt-2 max-w-2xl text-sm text-blue-100">Сводный взгляд на выполнение, сроки, риски и финансовый результат целей группы компаний.</p></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><HeroStat label="Общий прогресс" value={`${summary.completion}%`} /><HeroStat label="В срок" value={summary.onTrack} /><HeroStat label="В зоне риска" value={summary.atRisk} /></div>
      </div>
    </section>
  );
}

function HeroStat({ label, value }) {
  return <div className="min-w-32 rounded-xl border border-white/10 bg-white/10 p-3 backdrop-blur"><span className="block text-xs text-blue-100">{label}</span><strong className="mt-1 block text-xl">{value}</strong></div>;
}

function GoalCard({ goal }) {
  const risk = riskMeta(goal.risk);
  return (
    <Link className="rounded-xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900" to={`/strategy/${encodeURIComponent(goal.id)}`}>
      <div className="flex items-start justify-between gap-3"><div><span className="text-xs font-bold uppercase tracking-wider text-brand-600">{goal.companyLabel}</span><h3 className="mt-1 text-lg font-bold">{goal.name}</h3></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${risk.className}`}>{risk.label}</span></div>
      <div className="mt-5 flex items-end justify-between gap-4"><div><span className="text-sm text-slate-500">Выполнение цели</span><strong className="mt-1 block text-3xl">{goal.completion}%</strong></div><span className="text-sm text-slate-500">{goal.closedTasks} из {goal.taskCount} задач</span></div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><span className={`block h-full rounded-full ${risk.bar}`} style={{ width: `${goal.completion}%` }} /></div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CardStat label="Доход" value={<MoneyValue value={goal.income || 0} />} />
        <CardStat icon={<CheckCircle2 size={15} />} label="Прибыль" value={<MoneyValue value={goal.profit || 0} />} />
        <CardStat icon={<Calendar size={15} />} label="Период" value={goal.periodLabel} />
        <CardStat icon={<AlertTriangle size={15} />} label="Просрочено" value={goal.overdueTasks} />
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm dark:border-slate-800"><span className="text-slate-500">{goal.responsible}</span><span className="inline-flex items-center gap-1 font-semibold text-brand-600">Открыть цель <ArrowRight size={16} /></span></div>
    </Link>
  );
}

function CardStat({ icon, label, value }) {
  return <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60"><span className="flex items-center gap-1 text-xs text-slate-500">{icon}{label}</span><strong className="mt-1 block truncate text-sm">{value}</strong></div>;
}

function buildGoal(project, tasks) {
  const closedTasks = tasks.filter((task) => task.status === 'closed').length;
  const overdueTasks = tasks.filter((task) => task.overdue).length;
  const completion = Math.round((closedTasks / Math.max(tasks.length, 1)) * 100);
  const taskStarts = tasks.map((task) => task.startDatePlan || task.createdAt).filter(Boolean).map((value) => new Date(value));
  const taskEnds = tasks.map((task) => task.endDatePlan || task.deadline || task.closedAt).filter(Boolean).map((value) => new Date(value));
  const start = project.startDate ? new Date(project.startDate) : validExtreme(taskStarts, Math.min);
  const deadline = project.endDate ? new Date(project.endDate) : validExtreme(taskEnds, Math.max);
  const deadlinePassed = deadline && deadline.getTime() < Date.now() && completion < 100;
  const risk = overdueTasks > 0 || deadlinePassed ? 'high' : (project.progress || 0) > completion + 10 ? 'medium' : 'low';
  const companyKey = hasTag(project, 'iqse') ? 'iqse' : 'iqs';
  return { ...project, companyKey, companyLabel: companyKey === 'iqse' ? 'IQS Engineering' : 'iQ-Solutions', taskCount: tasks.length, closedTasks, overdueTasks, completion, risk, periodLabel: formatPeriod(start, deadline) };
}

function buildUnlinkedGoals(data) {
  return ['iqs', 'iqse'].map((companyKey) => {
    const projects = data.projects.filter((project) => !hasTag(project, 'цель') && !project.goalId && hasTag(project, companyKey));
    if (!projects.length) return null;
    const projectIds = new Set(projects.map((project) => project.id));
    const tasks = data.tasks.filter((task) => projectIds.has(task.projectId));
    const closedTasks = tasks.filter((task) => task.status === 'closed').length;
    const overdueTasks = tasks.filter((task) => task.overdue).length;
    const starts = tasks.map((task) => task.startDatePlan || task.createdAt).filter(Boolean).map((value) => new Date(value));
    const ends = tasks.map((task) => task.endDatePlan || task.deadline || task.closedAt).filter(Boolean).map((value) => new Date(value));
    return {
      id: `unlinked-${companyKey}`,
      name: 'Без цели',
      companyKey,
      companyLabel: companyKey === 'iqse' ? 'IQS Engineering' : 'iQ-Solutions',
      responsible: 'Не назначен',
      taskCount: tasks.length,
      closedTasks,
      overdueTasks,
      completion: Math.round((closedTasks / Math.max(tasks.length, 1)) * 100),
      income: projects.reduce((sum, project) => sum + Number(project.income || 0), 0),
      expense: projects.reduce((sum, project) => sum + Number(project.expense || 0), 0),
      profit: projects.reduce((sum, project) => sum + Number(project.profit || 0), 0),
      risk: overdueTasks ? 'high' : 'medium',
      periodLabel: formatPeriod(validExtreme(starts, Math.min), validExtreme(ends, Math.max)),
      virtual: true
    };
  }).filter(Boolean);
}

function validExtreme(dates, operation) {
  const values = dates.map((date) => date.getTime()).filter(Number.isFinite);
  return values.length ? new Date(operation(...values)) : null;
}

function formatPeriod(start, end) {
  const format = (date) => date?.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: '2-digit' });
  if (start && end) return `${format(start)} - ${format(end)}`;
  return format(end || start) || 'Не указан';
}

function summarizeGoals(goals) {
  const totalTasks = goals.reduce((sum, goal) => sum + goal.taskCount, 0);
  const closedTasks = goals.reduce((sum, goal) => sum + goal.closedTasks, 0);
  const riskCount = (risk) => goals.filter((goal) => goal.risk === risk).length;
  return {
    count: goals.length,
    completion: Math.round((closedTasks / Math.max(totalTasks, 1)) * 100),
    income: goals.reduce((sum, goal) => sum + Number(goal.income || 0), 0),
    profit: goals.reduce((sum, goal) => sum + Number(goal.profit || 0), 0),
    onTrack: riskCount('low'),
    atRisk: riskCount('medium') + riskCount('high'),
    riskDistribution: [{ name: 'В срок', value: riskCount('low') }, { name: 'Есть отклонения', value: riskCount('medium') }, { name: 'Высокий риск', value: riskCount('high') }].filter((row) => row.value)
  };
}

function hasTag(project, tag) {
  return (project.tags || []).some((value) => String(value).trim().toLowerCase() === tag);
}

function hasFinance(goal) {
  return goal.income !== null || goal.expense !== null || goal.profit !== null;
}

function riskMeta(risk) {
  return {
    low: { label: 'В срок', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200', bar: 'bg-emerald-500' },
    medium: { label: 'Есть отклонения', className: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200', bar: 'bg-amber-500' },
    high: { label: 'Высокий риск', className: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200', bar: 'bg-red-500' }
  }[risk];
}

function goalWord(count) {
  return count === 1 ? 'цель' : count > 1 && count < 5 ? 'цели' : 'целей';
}
