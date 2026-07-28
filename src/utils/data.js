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
  const query = (filters.query || '').toLowerCase();
  const range = resolveDateRange(filters);
  const projectFilter = selectedSet(filters.project);
  const employeeFilter = selectedSet(filters.employee);
  const departmentFilter = selectedSet(filters.department);
  const projectStatusFilter = selectedSet(filters.projectStatus);
  const taskStatusFilter = selectedSet(filters.taskStatus);
  const itsmTypeFilter = selectedSet(filters.itsmType, true);
  const itsmInitiatorFilter = selectedSet(filters.itsmInitiator, true);
  const itsmAssigneeFilter = selectedSet(filters.itsmAssignee, true);
  const departmentEmployeeIds = new Set(
    data.users
      .filter((user) => matchesSelection(departmentFilter, user.department))
      .map((user) => user.id)
  );
  const tasks = data.tasks.filter((task) => {
    return matchesSelection(projectFilter, task.projectId)
      && matchesSelection(employeeFilter, task.responsibleId)
      && (!departmentFilter.size || departmentEmployeeIds.has(task.responsibleId))
      && matchesSelection(taskStatusFilter, task.status)
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
    return matchesSelection(projectFilter, project.id)
      && matchesSelection(projectStatusFilter, project.status)
      && matchesProjectRange(project, range)
      && matchesQuery;
  });
  const users = data.users.filter((user) => {
    return matchesSelection(employeeFilter, user.id)
      && matchesSelection(departmentFilter, user.department)
      && (!projectFilter.size || employeeIds.has(user.id))
      && (!query || JSON.stringify(user).toLowerCase().includes(query) || employeeIds.has(user.id));
  });
  const assignments = data.assignments.filter((row) => {
    return matchesSelection(projectFilter, row.projectId)
      && matchesSelection(employeeFilter, row.employeeId)
      && matchesSelection(departmentFilter, row.department);
  });
  const itsmRequests = (data.itsmRequests || []).filter((request) => {
    return matchesItsmRange(request, range)
      && matchesSelection(itsmTypeFilter, request.requestType, true)
      && matchesSelection(itsmInitiatorFilter, request.initiator, true)
      && matchesSelection(itsmAssigneeFilter, request.assignee, true);
  });

  return recalc({ ...data, tasks, projects, users, assignments, financeRecords, itsmRequests });
}

function selectedSet(value, stringify = false) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return new Set(values.filter(Boolean).map((item) => stringify ? String(item) : item));
}

function matchesSelection(selection, value, stringify = false) {
  if (!selection.size) return true;
  const normalizedValue = stringify ? String(value) : value;
  return selection.has(normalizedValue);
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
  const scoped = withTaskAggregates(data);
  return {
    ...scoped,
    charts: buildCharts(scoped),
    kpis: {
      ...scoped.kpis,
      activeProjects: scoped.projects.filter((project) => project.status === 'active').length,
      completedProjects: scoped.projects.filter((project) => project.status === 'completed').length,
      employees: scoped.users.length,
      tasks: scoped.tasks.length,
      openTasks: scoped.tasks.filter((task) => task.status !== 'closed').length,
      closedTasks: scoped.tasks.filter((task) => task.status === 'closed').length,
      plannedHours: sum(scoped.tasks, 'plannedHours'),
      actualHours: sum(scoped.tasks, 'actualHours'),
      closedHours: sum(scoped.tasks, 'closedHours'),
      income: sum(scoped.projects, 'income'),
      expense: sum(scoped.projects, 'expense'),
      profit: sum(scoped.projects, 'profit'),
      overdueTasks: scoped.tasks.filter((task) => task.overdue).length,
      completionRate: Math.round((scoped.tasks.filter((task) => task.status === 'closed').length / Math.max(scoped.tasks.length, 1)) * 100),
      avgLoad: Math.round(avg(scoped.users.map((user) => user.load))),
      teamLoad: Math.round(avg(scoped.users.map((user) => user.load)))
    }
  };
}

function withTaskAggregates(data) {
  const tasksByUser = new Map();
  const tasksByProject = new Map();

  data.tasks.forEach((task) => {
    if (task.responsibleId) {
      const rows = tasksByUser.get(task.responsibleId) || [];
      rows.push(task);
      tasksByUser.set(task.responsibleId, rows);
    }
    if (task.projectId) {
      const rows = tasksByProject.get(task.projectId) || [];
      rows.push(task);
      tasksByProject.set(task.projectId, rows);
    }
  });

  const users = data.users.map((user) => {
    const userTasks = tasksByUser.get(user.id) || [];
    const projectIds = [...new Set(userTasks.map((task) => task.projectId).filter(Boolean))];
    const actualHours = sum(userTasks, 'actualHours');
    const plannedHours = sum(userTasks, 'plannedHours');
    const closedHours = sum(userTasks, 'closedHours');
    const load = Math.round((actualHours / 160) * 100);
    return {
      ...user,
      projects: projectIds.length,
      tasks: userTasks.length,
      closedTasks: userTasks.filter((task) => task.status === 'closed').length,
      overdueTasks: userTasks.filter((task) => task.overdue).length,
      plannedHours,
      actualHours,
      closedHours,
      load
    };
  });

  const projects = data.projects.map((project) => {
    const projectTasks = tasksByProject.get(project.id) || [];
    const actualHours = sum(projectTasks, 'actualHours');
    const plannedHours = sum(projectTasks, 'plannedHours');
    const closedHours = sum(projectTasks, 'closedHours');
    const closedTasks = projectTasks.filter((task) => task.status === 'closed').length;
    return {
      ...project,
      taskCount: projectTasks.length,
      closedTasks,
      openTasks: projectTasks.length - closedTasks,
      overdueTasks: projectTasks.filter((task) => task.overdue).length,
      plannedHours,
      actualHours,
      closedHours
    };
  });

  return {
    ...data,
    users,
    projects,
    assignments: buildAssignments(users, projects, data.tasks)
  };
}

function buildAssignments(users, projects, tasks) {
  const rows = [];
  users.forEach((user) => {
    projects.forEach((project) => {
      const filtered = tasks.filter((task) => task.responsibleId === user.id && task.projectId === project.id);
      if (!filtered.length) return;
      const actualHours = sum(filtered, 'actualHours');
      const plannedHours = sum(filtered, 'plannedHours');
      rows.push({
        id: `${user.id}-${project.id}`,
        employee: user.name,
        employeeId: user.id,
        department: user.department,
        project: project.name,
        projectId: project.id,
        projectStatus: project.status,
        plannedHours,
        actualHours,
        closedHours: sum(filtered, 'closedHours'),
        deviation: Math.round((actualHours - plannedHours) * 10) / 10,
        load: Math.round((actualHours / 160) * 100),
        taskCount: filtered.length,
        openTasks: filtered.filter((task) => task.status !== 'closed').length,
        closedTasks: filtered.filter((task) => task.status === 'closed').length,
        overdueTasks: filtered.filter((task) => task.overdue).length
      });
    });
  });
  return rows;
}

function buildCharts(data) {
  const financeRecords = data.financeRecords || [];
  // Keep occupancy charts time-based; task counts are shown on the tasks page.
  const hasTime = true;
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
    .filter((row) => row.hours || row.closed || (useTaskCount && row.employees))
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
