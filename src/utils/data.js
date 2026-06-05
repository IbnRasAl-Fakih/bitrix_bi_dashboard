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
    meta: { source: 'bitrix', warnings: [], realRecords: 0, availability: {} },
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
    charts: {
      financeByProject: [],
      taskTrend: [],
      hoursByEmployee: [],
      occupancyShare: [],
      stackedHours: [],
      hoursTrend: [],
      expenseStructure: []
    }
  };
}

export function applyFilters(data, filters) {
  const query = filters.query.toLowerCase();
  const tasks = data.tasks.filter((task) => {
    return (!filters.project || task.projectId === filters.project)
      && (!filters.employee || task.responsibleId === filters.employee)
      && (!filters.taskStatus || task.status === filters.taskStatus)
      && (!query || JSON.stringify(task).toLowerCase().includes(query));
  });

  const projectIds = new Set(tasks.map((task) => task.projectId));
  const employeeIds = new Set(tasks.map((task) => task.responsibleId));
  const projects = data.projects.filter((project) => projectIds.has(project.id) && (!filters.projectStatus || project.status === filters.projectStatus));
  const users = data.users.filter((user) => employeeIds.has(user.id) && (!filters.department || user.department === filters.department));
  const assignments = data.assignments.filter((row) => {
    return (!filters.project || row.projectId === filters.project)
      && (!filters.employee || row.employeeId === filters.employee)
      && (!filters.department || row.department === filters.department);
  });

  return recalc({ ...data, tasks, projects, users, assignments });
}

export function recalc(data) {
  return {
    ...data,
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
