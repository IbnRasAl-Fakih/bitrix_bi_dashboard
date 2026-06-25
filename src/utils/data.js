export const colors = ['#1d70f7', '#14a38b', '#f59e0b', '#ef4444', '#7c3aed', '#0ea5e9', '#64748b', '#22c55e'];

export const kpiLabels = {
  activeProjects: 'Активные проекты',
  completedProjects: 'Завершенные проекты',
  employees: 'Сотрудники в проектах',
  tasks: 'Всего задач',
  openTasks: 'Открытые задачи',
  closedTasks: 'Закрытые задачи',
  plannedHours: 'Плановые часы',
  actualHours: 'Фактические часы',
  closedHours: 'Закрытые часы',
  avgLoad: 'Средняя загрузка',
  income: 'Доход по проектам',
  expense: 'Расход по проектам',
  profit: 'Прибыль',
  overdueTasks: 'Просроченные задачи',
  completionRate: 'Выполнение задач',
  teamLoad: 'Загрузка команды'
};

export function emptyData() {
  return {
    meta: {
      source: 'bitrix',
      warnings: [],
      realRecords: 0,
      availability: {},
      taskRelations: { available: false, source: 'unavailable', count: 0, error: null }
    },
    kpis: {
      activeProjects: 0,
      completedProjects: 0,
      employees: 0,
      tasks: 0,
      openTasks: 0,
      closedTasks: 0,
      plannedHours: 0,
      actualHours: 0,
      closedHours: 0,
      avgLoad: 0,
      income: 0,
      expense: 0,
      profit: 0,
      overdueTasks: 0,
      completionRate: 0,
      teamLoad: 0
    },
    users: [],
    projects: [],
    tasks: [],
    assignments: [],
    itsmRequests: [],
    charts: {
      financeByProject: [],
      taskTrend: [],
      hoursByEmployee: [],
      hoursByDepartment: [],
      occupancyShare: [],
      stackedHours: [],
      hoursTrend: [],
      expenseStructure: []
    }
  };
}

export function applyFilters(data, filters) {
  const query = filters.query.toLowerCase();
  const range = resolveDateRange(filters);
  const departmentEmployeeIds = new Set(
    data.users
      .filter((user) => !filters.department || user.department === filters.department)
      .map((user) => user.id)
  );
  const tasks = data.tasks.filter((task) => {
    return (!filters.project || task.projectId === filters.project)
      && (!filters.employee || task.responsibleId === filters.employee)
      && (!filters.department || departmentEmployeeIds.has(task.responsibleId))
      && (!filters.taskStatus || task.status === filters.taskStatus)
      && matchesTaskRange(task, range)
      && (!query || JSON.stringify(task).toLowerCase().includes(query));
  });

  const projectIds = new Set(tasks.map((task) => task.projectId));
  const employeeIds = new Set(tasks.map((task) => task.responsibleId));
  const financeRecords = (data.financeRecords || []).filter((record) => {
    return matchesPointDate(record.date, range)
      && (!query || JSON.stringify(record).toLowerCase().includes(query));
  });
  const financeProjectNames = new Set(financeRecords.map((record) => record.projectName));
  const projects = data.projects.filter((project) => {
    const matchesQuery = !query
      || JSON.stringify(project).toLowerCase().includes(query)
      || projectIds.has(project.id)
      || financeProjectNames.has(project.name);
    return (!filters.project || project.id === filters.project)
      && (!filters.projectStatus || project.status === filters.projectStatus)
      && matchesProjectRange(project, range)
      && matchesQuery;
  });
  const users = data.users.filter((user) => {
    return (!filters.employee || user.id === filters.employee)
      && (!filters.department || user.department === filters.department)
      && (!filters.project || employeeIds.has(user.id))
      && (!query || JSON.stringify(user).toLowerCase().includes(query) || employeeIds.has(user.id));
  });
  const assignments = data.assignments.filter((row) => {
    return (!filters.project || row.projectId === filters.project)
      && (!filters.employee || row.employeeId === filters.employee)
      && (!filters.department || row.department === filters.department);
  });
  const itsmRequests = (data.itsmRequests || []).filter((request) => {
    return matchesItsmRange(request, range)
      && (!filters.itsmType || String(request.requestType) === String(filters.itsmType))
      && (!filters.itsmInitiator || String(request.initiator) === String(filters.itsmInitiator))
      && (!filters.itsmAssignee || String(request.assignee) === String(filters.itsmAssignee));
  });

  return recalc({ ...data, tasks, projects, users, assignments, financeRecords, itsmRequests });
}

function resolveDateRange(filters) {
  if (filters.period === 'custom') {
    return {
      start: parseDateStart(filters.startDate),
      end: parseDateEnd(filters.endDate)
    };
  }

  const daysByPeriod = { '30d': 30, '90d': 90, '180d': 180, year: 365 };
  const days = daysByPeriod[filters.period];
  if (!days) return { start: null, end: null };

  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function parseDateStart(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateEnd(value) {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function matchesTaskRange(task, range) {
  if (!range.start && !range.end) return true;
  return [
    task.createdAt,
    task.closedAt,
    task.activityAt,
    task.startDatePlan,
    task.endDatePlan,
    task.deadline
  ].some((value) => matchesPointDate(value, range));
}

function matchesItsmRange(request, range) {
  if (!range.start && !range.end) return true;
  return [
    request.registeredAt,
    request.completedAt,
    request.closedAt,
    request.createdTime,
    request.updatedTime,
    request.movedTime
  ].some((value) => matchesPointDate(value, range));
}

function matchesProjectRange(project, range) {
  if (!range.start && !range.end) return true;
  if (!project.startDate && !project.endDate) return true;
  return dateIntervalsOverlap(project.startDate, project.endDate, range);
}

function matchesPointDate(value, range) {
  if (!range.start && !range.end) return true;
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return (!range.start || date >= range.start) && (!range.end || date <= range.end);
}

function dateIntervalsOverlap(startValue, endValue, range) {
  if (!range.start && !range.end) return true;
  const start = startValue ? new Date(startValue) : null;
  const end = endValue ? new Date(endValue) : start;
  if (!start || Number.isNaN(start.getTime())) return false;
  const normalizedEnd = end && !Number.isNaN(end.getTime()) ? end : start;
  return (!range.start || normalizedEnd >= range.start) && (!range.end || start <= range.end);
}

export function recalc(data) {
  return {
    ...data,
    charts: buildCharts(data),
    kpis: {
      ...data.kpis,
      activeProjects: data.projects.filter((project) => project.status === 'active').length,
      completedProjects: data.projects.filter((project) => project.status === 'completed').length,
      employees: data.users.length,
      tasks: data.tasks.length,
      openTasks: data.tasks.filter((task) => task.status !== 'closed').length,
      closedTasks: data.tasks.filter((task) => task.status === 'closed').length,
      plannedHours: sum(data.tasks, 'plannedHours'),
      actualHours: sum(data.tasks, 'actualHours'),
      closedHours: sum(data.tasks, 'closedHours'),
      income: sum(data.projects, 'income'),
      expense: sum(data.projects, 'expense'),
      profit: sum(data.projects, 'profit'),
      overdueTasks: data.tasks.filter((task) => task.overdue).length,
      completionRate: Math.round((data.tasks.filter((task) => task.status === 'closed').length / Math.max(data.tasks.length, 1)) * 100),
      avgLoad: Math.round(avg(data.users.map((user) => user.load))),
      teamLoad: Math.round(avg(data.users.map((user) => user.load)))
    }
  };
}

function buildCharts(data) {
  const financeRecords = data.financeRecords || [];
  const hasTime = data.tasks.some((task) => task.actualHours > 0 || task.closedHours > 0);
  return {
    ...data.charts,
    hoursByEmployee: hasTime
      ? data.users
        .filter((user) => user.actualHours || user.closedHours)
        .map((user) => ({ name: user.name, hours: user.actualHours, closed: user.closedHours, load: user.load }))
      : data.users
        .filter((user) => user.tasks)
        .map((user) => ({ name: user.name, hours: user.tasks, closed: user.closedTasks, load: user.load, metricKind: 'tasks', metricName: 'Задач' })),
    hoursByDepartment: buildHoursByDepartment(data.users, !hasTime),
    hoursByProject: data.projects
      .filter((project) => project.actualHours || project.plannedHours || project.closedHours || (!hasTime && project.taskCount))
      .map((project) => ({ name: project.name, planned: project.plannedHours, actual: project.actualHours, closed: project.closedHours, taskCount: project.taskCount, metricKind: hasTime ? 'hours' : 'tasks' })),
    occupancyShare: hasTime
      ? data.projects
        .filter((project) => project.actualHours > 0)
        .map((project) => ({ name: project.name, value: project.actualHours }))
      : data.projects
        .filter((project) => project.taskCount > 0)
        .map((project) => ({ name: project.name, value: project.taskCount, metricKind: 'tasks', metricName: 'Задач' })),
    financeByProject: data.projects
      .filter((project) => project.income !== null || project.expense !== null || project.profit !== null)
      .map((project) => ({ name: project.name, income: project.income || 0, expense: project.expense || 0, profit: project.profit || 0 })),
    financeTrend: buildFinanceTrend(financeRecords),
    taskTrend: buildTaskTrend(data.tasks),
    hoursTrend: hasTime ? buildHoursTrend(data.tasks) : buildTaskVolumeTrend(data.tasks),
    stackedHours: data.projects.map((project) => {
      const row = { name: project.name };
      data.assignments
        .filter((assignment) => assignment.project === project.name && (hasTime ? assignment.actualHours > 0 : assignment.taskCount > 0))
        .forEach((assignment) => { row[assignment.employee] = hasTime ? assignment.actualHours : assignment.taskCount; });
      if (!hasTime) row.metricKind = 'tasks';
      return row;
    }).filter((row) => Object.keys(row).length > 1),
    expenseStructure: buildExpenseStructure(financeRecords)
  };
}

function buildHoursByDepartment(users, useTaskCount = false) {
  const grouped = new Map();
  users.forEach((user) => {
    const name = user.department || 'Не указан';
    const current = grouped.get(name) || { name, hours: 0, closed: 0, loadTotal: 0, employees: 0, taskCount: 0, closedTasks: 0 };
    current.hours += useTaskCount ? user.tasks || 0 : user.actualHours || 0;
    current.closed += useTaskCount ? user.closedTasks || 0 : user.closedHours || 0;
    current.loadTotal += user.load || 0;
    current.employees += 1;
    current.taskCount += user.tasks || 0;
    current.closedTasks += user.closedTasks || 0;
    grouped.set(name, current);
  });
  return [...grouped.values()]
    .map((row) => ({
      name: row.name,
      hours: Math.round(row.hours * 10) / 10,
      closed: Math.round(row.closed * 10) / 10,
      load: Math.round(row.loadTotal / Math.max(row.employees, 1)),
      employees: row.employees,
      taskCount: row.taskCount,
      closedTasks: row.closedTasks,
      metricKind: useTaskCount ? 'tasks' : 'hours',
      metricName: useTaskCount ? 'Задач' : undefined
    }))
    .filter((row) => row.hours || row.closed || row.employees)
    .sort((a, b) => b.hours - a.hours);
}

function buildFinanceTrend(records) {
  const grouped = new Map();
  records.forEach((record) => {
    if (!record.date) return;
    const month = monthLabel(record.date);
    const current = grouped.get(month) || { month, income: 0, expense: 0, profit: 0 };
    if (record.kind === 'income') current.income += record.amount;
    if (record.kind === 'expense') current.expense += record.amount;
    current.profit = current.income - current.expense;
    grouped.set(month, current);
  });
  return [...grouped.values()].map((row) => ({
    month: row.month,
    income: sum([row], 'income'),
    expense: sum([row], 'expense'),
    profit: sum([row], 'profit')
  })).slice(-18);
}

function buildExpenseStructure(records) {
  const grouped = new Map();
  records.filter((record) => record.kind === 'expense').forEach((record) => {
    const key = record.article || record.hierarchy || 'Без статьи';
    grouped.set(key, (grouped.get(key) || 0) + record.amount);
  });
  return [...grouped.entries()]
    .map(([name, value]) => ({ name, value: Math.round(value * 10) / 10 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);
}

function buildTaskTrend(tasks) {
  const grouped = new Map();
  tasks.forEach((task) => {
    const date = task.closedAt || task.createdAt;
    if (!date) return;
    const month = monthLabel(date);
    const current = grouped.get(month) || { month, closed: 0, created: 0 };
    if (task.createdAt) current.created += 1;
    if (task.closedAt) current.closed += 1;
    grouped.set(month, current);
  });
  return [...grouped.values()].slice(-12);
}

function buildHoursTrend(tasks) {
  const grouped = new Map();
  tasks.forEach((task) => {
    const date = task.closedAt || task.createdAt;
    if (!date) return;
    const month = monthLabel(date);
    const current = grouped.get(month) || { month, hours: 0, closed: 0 };
    current.hours += task.actualHours || 0;
    current.closed += task.closedHours || 0;
    grouped.set(month, current);
  });
  return [...grouped.values()]
    .map((row) => ({ ...row, hours: Math.round(row.hours * 10) / 10, closed: Math.round(row.closed * 10) / 10 }))
    .filter((row) => row.hours || row.closed)
    .slice(-12);
}

function buildTaskVolumeTrend(tasks) {
  return buildTaskTrend(tasks)
    .map((row) => ({
      ...row,
      hours: row.created || 0,
      closed: row.closed || 0,
      metricKind: 'tasks',
      metricName: 'Задач'
    }))
    .filter((row) => row.hours || row.closed);
}

function monthLabel(value) {
  return new Date(value).toLocaleString('ru-RU', { month: 'short', year: '2-digit' });
}

export function groupCount(rows, key) {
  const grouped = rows.reduce((acc, row) => {
    acc[row[key]] = (acc[row[key]] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(grouped).map(([name, value]) => ({ name, value }));
}

export function sum(rows, key) {
  return Math.round(rows.reduce((acc, row) => acc + Number(row[key] || 0), 0) * 10) / 10;
}

export function avg(values) {
  return values.reduce((acc, value) => acc + Number(value || 0), 0) / Math.max(values.length, 1);
}

export function hintForKpi(key) {
  if (key.includes('Rate') || key.includes('Load')) return 'клик для drill-down';
  if (['income', 'expense', 'profit'].includes(key)) return 'финансовая сводка';
  return 'детализация показателя';
}
