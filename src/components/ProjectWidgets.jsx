import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Flag, SlidersHorizontal } from '../icons/index.jsx';
import Dropdown from './Dropdown.jsx';
import { riskLabel } from '../utils/format.js';

const MS_DAY = 24 * 60 * 60 * 1000;

export function ProjectCard({ project, selected = false, onClick }) {
  const type = projectTypeMeta(project);
  const datedProject = normalizeProjectDates(project, 0);
  const progress = timeProgress(datedProject.start, datedProject.end);

  return (
    <button
      className={`panel block border-l-4 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-500 ${type.border} ${type.background} ${selected ? 'ring-2 ring-brand-500' : ''}`}
      type="button"
      onClick={onClick}
    >
      <div>
        <div className="mb-2 flex items-start justify-between gap-3">
          <h3 className="text-base font-bold">{project.name}</h3>
          <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${type.badge}`}>{type.label}</span>
        </div>
        <span className="text-sm text-slate-500">{project.responsible || 'Ответственный не указан'}</span>
      </div>
      <div className="my-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <span className={`block h-full rounded-full ${type.progress}`} style={{ width: `${progress}%` }} />
      </div>
      <div className="flex justify-between gap-2 text-xs text-slate-500">
        <span>{progress}% по сроку</span>
        <span>{project.taskCount || 0} задач</span>
        <span>{riskLabel(project.risk)}</span>
      </div>
    </button>
  );
}

export function projectTypeMeta(project) {
  const tags = (project.tags || []).map((tag) => String(tag).trim().toLowerCase());
  const systemNames = ['больничный', 'отпуск', 'отсутствия', 'административные задачи'];
  if (tags.includes('системный') || systemNames.some((name) => String(project.name || '').toLowerCase().includes(name))) {
    return {
      key: 'system',
      label: 'Системный',
      border: 'border-l-slate-500 hover:border-slate-500',
      background: 'bg-slate-50/70 dark:bg-slate-900',
      badge: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
      progress: 'bg-slate-500'
    };
  }
  if (tags.includes('цель')) {
    return {
      key: 'goal',
      label: 'Цель',
      border: 'border-l-violet-500 hover:border-violet-500',
      background: 'bg-violet-50/40 dark:bg-violet-950/10',
      badge: 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-200',
      progress: 'bg-violet-500'
    };
  }
  return {
    key: 'project',
    label: 'Проект',
    border: 'border-l-blue-500 hover:border-blue-500',
    background: 'bg-blue-50/30 dark:bg-blue-950/10',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-200',
    progress: 'bg-blue-500'
  };
}

export function Gantt({ projects, tasks = [], selectedProject, onSelectProject, onClearSelected, hierarchyMode = false }) {
  const [scale, setScale] = useState('month');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('start');
  const [showDetails, setShowDetails] = useState(true);
  const [offsetMonths, setOffsetMonths] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [selectedHierarchyId, setSelectedHierarchyId] = useState('');
  const panRef = useRef(null);
  const isTaskMode = Boolean(selectedProject);
  const selectedHierarchy = tasks.find((task) => task.id === selectedHierarchyId);
  const isHierarchyRoot = hierarchyMode && !selectedHierarchyId;

  useEffect(() => {
    setStatus('');
    setOffsetMonths(0);
    setSelectedHierarchyId('');
  }, [selectedProject?.id]);

  const rows = useMemo(() => {
    const projectTasks = isTaskMode ? tasks.filter((task) => task.projectId === selectedProject.id) : [];
    const taskRows = hierarchyMode
      ? projectTasks
        .filter((task) => selectedHierarchyId ? task.parentId === selectedHierarchyId : !task.parentId || task.parentId === '0')
        .map((task, index) => ({
          ...normalizeTaskDates(task, index),
          childCount: projectTasks.filter((child) => child.parentId === task.id).length
        }))
      : projectTasks.map((task, index) => normalizeTaskDates(task, index));
    const sourceRows = isTaskMode
      ? taskRows
      : projects.map((project, index) => {
        const projectTasks = tasks.filter((task) => task.projectId === project.id);
        const normalizedTasks = projectTasks.map((task, taskIndex) => normalizeTaskDates(task, taskIndex));
        return {
          ...normalizeProjectDates(project, index),
          taskCount: project.taskCount || projectTasks.length,
          overdueTasks: normalizedTasks.filter((task) => task.overdue).length
        };
      });

    return sourceRows
      .filter((row) => !status || row.status === status)
      .sort((a, b) => {
        if (sort === 'risk') return riskWeight(b.risk) - riskWeight(a.risk);
        if (sort === 'progress') return timeProgress(b.start, b.end) - timeProgress(a.start, a.end);
        if (sort === 'status') return String(a.status).localeCompare(String(b.status), 'ru');
        return a.start - b.start;
      });
  }, [hierarchyMode, isTaskMode, projects, selectedHierarchyId, selectedProject, status, sort, tasks]);

  const stepMonths = getStepMonths(scale);
  const range = useMemo(() => buildRange(rows, scale, offsetMonths), [rows, scale, offsetMonths]);
  const todayPosition = percentage(new Date(), range.start, range.end);
  const showToday = todayPosition >= 0 && todayPosition <= 100;
  const totalTasks = isTaskMode ? rows.length : rows.reduce((acc, row) => acc + (row.taskCount || 0), 0);
  const overdueTasks = isTaskMode
    ? rows.filter((row) => row.overdue).length
    : rows.reduce((acc, row) => acc + (row.overdueTasks || 0), 0);
  const ganttTitle = hierarchyMode
    ? selectedHierarchy
      ? `Задачи направления: ${selectedHierarchy.title}`
      : 'Стратегические направления'
    : isTaskMode
      ? `Задачи проекта: ${selectedProject.name}`
      : 'Диаграмма Ганта';
  const ganttDescription = hierarchyMode
    ? selectedHierarchy
      ? 'Плановые сроки задач выбранного стратегического направления.'
      : 'Сроки реализации направлений стратегии. Выберите направление, чтобы открыть его задачи.'
    : isTaskMode
      ? 'На таймлайне показаны задачи выбранного проекта.'
      : 'Сроки проектов, прогресс по времени и риск. Нажмите на проект в диаграмме, чтобы увидеть его задачи.';

  function startTimelinePan(event) {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    panRef.current = {
      startX: event.clientX,
      startOffset: offsetMonths,
      width: Math.max(1, event.currentTarget.getBoundingClientRect().width)
    };
    setIsPanning(true);
  }

  function moveTimelinePan(event) {
    if (!panRef.current) return;
    const visibleMonths = Math.max(stepMonths, range.ticks.length * stepMonths);
    const deltaX = event.clientX - panRef.current.startX;
    const rawMonthDelta = (-deltaX / panRef.current.width) * visibleMonths;
    const snappedMonthDelta = Math.round(rawMonthDelta / stepMonths) * stepMonths;
    setOffsetMonths(clamp(panRef.current.startOffset + snappedMonthDelta, -48, 48));
  }

  function stopTimelinePan(event) {
    if (!panRef.current) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    panRef.current = null;
    setIsPanning(false);
  }

  function resetGanttView() {
    setStatus('');
    setOffsetMonths(0);
    if (selectedHierarchyId) setSelectedHierarchyId('');
    else if (isTaskMode) onClearSelected?.();
  }

  if (!rows.length) {
    return (
      <section className="panel mb-4 p-4">
        <h2 className="text-base font-bold">{ganttTitle}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {isTaskMode ? 'По выбранному проекту нет задач с доступными датами.' : 'Нет проектов с датами для отображения.'}
        </p>
        <div className="mt-4 rounded-lg bg-slate-50 p-8 text-center text-sm text-slate-500 dark:bg-slate-800">
          <p>{isTaskMode ? 'Задачи появятся здесь после синхронизации дат создания, дедлайнов или закрытия.' : 'Выберите другой период или проверьте данные проектов.'}</p>
          <button className="btn mt-4" onClick={resetGanttView}>
            {isTaskMode ? 'Все проекты' : 'Очистить фильтрацию'}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel mb-4 overflow-hidden p-4">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold">{ganttTitle}</h2>
            {isTaskMode && (!hierarchyMode || selectedHierarchyId) && (
              <button className="btn h-8 px-2 text-xs" onClick={resetGanttView}>
                {selectedHierarchyId ? 'Все направления' : 'Все проекты'}
              </button>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">{ganttDescription}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Dropdown
            value={scale}
            onChange={(value) => {
              setScale(value);
              setOffsetMonths(0);
            }}
            searchable={false}
            icon={<Calendar size={16} />}
            options={[['month', 'Месяцы'], ['quarter', 'Кварталы'], ['year', 'Год']]}
          />
          <Dropdown
            value={status}
            onChange={setStatus}
            searchable={false}
            placeholder="Все статусы"
            options={isTaskMode
              ? [['open', 'Открытые'], ['progress', 'В работе'], ['closed', 'Выполненные']]
              : [['active', 'Активные'], ['completed', 'Завершенные']]}
          />
          <Dropdown
            value={sort}
            onChange={setSort}
            searchable={false}
            icon={<SlidersHorizontal size={16} />}
            options={[['start', 'По дате старта'], ['risk', 'По риску'], ['progress', 'По времени'], ['status', 'По статусу']]}
          />
          <button className="btn" onClick={() => setShowDetails(!showDetails)}>
            {showDetails ? 'Скрыть детали' : 'Показать детали'}
          </button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-4">
        <GanttStat label={hierarchyMode ? isHierarchyRoot ? 'Направлений' : 'Задач направления' : isTaskMode ? 'Задач на диаграмме' : 'Проектов'} value={rows.length} />
        <GanttStat label="Видимый период" value={`${formatDate(range.start)} - ${formatDate(range.end)}`} />
        <GanttStat label={isTaskMode ? 'Выполнено задач' : 'Всего задач'} value={isTaskMode ? rows.filter((row) => row.status === 'closed').length : totalTasks} />
        <GanttStat label="Просрочено задач" value={overdueTasks} />
      </div>

      <div className="min-w-0 overflow-hidden">
        <div className="grid min-w-0 grid-cols-[minmax(220px,22%)_minmax(0,1fr)]">
          <div className="min-w-0">
            <div className="h-8 border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-slate-800">
              {hierarchyMode && isHierarchyRoot ? 'Направление' : isTaskMode ? 'Задача' : 'Проект'}
            </div>
            {rows.map((row) => {
              const progress = isTaskMode ? taskProgress(row) : timeProgress(row.start, row.end);
              const content = (
                <>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${riskDot(row.risk)}`} />
                    <strong className="truncate text-sm">{row.name}</strong>
                  </div>
                  {showDetails && (
                    <div className="mt-1 grid gap-0.5 text-xs text-slate-500">
                      <span>{formatDate(row.start)} - {formatDate(row.end)}</span>
                      {isTaskMode ? (
                        <>
                          <span>{statusLabel(row.status)} · {row.responsible || 'Ответственный не указан'}</span>
                          <span>{row.plannedHours || 0} ч план · {row.actualHours || 0} ч факт</span>
                        </>
                      ) : (
                        <span>{row.taskCount || 0} задач, {progress}% срока прошло</span>
                      )}
                    </div>
                  )}
                </>
              );

              return (
                <div className="h-[84px] border-b border-slate-100 dark:border-slate-800" key={row.id}>
                  {isTaskMode ? (
                    hierarchyMode && isHierarchyRoot ? (
                      <button className="block h-full w-full py-3 pr-4 text-left text-inherit outline-none" type="button" onClick={() => setSelectedHierarchyId(row.sourceId)}>
                        {content}
                      </button>
                    ) : <div className="h-full py-3 pr-4">{content}</div>
                  ) : (
                    <button className="block h-full w-full py-3 pr-4 text-left text-inherit outline-none" type="button" onClick={() => onSelectProject?.(row)}>
                      {content}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div
            className={`relative select-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
            title="Зажмите и потяните таймлайн, чтобы сдвинуть период"
            onPointerDown={startTimelinePan}
            onPointerMove={moveTimelinePan}
            onPointerUp={stopTimelinePan}
            onPointerCancel={stopTimelinePan}
            onPointerLeave={stopTimelinePan}
          >
            {showToday && <TodayLine position={todayPosition} />}
            <div className="grid h-8 border-b border-slate-200 pb-2 dark:border-slate-800" style={{ gridTemplateColumns: `repeat(${range.ticks.length}, minmax(0, 1fr))` }}>
              {range.ticks.map((tick) => (
                <div className="min-w-0 truncate border-l border-slate-200 pl-2 text-xs font-semibold text-slate-500 dark:border-slate-800" key={tick.key}>
                  {tick.label}
                </div>
              ))}
            </div>

            {rows.map((row) => {
              const rawLeft = percentage(row.start, range.start, range.end);
              const rawRight = percentage(row.end, range.start, range.end);
              const left = clamp(rawLeft, 0, 100);
              const right = clamp(rawRight, 0, 100);
              const width = Math.max(0, right - left);
              const progress = isTaskMode ? taskProgress(row) : timeProgress(row.start, row.end);
              const deadlineRisk = row.end < new Date() && row.status !== 'closed';
              const visible = rawRight >= 0 && rawLeft <= 100;

              return (
                <div className="relative h-[84px] border-b border-slate-100 py-3 dark:border-slate-800" key={row.id}>
                  <div className="absolute inset-y-3 w-full rounded-lg bg-slate-50 dark:bg-slate-800/50" />
                  <div className="absolute inset-y-3 grid w-full" style={{ gridTemplateColumns: `repeat(${range.ticks.length}, 1fr)` }}>
                    {range.ticks.map((tick) => <span className="border-l border-slate-200/70 dark:border-slate-700/70" key={tick.key} />)}
                  </div>
                  {visible && (
                    <button
                      className={`absolute top-7 h-9 rounded-full text-white shadow-sm ring-1 ring-white/40 ${isTaskMode ? statusBar(row.status, row.overdue) : riskBar(row.risk)} ${isTaskMode ? '' : 'cursor-pointer'}`}
                      style={{ left: `${left}%`, width: `${Math.max(1.6, width)}%` }}
                      title={`${row.name}: ${formatDate(row.start)} - ${formatDate(row.end)}`}
                      type="button"
                      onClick={(event) => {
                        if (hierarchyMode && isHierarchyRoot) {
                          event.stopPropagation();
                          setSelectedHierarchyId(row.sourceId);
                          return;
                        }
                        if (isTaskMode) return;
                        event.stopPropagation();
                        onSelectProject?.(row);
                      }}
                    >
                      <span className="absolute inset-y-0 left-0 rounded-full bg-white/30" style={{ width: `${progress}%` }} />
                      <span className="relative flex h-full items-center justify-center px-3 text-xs font-bold text-white">
                        {progress}%
                      </span>
                    </button>
                  )}
                  {deadlineRisk && visible && (
                    <Flag className="absolute top-6 text-red-500" size={16} style={{ left: `${Math.min(98, right)}%` }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        {isTaskMode ? (
          <>
            <LegendItem color="bg-amber-500" label="открытая" />
            <LegendItem color="bg-brand-500" label="в работе" />
            <LegendItem color="bg-emerald-500" label="закрытая" />
            <LegendItem color="bg-red-500" label="просроченная" />
          </>
        ) : (
          <>
            <LegendItem color="bg-emerald-500" label="низкий риск" />
            <LegendItem color="bg-amber-500" label="есть отклонения" />
            <LegendItem color="bg-red-500" label="высокий риск" />
          </>
        )}
        <span className="inline-flex items-center gap-2">
          <i className="h-5 border-l-[3px] border-red-500" />
          сегодня
        </span>
        <span className="inline-flex items-center">Зажмите и потяните таймлайн для просмотра прошлых и будущих периодов.</span>
      </div>
    </section>
  );
}

export function Matrix({ rows, unit = 'hours' }) {
  const employees = [...new Set(rows.map((row) => row.employee))];
  const projects = [...new Set(rows.map((row) => row.project))].slice(0, 6);
  const isDays = unit === 'days';
  const suffix = isDays ? 'дн.' : 'ч';
  const titleUnit = isDays ? 'дни' : 'часы';
  const opacityBase = isDays ? 4.4 : 35;

  return (
    <section className="panel mb-4 p-4">
      <h2 className="mb-4 text-base font-bold">Матрица сотрудники x проекты x {titleUnit}</h2>
      <div className="grid min-w-[760px] gap-1 overflow-auto" style={{ gridTemplateColumns: `190px repeat(${projects.length}, minmax(100px, 1fr))` }}>
        <div />
        {projects.map((project) => <div className="rounded-lg bg-slate-100 p-2 text-xs font-bold text-slate-500 dark:bg-slate-800" key={project}>{project}</div>)}
        {employees.map((employee) => (
          <Fragment key={employee}>
            <div className="rounded-lg bg-slate-100 p-2 text-xs font-bold text-slate-500 dark:bg-slate-800">{employee}</div>
            {projects.map((project) => {
              const value = rows.find((row) => row.employee === employee && row.project === project)?.actualHours || 0;
              return (
                <div
                  className="rounded-lg bg-brand-500 p-2 text-center text-xs font-bold text-white"
                  key={`${employee}-${project}`}
                  style={{ opacity: Math.max(0.18, Math.min(1, value / opacityBase)) }}
                >
                  {value ? `${value} ${suffix}` : '-'}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </section>
  );
}

function TodayLine({ position }) {
  return (
    <div className="pointer-events-none absolute inset-y-0 z-30" style={{ left: `${position}%` }}>
      <div className="-ml-6 mb-1 inline-flex rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow">
        Сегодня
      </div>
      <div className="absolute bottom-0 top-5 border-l-[3px] border-solid border-red-500 shadow-[0_0_0_1px_rgba(239,68,68,0.3),0_0_10px_rgba(239,68,68,0.35)]" />
    </div>
  );
}

function normalizeProjectDates(project, index) {
  const now = new Date();
  const fallbackStart = project.startDate
    ? new Date(project.startDate)
    : new Date(now.getFullYear(), now.getMonth(), Math.max(1, now.getDate() - 14 + (index % 6) * 3));
  const start = project.startDate ? new Date(project.startDate) : fallbackStart;
  const fallbackDuration = project.taskCount ? Math.min(120, Math.max(21, project.taskCount * 7)) : 45;
  const fallbackEnd = new Date(start.getTime() + fallbackDuration * MS_DAY);
  const end = project.endDate ? new Date(project.endDate) : fallbackEnd;
  return {
    ...project,
    name: project.name,
    start: Number.isNaN(start.getTime()) ? fallbackStart : snapDate(start),
    end: Number.isNaN(end.getTime()) || end < start ? fallbackEnd : snapDate(end)
  };
}

function normalizeTaskDates(task, index) {
  const created = safeDate(task.startDatePlan || task.createdAt);
  const deadline = safeDate(task.endDatePlan || task.deadline);
  const closed = safeDate(task.closedAt);
  const now = new Date();
  const fallbackStart = created || new Date(now.getFullYear(), now.getMonth(), Math.max(1, now.getDate() - 10 + index));
  const fallbackDuration = task.plannedHours ? Math.max(1, Math.ceil(task.plannedHours / 8)) : 3;
  const fallbackEnd = deadline || closed || new Date(fallbackStart.getTime() + fallbackDuration * MS_DAY);
  const snappedStart = snapDate(fallbackStart);
  let snappedEnd = snapDate(fallbackEnd < fallbackStart ? new Date(fallbackStart.getTime() + MS_DAY) : fallbackEnd);
  if (snappedEnd <= snappedStart) snappedEnd = new Date(snappedStart.getTime() + MS_DAY);
  const overdue = task.status !== 'closed' && snappedEnd < snapDate(new Date());

  return {
    ...task,
    sourceId: task.id,
    id: `task:${task.id}`,
    name: task.title || `Задача ${index + 1}`,
    start: snappedStart,
    end: snappedEnd,
    overdue,
    risk: overdue ? 'high' : task.status === 'closed' ? 'low' : 'medium'
  };
}

function buildRange(rows, scale, offsetMonths) {
  if (!rows.length) {
    const now = new Date();
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0), ticks: [] };
  }

  const min = new Date(Math.min(...rows.map((row) => row.start.getTime())));
  const max = new Date(Math.max(...rows.map((row) => row.end.getTime())));
  const today = new Date();
  const startSeed = new Date(Math.min(min.getTime(), today.getTime()));
  const endSeed = new Date(Math.max(max.getTime(), today.getTime()));
  const start = new Date(startSeed.getFullYear(), startSeed.getMonth(), 1);
  const end = new Date(endSeed.getFullYear(), endSeed.getMonth() + 1, 0);

  if (scale === 'year') {
    start.setMonth(0, 1);
    end.setMonth(11, 31);
  }
  if (scale === 'quarter') {
    start.setMonth(Math.floor(start.getMonth() / 3) * 3, 1);
    end.setMonth(Math.floor(end.getMonth() / 3) * 3 + 3, 0);
  }

  const shiftedStart = addMonths(start, offsetMonths);
  const shiftedEnd = endOfMonth(addMonths(end, offsetMonths));

  const ticks = [];
  const cursor = new Date(shiftedStart);
  while (cursor <= shiftedEnd) {
    ticks.push({
      key: cursor.toISOString(),
      label: scale === 'quarter'
        ? `${Math.floor(cursor.getMonth() / 3) + 1} кв. ${cursor.getFullYear()}`
        : cursor.toLocaleString('ru-RU', { month: 'short', year: '2-digit' })
    });
    cursor.setMonth(cursor.getMonth() + getStepMonths(scale));
  }

  return { start: shiftedStart, end: shiftedEnd, ticks };
}

function getStepMonths(scale) {
  if (scale === 'year') return 12;
  if (scale === 'quarter') return 3;
  return 1;
}

function percentage(date, start, end) {
  return ((date.getTime() - start.getTime()) / Math.max(1, end.getTime() - start.getTime())) * 100;
}

function timeProgress(start, end) {
  const now = snapDate(new Date());
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.round(((now.getTime() - start.getTime()) / Math.max(1, end.getTime() - start.getTime())) * 100);
}

function taskProgress(task) {
  if (task.status === 'closed') return 100;
  return timeProgress(task.start, task.end);
}

function safeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function snapDate(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusLabel(status) {
  return { open: 'Открыта', progress: 'В работе', closed: 'Выполнена', active: 'Активный', completed: 'Завершен' }[status] || status || 'Без статуса';
}

function riskWeight(risk) {
  return { high: 3, medium: 2, low: 1 }[risk] || 0;
}

function riskDot(risk) {
  return { high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-emerald-500' }[risk] || 'bg-slate-400';
}

function riskBar(risk) {
  return { high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-brand-500' }[risk] || 'bg-brand-500';
}

function statusBar(status, overdue) {
  if (overdue) return 'bg-red-500';
  if (status === 'closed') return 'bg-emerald-500';
  if (status === 'progress') return 'bg-brand-500';
  return 'bg-amber-500';
}

function GanttStat({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
      <span className="block text-xs text-slate-500">{label}</span>
      <strong className="mt-1 block text-sm">{value}</strong>
    </div>
  );
}

function LegendItem({ color, label }) {
  return (
    <span className="inline-flex items-center gap-2">
      <i className={`h-3 w-3 rounded-full ${color}`} />
      {label}
    </span>
  );
}
