import { useEffect, useMemo, useRef, useState } from 'react';
import ChartCard from '../components/ChartCard.jsx';
import DataTable from '../components/DataTable.jsx';
import Metric from '../components/Metric.jsx';
import { EmptyState } from '../components/DataState.jsx';
import { Gantt } from '../components/ProjectWidgets.jsx';
import { BarSimple, Donut } from '../components/charts.jsx';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Clock, GitBranch, Target, Users } from '../icons/index.jsx';

const strategyColumns = [
  ['level', 'Уровень'], ['direction', 'Направление'], ['title', 'Название'], ['team', 'Команда'],
  ['status', 'Статус'], ['planPeriod', 'Плановый период'], ['overdue', 'Просрочка'], ['url', 'Ссылка']
];

export default function StrategyPage({ data, setDetail }) {
  const strategyProjectId = String(data.meta.strategyProjectId || '38');
  const project = data.projects.find((item) => item.id === strategyProjectId);
  const strategyTasks = data.tasks.filter((task) => task.projectId === strategyProjectId);
  const [selectedDirectionId, setSelectedDirectionId] = useState('');
  const [expanded, setExpanded] = useState({});
  const model = useMemo(() => buildStrategyModel(strategyTasks), [strategyTasks]);
  const visibleTasks = selectedDirectionId
    ? strategyTasks.filter((task) => task.id === selectedDirectionId || task.parentId === selectedDirectionId)
    : strategyTasks;
  const drawerRows = strategyTasks.map((task) => strategyRow(task, model));

  function openStrategyDetail(key, label, rows, description, columns = strategyColumns) {
    setDetail({ scope: 'strategy', key, label, title: label, description, rows, columns });
  }

  if (!project) {
    return <EmptyState title="Проект стратегии не найден" description={`В Bitrix24 не найден проект с ID ${strategyProjectId}. Укажите корректный ID в настройках и запустите синхронизацию.`} />;
  }

  return (
    <>
      <StrategyHero project={project} model={model} />

      <section className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric title="Направлений" value={model.directions.length} onClick={() => openStrategyDetail('directions', 'Направления стратегии', drawerRows.filter((row) => row.level === 'Направление'), 'Ключевые направления развития компании.')} />
        <Metric title="Стратегических задач" value={model.childTasks.length} onClick={() => openStrategyDetail('strategyTasks', 'Стратегические задачи', drawerRows.filter((row) => row.level === 'Стратегическая задача'), 'Инициативы, обеспечивающие реализацию направлений стратегии.')} />
        <Metric title="Выполнено" value={`${model.completionRate}%`} onClick={() => openStrategyDetail('completedStrategy', 'Выполненные элементы стратегии', drawerRows.filter((row) => row.status === 'closed'), 'Завершенные направления и стратегические задачи.')} />
        <Metric title="Просрочено" value={model.overdue.length} onClick={() => openStrategyDetail('overdueStrategy', 'Просроченные элементы стратегии', drawerRows.filter((row) => row.overdue), 'Открытые элементы стратегии с истекшим плановым сроком.')} />
        <Metric title="Участников" value={model.people.size} onClick={() => openStrategyDetail('strategyTeam', 'Команда стратегии', model.teamRows, 'Сотрудники и их роли в реализации стратегии.', [['name', 'Сотрудник'], ['roles', 'Роли'], ['directions', 'Направлений'], ['tasks', 'Стратегических задач']])} />
      </section>

      <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard title="Прогресс направлений" empty={!model.directionProgress.length}><BarSimple data={model.directionProgress} /></ChartCard>
        <ChartCard title="Состояние стратегических задач" empty={!strategyTasks.length}><Donut data={model.statusDistribution} /></ChartCard>
        <ChartCard title="Участие команды в стратегии" empty={!model.teamDistribution.length}><BarSimple data={model.teamDistribution} /></ChartCard>
      </section>

      <section className="panel mb-4 p-4" onClick={() => setSelectedDirectionId('')}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Портфель направлений</h2>
            <p className="mt-1 text-sm text-slate-500">Обзор ключевых направлений, инициатив, сроков и ответственных команд.</p>
          </div>
          {selectedDirectionId && <button className="btn" onClick={() => setSelectedDirectionId('')}>Показать все направления</button>}
        </div>
        <div className="grid gap-3">
          {model.directions.map((direction) => (
            <DirectionCard
              key={direction.id}
              direction={direction}
              selected={selectedDirectionId === direction.id}
              expanded={Boolean(expanded[direction.id])}
              onSelect={(event) => {
                event.stopPropagation();
                setSelectedDirectionId(selectedDirectionId === direction.id ? '' : direction.id);
              }}
              onExpand={() => setExpanded({ ...expanded, [direction.id]: !expanded[direction.id] })}
            />
          ))}
        </div>
      </section>

      <RelationshipMap directions={model.directions} orphans={model.orphans} allTasks={data.tasks} relationMeta={data.meta.taskRelations} />

      <Gantt projects={[project]} tasks={strategyTasks} selectedProject={project} onClearSelected={() => setSelectedDirectionId('')} hierarchyMode />

      <DataTable
        title={selectedDirectionId ? 'Данные выбранного направления' : 'Все данные стратегии'}
        rows={visibleTasks.map((task) => strategyRow(task, model))}
        columns={[
          ['level', 'Уровень'], ['direction', 'Направление'], ['title', 'Название'], ['team', 'Команда'],
          ['status', 'Статус'], ['priority', 'Приоритет'], ['startDatePlan', 'Начало плана'], ['endDatePlan', 'Конец плана'],
          ['deadline', 'Дедлайн'], ['overdue', 'Просрочка'], ['relationCount', 'Связей'], ['activityAt', 'Активность'], ['url', 'Ссылка']
        ]}
      />
    </>
  );
}

function StrategyHero({ project, model }) {
  return (
    <section className="panel relative mb-4 overflow-hidden border-0 bg-gradient-to-br from-slate-950 via-blue-950 to-brand-700 p-6 text-white">
      <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl" />
      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-4xl">
          <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-100"><Target size={15} /> Стратегия компании</span>
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">{project.name}</h1>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <HeroStat label="Общий прогресс" value={`${model.completionRate}%`} />
          <HeroStat label="Открыто" value={model.open.length} />
          <HeroStat label="В риске" value={model.atRisk.length} />
          <HeroStat label="Ближайший срок" value={nearestDeadline(model.open)} />
        </div>
      </div>
    </section>
  );
}

function HeroStat({ label, value }) {
  return <div className="min-w-32 rounded-xl border border-white/10 bg-white/10 p-3 backdrop-blur"><span className="block text-xs text-blue-100">{label}</span><strong className="mt-1 block text-xl">{value}</strong></div>;
}

function DirectionCard({ direction, selected, expanded, onSelect, onExpand }) {
  return (
    <article className={`rounded-xl border p-4 transition ${selected ? 'border-brand-500 bg-blue-50 dark:bg-blue-950/20' : 'border-slate-200 dark:border-slate-800'}`}>
      <div className="flex items-stretch gap-3">
        <button className="flex shrink-0 items-center self-stretch text-slate-500" onClick={(event) => { event.stopPropagation(); onExpand(); }} title={expanded ? 'Свернуть' : 'Развернуть'}>{expanded ? <ChevronDown size={19} /> : <ChevronRight size={19} />}</button>
        <button className="min-w-0 flex-1 text-left" onClick={onSelect}>
          <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-bold">{direction.title}</h3><span className={statusPill(direction.status)}>{statusText(direction.status)}</span></div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><span className="block h-full rounded-full bg-brand-500" style={{ width: `${direction.progress}%` }} /></div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1"><CheckCircle2 size={14} /> {direction.closedChildren}/{direction.children.length} выполнено</span>
            <span className="inline-flex items-center gap-1"><AlertTriangle size={14} /> {direction.overdueChildren} просрочено</span>
            <span className="inline-flex items-center gap-1"><Clock size={14} /> {formatPlanPeriod(direction)}</span>
            <span className="inline-flex items-center gap-1"><Users size={14} /> {teamSummary(direction)}</span>
          </div>
        </button>
      </div>
      {expanded && (
        <div className="mt-4 grid gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
          {direction.children.length ? direction.children.map((task) => (
            <a className="rounded-lg bg-slate-50 p-3 text-sm transition hover:bg-blue-50 dark:bg-slate-800/60 dark:hover:bg-slate-800" href={task.url || undefined} target={task.url ? '_blank' : undefined} rel="noreferrer" key={task.id} onClick={(event) => event.stopPropagation()}>
              <div className="flex items-start justify-between gap-3"><strong className="line-clamp-2">{task.title}</strong><span className={statusPill(task.status)}>{statusText(task.status)}</span></div>
              <div className="mt-2 text-xs text-slate-500">{teamSummary(task)} · {formatPlanPeriod(task)}</div>
            </a>
          )) : <p className="text-sm text-amber-600">В направлении пока нет стратегических задач.</p>}
        </div>
      )}
    </article>
  );
}

function RelationshipMap({ directions, orphans, allTasks, relationMeta }) {
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [showConnections, setShowConnections] = useState(true);
  const [layout, setLayout] = useState({ width: 0, height: 0, paths: [] });
  const boardRef = useRef(null);
  const cardRefs = useRef(new Map());
  const strategyTasks = directions.flatMap((direction) => [direction, ...direction.children]);
  const strategyTaskIds = new Set(strategyTasks.map((task) => task.id));
  const allTaskById = new Map(allTasks.map((task) => [task.id, task]));
  const relatedEdges = buildRelatedEdges(strategyTasks, allTaskById);
  const boardEdges = relatedEdges.filter((edge) => strategyTaskIds.has(edge.from.id) && strategyTaskIds.has(edge.to.id));
  const linkedTaskIds = new Set(relatedEdges.flatMap((edge) => [edge.from.id, edge.to.id]));
  const selectedLinkedIds = new Set(relatedEdges.filter((edge) => edge.from.id === selectedTaskId || edge.to.id === selectedTaskId).flatMap((edge) => [edge.from.id, edge.to.id]));

  useEffect(() => {
    const update = () => setLayout(buildArrowLayout(boardRef.current, boardEdges, cardRefs.current));
    update();
    const observer = new ResizeObserver(update);
    if (boardRef.current) observer.observe(boardRef.current);
    cardRefs.current.forEach((node) => observer.observe(node));
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [directions, boardEdges.length, showConnections]);

  function setCardRef(taskId, node) {
    if (node) cardRefs.current.set(taskId, node);
    else cardRefs.current.delete(taskId);
  }

  return (
    <section className="panel mb-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Стратегическая доска связей</h2>
          <p className="mt-1 text-sm text-slate-500">Карта показывает, как инициативы внутри направлений усиливают друг друга и где есть рабочие зависимости.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedTaskId && <button className="btn h-9 min-h-9 text-xs" onClick={() => setSelectedTaskId('')}>Показать все связи</button>}
          <button className="btn h-9 min-h-9 text-xs" onClick={() => setShowConnections((value) => !value)}>
            {showConnections ? 'Скрыть связи' : 'Показать связи'}
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-200"><GitBranch size={13} /> Направлений: {directions.length}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Стратегических задач: {directions.reduce((total, direction) => total + direction.children.length, 0)}</span>
        <span className="rounded-full bg-violet-50 px-3 py-1 font-semibold text-violet-700 dark:bg-violet-950/30 dark:text-violet-200">Связей между задачами: {relatedEdges.length}</span>
      </div>

      {!relationMeta?.available && (
        <div className="mt-4 rounded-lg border border-dashed border-violet-300 bg-violet-50 p-3 text-sm text-violet-900 dark:border-violet-900 dark:bg-violet-950/20 dark:text-violet-200">
          Связи Bitrix24 пока недоступны. Проверьте <strong>BITRIX_WEBHOOK_URL</strong> и повторите синхронизацию.
          {relationMeta?.error && <span className="mt-1 block text-xs opacity-80">Ошибка Bitrix REST: {relationMeta.error}</span>}
        </div>
      )}

      <div className="mt-4 overflow-auto rounded-xl bg-slate-100/70 p-5 dark:bg-slate-950/50" onClick={() => setSelectedTaskId('')}>
        <div className="relative min-w-max" ref={boardRef}>
          {showConnections && <ConnectionArrows layout={layout} edges={boardEdges} selectedTaskId={selectedTaskId} />}
          <div className="relative z-10 flex items-start gap-10">
            {directions.map((direction) => (
              <StrategyColumn
                key={direction.id}
                direction={direction}
                linkedTaskIds={linkedTaskIds}
                selectedLinkedIds={selectedLinkedIds}
                selectedTaskId={selectedTaskId}
                setSelectedTaskId={setSelectedTaskId}
                setCardRef={setCardRef}
              />
            ))}
          </div>
        </div>
      </div>
      {relationMeta?.available && !relatedEdges.length && <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500 dark:border-slate-700">Связанные стратегические задачи не найдены.</p>}
      {orphans.length > 0 && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">Найдено стратегических задач без доступного направления: {orphans.length}.</p>}
    </section>
  );
}

function StrategyColumn({ direction, linkedTaskIds, selectedLinkedIds, selectedTaskId, setSelectedTaskId, setCardRef }) {
  return (
    <article className="w-[310px] shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="border-b border-slate-200 bg-gradient-to-br from-blue-50 to-white p-4 dark:border-slate-800 dark:from-blue-950/50 dark:to-slate-900" ref={(node) => setCardRef(direction.id, node)}>
        <span className="text-[10px] font-bold uppercase tracking-widest text-brand-600">Направление стратегии</span>
        <h3 className="mt-2 text-sm font-black leading-snug">{direction.title}</h3>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><span className="block h-full rounded-full bg-brand-500" style={{ width: `${direction.progress}%` }} /></div>
        <div className="mt-2 flex justify-between text-[11px] text-slate-500"><span>{direction.children.length} задач</span><span>{direction.progress}% выполнено</span></div>
      </header>
      <div className="grid min-h-36 gap-3 p-3">
        {direction.children.length ? direction.children.map((task) => {
          const selected = selectedTaskId === task.id;
          const muted = selectedTaskId && !selectedLinkedIds.has(task.id);
          return (
            <button
              className={`relative rounded-xl border bg-white p-3 text-left shadow-sm transition dark:bg-slate-800 ${isStrategyOverdue(task) ? 'border-red-300 dark:border-red-900' : linkedTaskIds.has(task.id) ? 'border-violet-300 dark:border-violet-800' : 'border-slate-200 dark:border-slate-700'} ${selected ? 'ring-2 ring-violet-500' : ''} ${muted ? 'opacity-35' : ''}`}
              key={task.id}
              ref={(node) => setCardRef(task.id, node)}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedTaskId(selected ? '' : task.id);
              }}
              type="button"
            >
              {linkedTaskIds.has(task.id) && <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-violet-500 text-white"><GitBranch size={11} /></span>}
              <div className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Стратегическая задача</span><span className={statusPill(task.status)}>{statusText(task.status)}</span></div>
              <strong className="block text-xs leading-relaxed">{task.title}</strong>
              <div className="mt-3 grid gap-1 text-[11px] text-slate-500"><span className="truncate">{teamSummary(task)}</span><span>{formatPlanPeriod(task)}</span></div>
            </button>
          );
        }) : <div className="rounded-lg border border-dashed border-amber-300 p-4 text-center text-xs text-amber-700 dark:border-amber-900 dark:text-amber-300">Стратегические задачи пока не добавлены</div>}
      </div>
    </article>
  );
}

function ConnectionArrows({ layout, edges, selectedTaskId }) {
  if (!layout.paths.length) return null;
  return (
    <>
      <svg className="pointer-events-none absolute inset-0 z-0 overflow-visible" width={layout.width} height={layout.height} aria-hidden="true">
        {layout.paths.map((path, index) => {
          const edge = edges[index];
          const active = !selectedTaskId || edge.from.id === selectedTaskId || edge.to.id === selectedTaskId;
          return <ConnectionPath path={path} active={active} key={edge.key} />;
        })}
      </svg>
      <svg className="pointer-events-none absolute inset-0 z-20 overflow-visible" width={layout.width} height={layout.height} aria-hidden="true">
        <defs>
          <marker id="strategy-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#8b5cf6" /></marker>
        </defs>
        {layout.paths.map((path, index) => {
          const edge = edges[index];
          const selectedConnection = edge.from.id === selectedTaskId || edge.to.id === selectedTaskId;
          return (
            <ConnectionPath
              path={path}
              active={!selectedTaskId || selectedConnection}
              markerEnd="url(#strategy-arrow)"
              markerOnly={!selectedConnection}
              key={edge.key}
            />
          );
        })}
      </svg>
    </>
  );
}

function ConnectionPath({ path, active, markerEnd, markerOnly = false }) {
  return (
    <path
      d={path}
      fill="none"
      markerEnd={markerEnd}
      stroke={markerOnly ? 'transparent' : '#8b5cf6'}
      strokeDasharray="7 5"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={active ? 2.5 : 1.5}
      opacity={active ? 0.9 : 0.12}
    />
  );
}

function buildArrowLayout(board, edges, refs) {
  if (!board) return { width: 0, height: 0, paths: [] };
  const boardRect = board.getBoundingClientRect();
  const paths = edges.map((edge, index) => {
    const from = refs.get(edge.from.id)?.getBoundingClientRect();
    const to = refs.get(edge.to.id)?.getBoundingClientRect();
    if (!from || !to) return '';
    const sameColumn = Math.abs(from.left - to.left) < 20;
    const leftToRight = from.left + from.width / 2 <= to.left + to.width / 2;
    const x1 = (leftToRight ? from.right : from.left) - boardRect.left;
    const y1 = from.top + from.height / 2 - boardRect.top;
    const x2 = (leftToRight ? to.left : to.right) - boardRect.left;
    const y2 = to.top + to.height / 2 - boardRect.top;
    if (!sameColumn && Math.abs(y2 - y1) < 2) return `M ${x1} ${y1} H ${x2}`;
    if (sameColumn) {
      const startX = from.right - boardRect.left;
      const endX = to.right - boardRect.left;
      const side = Math.max(startX, endX) + 28 + (index % 3) * 12;
      const verticalDirection = y2 >= y1 ? 1 : -1;
      const radius = Math.min(18, Math.abs(y2 - y1) / 2);
      return `M ${startX} ${y1} H ${side - radius} Q ${side} ${y1} ${side} ${y1 + verticalDirection * radius} V ${y2 - verticalDirection * radius} Q ${side} ${y2} ${side - radius} ${y2} H ${endX}`;
    }
    const horizontalDirection = leftToRight ? 1 : -1;
    const targetApproachLength = 32;
    const targetGutterX = x2 - horizontalDirection * targetApproachLength;
    const verticalDirection = y2 >= y1 ? 1 : -1;
    const radius = Math.min(14, targetApproachLength / 2, Math.abs(targetGutterX - x1) / 4, Math.abs(y2 - y1) / 2 || 14);
    return `M ${x1} ${y1} H ${targetGutterX - horizontalDirection * radius} Q ${targetGutterX} ${y1} ${targetGutterX} ${y1 + verticalDirection * radius} V ${y2 - verticalDirection * radius} Q ${targetGutterX} ${y2} ${targetGutterX + horizontalDirection * radius} ${y2} H ${x2}`;
  }).filter(Boolean);
  return { width: board.scrollWidth, height: board.scrollHeight, paths };
}

function buildRelatedEdges(tasks, taskById) {
  const edges = new Map();
  tasks.forEach((task) => {
    (task.relatedTaskIds || []).forEach((relatedId) => {
      const related = taskById.get(String(relatedId)) || { id: String(relatedId), title: `Задача ${relatedId}` };
      const pair = [task.id, related.id].sort((a, b) => String(a).localeCompare(String(b), 'ru', { numeric: true }));
      const key = pair.join(':');
      if (!edges.has(key)) edges.set(key, { key, from: task, to: related });
    });
  });
  return [...edges.values()];
}

function buildStrategyModel(tasks) {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const childrenByParent = new Map();
  tasks.forEach((task) => {
    if (!task.parentId || task.parentId === '0') return;
    childrenByParent.set(task.parentId, [...(childrenByParent.get(task.parentId) || []), task]);
  });
  const directions = tasks.filter((task) => !task.parentId || task.parentId === '0').map((task) => {
    const children = childrenByParent.get(task.id) || [];
    const closedChildren = children.filter((child) => child.status === 'closed').length;
    return { ...task, children, closedChildren, overdueChildren: children.filter(isStrategyOverdue).length, progress: Math.round((closedChildren / Math.max(children.length, 1)) * 100) };
  });
  const directionByTask = new Map();
  directions.forEach((direction) => {
    directionByTask.set(direction.id, direction);
    direction.children.forEach((task) => directionByTask.set(task.id, direction));
  });
  const closed = tasks.filter((task) => task.status === 'closed');
  const open = tasks.filter((task) => task.status !== 'closed');
  const overdue = open.filter(isStrategyOverdue);
  const teamRows = buildTeamRows(tasks);
  return {
    directions,
    childTasks: tasks.filter((task) => task.parentId && task.parentId !== '0'),
    emptyDirections: directions.filter((direction) => !direction.children.length),
    orphans: tasks.filter((task) => task.parentId && task.parentId !== '0' && !taskById.has(task.parentId)),
    open, overdue, atRisk: open.filter((task) => isStrategyOverdue(task) || daysUntil(strategyEnd(task)) <= 7),
    people: new Set(teamRows.map((row) => row.name)),
    teamRows,
    completionRate: Math.round((closed.length / Math.max(tasks.length, 1)) * 100),
    childrenByParent, directionByTask,
    directionProgress: directions.map((direction) => ({ name: direction.title, value: direction.progress })),
    teamDistribution: teamRows.map((row) => ({ name: row.name, value: row.tasks + row.directions })),
    statusDistribution: [
      { name: 'Выполнено', value: closed.length },
      { name: 'В работе', value: tasks.filter((task) => task.status === 'progress').length },
      { name: 'Открыто', value: tasks.filter((task) => task.status === 'open').length },
      { name: 'Просрочено', value: overdue.length }
    ].filter((row) => row.value)
  };
}

function strategyRow(task, model) {
  return {
    ...task,
    overdue: isStrategyOverdue(task),
    level: task.parentId && task.parentId !== '0' ? 'Стратегическая задача' : 'Направление',
    direction: model.directionByTask.get(task.id)?.title || task.title,
    team: teamSummary(task),
    planPeriod: formatPlanPeriod(task),
    relationCount: (task.relatedTaskIds?.length || 0) + (model.childrenByParent.get(task.id)?.length || 0)
  };
}

function buildTeamRows(tasks) {
  const rows = new Map();
  tasks.forEach((task) => {
    teamMembers(task).forEach((member) => {
      const current = rows.get(member.name) || { name: member.name, roleSet: new Set(), directions: 0, tasks: 0 };
      current.roleSet.add(member.role);
      if (task.parentId && task.parentId !== '0') current.tasks += 1;
      else current.directions += 1;
      rows.set(member.name, current);
    });
  });
  return [...rows.values()].map(({ roleSet, ...row }) => ({
    ...row,
    roles: [...roleSet].join(', ')
  })).sort((a, b) => (b.tasks + b.directions) - (a.tasks + a.directions));
}

function teamMembers(task) {
  const members = [];
  if (task.responsible) members.push({ name: task.responsible, role: 'Ответственный' });
  (task.accomplices || []).forEach((name) => members.push({ name, role: 'Соисполнитель' }));
  (task.auditors || []).forEach((name) => members.push({ name, role: 'Наблюдатель' }));
  const seen = new Set();
  return members.filter((member) => {
    const key = `${member.name}:${member.role}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function teamSummary(task) {
  const members = teamMembers(task);
  if (!members.length) return 'Команда не указана';
  const primary = members.find((member) => member.role === 'Ответственный') || members[0];
  const extra = members.length > 1 ? ` +${members.length - 1}` : '';
  return `${primary.role}: ${primary.name}${extra}`;
}

function nearestDeadline(tasks) {
  const days = tasks.map((task) => daysUntil(strategyEnd(task))).filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b)[0];
  return Number.isFinite(days) ? `${days} дн.` : '-';
}

function strategyStart(task) {
  return task.startDatePlan || task.createdAt || null;
}

function strategyEnd(task) {
  return task.endDatePlan || task.deadline || null;
}

function isStrategyOverdue(task) {
  const end = strategyEnd(task);
  return Boolean(end && task.status !== 'closed' && new Date(end).getTime() < Date.now());
}

function formatPlanPeriod(task) {
  const start = strategyStart(task);
  const end = strategyEnd(task);
  if (start && end) return `${formatDate(start)} - ${formatDate(end)}`;
  return formatDate(end || start);
}

function daysUntil(value) {
  if (!value) return Infinity;
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('ru-RU') : 'без срока';
}

function statusText(status) {
  return { open: 'Открыто', progress: 'В работе', closed: 'Выполнено' }[status] || status;
}

function statusPill(status) {
  const tone = {
    open: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
    progress: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200',
    closed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
  }[status] || 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
  return `shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${tone}`;
}
