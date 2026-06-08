function n(value) {
  const normalized = String(value ?? '').replace(/\s/g, '').replace(',', '.').split('|')[0];
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(...values) {
  return values.filter(Boolean).join(' ').trim();
}

function dateOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function stringIds(value) {
  if (!value) return [];
  const values = Array.isArray(value) ? value : typeof value === 'object' ? Object.values(value) : String(value).split(',');
  return [...new Set(values.map((item) => String(item?.id ?? item?.ID ?? item).trim()).filter((item) => item && item !== '0'))];
}

function taskStatus(task) {
  const status = String(task.STATUS ?? task.status ?? '').toLowerCase();
  if (['5', '6', '7', 'completed', 'closed'].includes(status)) return 'closed';
  if (['3', '4', 'inprogress', 'in_progress'].includes(status)) return 'progress';
  return 'open';
}

function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/too|тоо|ао|ип|llp|ltd|project|проект|202\d/gi, '')
    .replace(/[^a-zа-я0-9]+/gi, '')
    .trim();
}

function emptyAnalytics(warnings = []) {
  return {
    meta: {
      source: 'bitrix',
      warnings,
      generatedAt: new Date().toISOString(),
      realRecords: 0,
      taskRelations: { available: false, source: 'unavailable', count: 0, error: null },
      availability: {
        users: false,
        projects: false,
        tasks: false,
        taskTime: false,
        financeIncome: false,
        financeExpense: false
      }
    },
    kpis: emptyKpis(),
    users: [],
    projects: [],
    tasks: [],
    assignments: [],
    financeRecords: [],
    charts: emptyCharts()
  };
}

export function normalizeBitrixData(raw, settings) {
  const warnings = [...(raw.errors || [])];
  const financeSettings = settings.financeMapping || {};

  const users = (raw.users || []).map((user, index) => ({
    id: String(user.ID ?? user.id ?? index + 1),
    name: text(user.NAME, user.LAST_NAME) || user.name || `Пользователь ${user.ID ?? user.id ?? index + 1}`,
    department: Array.isArray(user.UF_DEPARTMENT) ? `Отдел ${user.UF_DEPARTMENT[0]}` : (user.department || 'Не указан'),
    position: user.WORK_POSITION || user.position || 'Не указана',
    source: 'bitrix'
  }));

  const baseProjects = (raw.workgroups || []).map((group, index) => ({
    id: String(group.ID ?? group.id ?? index + 1),
    name: group.NAME || group.name || `Проект ${group.ID ?? group.id ?? index + 1}`,
    status: String(group.CLOSED ?? group.closed ?? '').toUpperCase() === 'Y' ? 'completed' : 'active',
    responsibleId: String(group.OWNER_ID ?? group.ownerId ?? ''),
    startDate: dateOrNull(group.DATE_CREATE ?? group.dateCreate),
    endDate: dateOrNull(group.DATE_FINISH ?? group.dateFinish),
    source: 'bitrix'
  }));

  const taskRows = (raw.tasks || []).map((task, index) => {
    const status = taskStatus(task);
    const plannedSeconds = n(task.TIME_ESTIMATE ?? task.timeEstimate);
    const actualSeconds = n(task.TIME_SPENT_IN_LOGS ?? task.timeSpentInLogs ?? task.timeSpent);
    const deadline = dateOrNull(task.DEADLINE ?? task.deadline);
    return {
      id: String(task.ID ?? task.id ?? index + 1),
      title: task.TITLE || task.title || `Задача ${task.ID ?? task.id ?? index + 1}`,
      projectId: String(task.GROUP_ID ?? task.groupId ?? ''),
      parentId: String(task.PARENT_ID ?? task.parentId ?? ''),
      responsibleId: String(task.RESPONSIBLE_ID ?? task.responsibleId ?? ''),
      creatorId: String(task.CREATED_BY ?? task.createdBy ?? ''),
      status,
      description: task.DESCRIPTION || task.description || '',
      priority: String(task.PRIORITY ?? task.priority ?? '1'),
      deadline,
      createdAt: dateOrNull(task.CREATED_DATE ?? task.createdDate),
      closedAt: dateOrNull(task.CLOSED_DATE ?? task.closedDate),
      activityAt: dateOrNull(task.ACTIVITY_DATE ?? task.activityDate ?? task.CHANGED_DATE ?? task.changedDate),
      startDatePlan: dateOrNull(task.START_DATE_PLAN ?? task.startDatePlan ?? task.DATE_START ?? task.dateStart),
      endDatePlan: dateOrNull(task.END_DATE_PLAN ?? task.endDatePlan),
      accompliceIds: stringIds(task.ACCOMPLICES ?? task.accomplices),
      auditorIds: stringIds(task.AUDITORS ?? task.auditors),
      tags: Array.isArray(task.TAGS ?? task.tags) ? (task.TAGS ?? task.tags) : [],
      relatedTaskIds: stringIds([
        ...stringIds(task.RELATED_TASKS ?? task.relatedTasks ?? task.DEPENDS_ON ?? task.dependsOn),
        ...(raw.taskRelations?.relations?.[String(task.ID ?? task.id ?? index + 1)] || [])
      ]),
      plannedHours: round(plannedSeconds / 3600),
      actualHours: round(actualSeconds / 3600),
      closedHours: status === 'closed' ? round(actualSeconds / 3600) : 0,
      overdue: Boolean(deadline && status !== 'closed' && new Date(deadline) < new Date()),
      url: task.URL || task.url || '',
      source: 'bitrix'
    };
  });

  const financeRecords = parseFinanceRecords(raw.financeItems || [], financeSettings);
  const financeByProject = aggregateFinanceByProject(financeRecords);
  const projects = mergeFinanceProjects(baseProjects, financeByProject);
  const hasIncome = financeRecords.some((record) => record.kind === 'income');
  const hasExpense = financeRecords.some((record) => record.kind === 'expense');

  if (taskRows.length && !taskRows.some((task) => task.plannedHours > 0 || task.actualHours > 0 || task.closedHours > 0)) {
    warnings.push('В задачах не заполнены поля планового или фактического времени. Часы не рассчитывались искусственно.');
  }

  if (!raw.financeItems?.length) {
    warnings.push('Смарт-процесс “Финансы проекта” не вернул записей.');
  }

  if (raw.financeItems?.length && !hasIncome) {
    warnings.push('В смарт-процессе “Финансы проекта” не найдены строки доходов.');
  }

  if (raw.financeItems?.length && !hasExpense) {
    warnings.push('В смарт-процессе “Финансы проекта” не найдены строки расходов.');
  }

  const data = assembleAnalytics(users, projects, taskRows, financeByProject, financeRecords, warnings);
  data.meta.realRecords = users.length + projects.length + taskRows.length + (raw.deals || []).length + financeRecords.length;
  data.meta.financeSmartProcess = {
    entityTypeId: raw.financeEntityTypeId || financeSettings.smartProcessEntityTypeId || null,
    records: financeRecords.length,
    projectField: financeSettings.smartProjectField,
    amountField: financeSettings.smartAmountField
  };
  data.meta.strategyProjectId = String(settings.strategyProjectId || '');
  data.meta.taskRelations = {
    available: Boolean(raw.taskRelations?.available),
    source: raw.taskRelations?.source || 'unavailable',
    count: Object.values(raw.taskRelations?.relations || {}).reduce((total, ids) => total + ids.length, 0),
    error: raw.taskRelations?.error || null
  };
  data.meta.availability = {
    users: users.length > 0,
    projects: projects.length > 0,
    tasks: taskRows.length > 0,
    taskTime: taskRows.some((task) => task.plannedHours > 0 || task.actualHours > 0 || task.closedHours > 0),
    financeIncome: hasIncome,
    financeExpense: hasExpense
  };
  if (settings.useDemoComplements) {
    return applyDemoComplements(data);
  }

  return data;
}

export function buildEmptyData(warnings = []) {
  return emptyAnalytics(warnings);
}

function parseFinanceRecords(items, settings) {
  const projectField = settings.smartProjectField || 'ufCrm_8_PROJECT_1C';
  const amountField = settings.smartAmountField || 'ufCrm8Amount';
  const dateField = settings.smartDateField || 'ufCrm8DocDate';
  const hierarchyField = settings.smartHierarchyField || 'ufCrm8Hierarchy';
  const articleField = settings.smartArticleField || 'ufCrm_8_ARTICLE_1C';
  const incomeMarkers = settings.smartIncomeMarkers || ['Sales', 'Доход'];
  const expenseMarkers = settings.smartExpenseMarkers || ['CoGS', 'Расход', 'Затрат'];

  return items.map((item) => {
    const amount = n(item[amountField]);
    const hierarchy = String(item[hierarchyField] || '');
    const markerText = `${hierarchy} ${item[articleField] || ''}`;
    const markerLower = markerText.toLowerCase();
    const explicitIncome = incomeMarkers.some((marker) => markerLower.includes(String(marker).toLowerCase()));
    const explicitExpense = expenseMarkers.some((marker) => markerLower.includes(String(marker).toLowerCase()));
    const kind = explicitIncome ? 'income' : explicitExpense ? 'expense' : amount < 0 ? 'expense' : 'income';

    return {
      id: String(item.id),
      projectName: String(item[projectField] || 'Без проекта').trim(),
      amount: Math.abs(amount),
      signedAmount: amount,
      kind,
      date: dateOrNull(item[dateField] || item.begindate || item.createdTime),
      hierarchy,
      article: String(item[articleField] || 'Без статьи'),
      type: item[settings.smartTypeField || 'ufCrm8Type'] || '',
      dealId: item.ufCrm8Lead || item.parentId2 || null,
      source: 'smart-process'
    };
  }).filter((record) => record.projectName && record.amount > 0);
}

function aggregateFinanceByProject(records) {
  const map = new Map();
  records.forEach((record) => {
    const key = normalizeKey(record.projectName) || record.projectName;
    const current = map.get(key) || {
      key,
      projectName: record.projectName,
      income: 0,
      expense: 0,
      records: []
    };

    if (record.kind === 'income') current.income += record.amount;
    if (record.kind === 'expense') current.expense += record.amount;
    current.records.push(record);
    map.set(key, current);
  });
  return map;
}

function mergeFinanceProjects(projects, financeByProject) {
  const result = [...projects];
  const matchedFinanceKeys = new Set();

  result.forEach((project) => {
    const projectKey = normalizeKey(project.name);
    const match = [...financeByProject.keys()].find((financeKey) => {
      return financeKey === projectKey || financeKey.includes(projectKey) || projectKey.includes(financeKey);
    });
    if (match) {
      project.financeKey = match;
      matchedFinanceKeys.add(match);
    }
  });

  financeByProject.forEach((finance, key) => {
    if (matchedFinanceKeys.has(key)) return;
    result.push({
      id: `finance:${key}`,
      name: finance.projectName,
      status: 'active',
      responsibleId: '',
      startDate: null,
      endDate: null,
      source: 'finance-smart-process',
      financeKey: key
    });
  });

  return result;
}

function assembleAnalytics(users, projects, tasks, financeByProject, financeRecords, warnings) {
  const userById = new Map(users.map((user) => [user.id, user]));
  const projectById = new Map(projects.map((project) => [project.id, project]));

  const enrichedProjects = projects.map((project) => {
    const projectTasks = tasks.filter((task) => task.projectId === project.id);
    const finance = project.financeKey ? financeByProject.get(project.financeKey) : financeByProject.get(normalizeKey(project.name));
    const income = finance?.income || null;
    const expense = finance?.expense || null;
    const profit = income !== null && expense !== null ? income - expense : null;
    const margin = income && profit !== null ? Math.round((profit / income) * 100) : null;
    const closed = projectTasks.filter((task) => task.status === 'closed').length;
    const overdue = projectTasks.filter((task) => task.overdue).length;
    const plannedHours = sum(projectTasks, 'plannedHours');
    const actualHours = sum(projectTasks, 'actualHours');
    const progress = projectTimeProgress(project.startDate, project.endDate);
    const riskScore = overdue * 10 + Math.max(0, actualHours - plannedHours) * 0.8 + (projectTasks.length && progress < 45 ? 20 : 0);

    return {
      ...project,
      responsible: userById.get(project.responsibleId)?.name || 'Не назначен',
      team: [...new Set(projectTasks.map((task) => task.responsibleId))].map((id) => userById.get(id)?.name).filter(Boolean),
      taskCount: projectTasks.length,
      closedTasks: closed,
      openTasks: projectTasks.length - closed,
      overdueTasks: overdue,
      plannedHours: round(plannedHours),
      actualHours: round(actualHours),
      closedHours: round(sum(projectTasks, 'closedHours')),
      income: nullableRound(income),
      expense: nullableRound(expense),
      profit: nullableRound(profit),
      margin,
      progress,
      risk: riskScore > 55 ? 'high' : riskScore > 25 ? 'medium' : 'low'
    };
  });

  const workload = users.map((user) => {
    const userTasks = tasks.filter((task) => task.responsibleId === user.id);
    const projectIds = [...new Set(userTasks.map((task) => task.projectId).filter(Boolean))];
    const actualHours = sum(userTasks, 'actualHours');
    const plannedHours = sum(userTasks, 'plannedHours');
    const closedHours = sum(userTasks, 'closedHours');
    const load = Math.round((actualHours / 160) * 100);
    const closedTasks = userTasks.filter((task) => task.status === 'closed').length;
    const efficiency = userTasks.length || plannedHours
      ? Math.round(((closedTasks / Math.max(userTasks.length, 1)) * 55 + (closedHours / Math.max(plannedHours, 1)) * 45))
      : 0;

    return {
      ...user,
      projects: projectIds.length,
      tasks: userTasks.length,
      closedTasks,
      overdueTasks: userTasks.filter((task) => task.overdue).length,
      plannedHours: round(plannedHours),
      actualHours: round(actualHours),
      closedHours: round(closedHours),
      load,
      loadState: load < 55 ? 'low' : load < 90 ? 'normal' : load < 115 ? 'high' : 'overload',
      efficiency: Math.max(0, Math.min(100, efficiency)),
      lastActivity: userTasks.map((task) => task.closedAt || task.createdAt).filter(Boolean).sort().at(-1) || null
    };
  });

  const assignments = buildAssignments(users, projects, tasks);
  const kpis = {
    activeProjects: enrichedProjects.filter((project) => project.status === 'active').length,
    completedProjects: enrichedProjects.filter((project) => project.status === 'completed').length,
    employees: users.length,
    tasks: tasks.length,
    openTasks: tasks.filter((task) => task.status !== 'closed').length,
    closedTasks: tasks.filter((task) => task.status === 'closed').length,
    plannedHours: round(sum(tasks, 'plannedHours')),
    actualHours: round(sum(tasks, 'actualHours')),
    closedHours: round(sum(tasks, 'closedHours')),
    avgLoad: Math.round(avg(workload.map((user) => user.load))),
    income: round(sumNullable(enrichedProjects, 'income')),
    expense: round(sumNullable(enrichedProjects, 'expense')),
    profit: round(sumNullable(enrichedProjects, 'profit')),
    overdueTasks: tasks.filter((task) => task.overdue).length,
    completionRate: Math.round((tasks.filter((task) => task.status === 'closed').length / Math.max(tasks.length, 1)) * 100),
    teamLoad: Math.round(avg(workload.map((user) => user.load)))
  };

  return {
    meta: { source: 'bitrix', warnings, generatedAt: new Date().toISOString(), realRecords: users.length + projects.length + tasks.length + financeRecords.length },
    kpis,
    users: workload,
    projects: enrichedProjects,
    tasks: tasks.map((task) => ({
      ...task,
      project: projectById.get(task.projectId)?.name || 'Без проекта',
      responsible: userById.get(task.responsibleId)?.name || 'Не назначен',
      creator: userById.get(task.creatorId)?.name || 'Не указан',
      accomplices: task.accompliceIds.map((id) => userById.get(id)?.name).filter(Boolean),
      auditors: task.auditorIds.map((id) => userById.get(id)?.name).filter(Boolean),
      deviation: round(task.actualHours - task.plannedHours)
    })),
    assignments,
    financeRecords,
    charts: buildCharts(enrichedProjects, workload, assignments, tasks, financeRecords)
  };
}

function buildAssignments(users, projects, tasks) {
  const rows = [];
  users.forEach((user) => {
    projects.forEach((project) => {
      const filtered = tasks.filter((task) => task.responsibleId === user.id && task.projectId === project.id);
      if (!filtered.length) return;
      rows.push({
        id: `${user.id}-${project.id}`,
        employee: user.name,
        employeeId: user.id,
        department: user.department,
        project: project.name,
        projectId: project.id,
        projectStatus: project.status,
        plannedHours: round(sum(filtered, 'plannedHours')),
        actualHours: round(sum(filtered, 'actualHours')),
        closedHours: round(sum(filtered, 'closedHours')),
        deviation: round(sum(filtered, 'actualHours') - sum(filtered, 'plannedHours')),
        load: Math.round((sum(filtered, 'actualHours') / 160) * 100),
        taskCount: filtered.length,
        openTasks: filtered.filter((task) => task.status !== 'closed').length,
        closedTasks: filtered.filter((task) => task.status === 'closed').length,
        overdueTasks: filtered.filter((task) => task.overdue).length
      });
    });
  });
  return rows;
}

function buildCharts(projects, users, assignments, tasks, financeRecords) {
  return {
    hoursByEmployee: users.filter((user) => user.actualHours || user.closedHours).map((user) => ({ name: user.name, hours: user.actualHours, closed: user.closedHours, load: user.load })),
    hoursByProject: projects.filter((project) => project.actualHours || project.plannedHours || project.closedHours).map((project) => ({ name: project.name, planned: project.plannedHours, actual: project.actualHours, closed: project.closedHours })),
    occupancyShare: projects.filter((project) => project.actualHours > 0).map((project) => ({ name: project.name, value: project.actualHours })),
    financeByProject: projects.filter((project) => project.income !== null || project.expense !== null || project.profit !== null).map((project) => ({ name: project.name, income: project.income || 0, expense: project.expense || 0, profit: project.profit || 0 })),
    financeTrend: buildFinanceTrend(financeRecords),
    taskTrend: buildTaskTrend(tasks),
    hoursTrend: buildHoursTrend(tasks),
    stackedHours: projects.map((project) => {
      const row = { name: project.name };
      assignments.filter((assignment) => assignment.project === project.name && assignment.actualHours > 0).forEach((assignment) => { row[assignment.employee] = assignment.actualHours; });
      return row;
    }).filter((row) => Object.keys(row).length > 1),
    expenseStructure: buildExpenseStructure(financeRecords)
  };
}

function buildFinanceTrend(records) {
  const grouped = new Map();
  records.forEach((record) => {
    if (!record.date) return;
    const month = new Date(record.date).toLocaleString('ru-RU', { month: 'short', year: '2-digit' });
    const current = grouped.get(month) || { month, income: 0, expense: 0, profit: 0 };
    if (record.kind === 'income') current.income += record.amount;
    if (record.kind === 'expense') current.expense += record.amount;
    current.profit = current.income - current.expense;
    grouped.set(month, current);
  });
  return [...grouped.values()].map((row) => ({
    month: row.month,
    income: round(row.income),
    expense: round(row.expense),
    profit: round(row.profit)
  })).slice(-18);
}

function buildExpenseStructure(records) {
  const grouped = new Map();
  records.filter((record) => record.kind === 'expense').forEach((record) => {
    const key = record.article || record.hierarchy || 'Без статьи';
    grouped.set(key, (grouped.get(key) || 0) + record.amount);
  });
  return [...grouped.entries()].map(([name, value]) => ({ name, value: round(value) })).sort((a, b) => b.value - a.value).slice(0, 12);
}

function buildTaskTrend(tasks) {
  const grouped = new Map();
  tasks.forEach((task) => {
    const date = task.closedAt || task.createdAt;
    if (!date) return;
    const month = new Date(date).toLocaleString('ru-RU', { month: 'short', year: '2-digit' });
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
    const month = new Date(date).toLocaleString('ru-RU', { month: 'short', year: '2-digit' });
    const current = grouped.get(month) || { month, hours: 0, closed: 0 };
    current.hours += task.actualHours || 0;
    current.closed += task.closedHours || 0;
    grouped.set(month, current);
  });
  return [...grouped.values()].map((row) => ({ ...row, hours: round(row.hours), closed: round(row.closed) })).filter((row) => row.hours || row.closed).slice(-12);
}

function emptyKpis() {
  return {
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
  };
}

function emptyCharts() {
  return {
    financeByProject: [],
    taskTrend: [],
    hoursByEmployee: [],
    occupancyShare: [],
    stackedHours: [],
    hoursTrend: [],
    expenseStructure: []
  };
}

function sum(rows, key) {
  return rows.reduce((acc, row) => acc + n(row[key]), 0);
}

function sumNullable(rows, key) {
  return rows.reduce((acc, row) => acc + (row[key] === null || row[key] === undefined ? 0 : n(row[key])), 0);
}

function avg(values) {
  return values.reduce((acc, value) => acc + n(value), 0) / Math.max(values.length, 1);
}

function projectTimeProgress(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return 0;
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.round(((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100);
}

function round(value) {
  return Math.round(n(value) * 10) / 10;
}

function nullableRound(value) {
  return value === null || value === undefined ? null : round(value);
}

function applyDemoComplements(data) {
  const demoWarnings = [
    ...data.meta.warnings,
    'Включены демонстрационные дополнения: недостающие часы и финансовые ряды добавлены только для показа функционала дашбордов.'
  ];

  const projects = data.projects.length ? data.projects : [
    { id: 'demo-project-1', name: 'Демо-проект', status: 'active', responsible: 'Не назначен', taskCount: 0, closedTasks: 0, overdueTasks: 0, progress: 0 }
  ];
  const users = data.users.length ? data.users : [
    { id: 'demo-user-1', name: 'Демо-сотрудник', department: 'Демо', position: 'Сотрудник', tasks: 0, closedTasks: 0, overdueTasks: 0 }
  ];

  const hasHours = data.charts.hoursByEmployee.length > 0;
  const hasFinanceForAll = data.charts.financeByProject.length >= Math.min(projects.length, 6);

  if (!hasHours) {
    data.users = users.map((user, index) => {
      const actualHours = 72 + (index % 5) * 18;
      const closedHours = Math.round(actualHours * (0.62 + (index % 3) * 0.08));
      const plannedHours = 96 + (index % 4) * 16;
      const load = Math.round((actualHours / 160) * 100);
      return {
        ...user,
        plannedHours,
        actualHours,
        closedHours,
        load,
        loadState: load < 55 ? 'low' : load < 90 ? 'normal' : load < 115 ? 'high' : 'overload',
        efficiency: Math.min(100, Math.round((closedHours / plannedHours) * 100))
      };
    });

    data.assignments = [];
    data.projects = projects.map((project, projectIndex) => {
      let plannedHours = 0;
      let actualHours = 0;
      let closedHours = 0;

      data.users.forEach((user, userIndex) => {
        if ((userIndex + projectIndex) % 3 === 2) return;
        const actual = 18 + ((userIndex + projectIndex) % 5) * 7;
        const planned = actual + 6;
        const closed = Math.round(actual * 0.72);
        plannedHours += planned;
        actualHours += actual;
        closedHours += closed;
        data.assignments.push({
          id: `demo-${user.id}-${project.id}`,
          employee: user.name,
          employeeId: user.id,
          department: user.department,
          project: project.name,
          projectId: project.id,
          projectStatus: project.status,
          plannedHours: planned,
          actualHours: actual,
          closedHours: closed,
          deviation: actual - planned,
          load: Math.round((actual / 160) * 100),
          taskCount: 2 + ((userIndex + projectIndex) % 4),
          openTasks: 1 + ((userIndex + projectIndex) % 3),
          closedTasks: 1 + ((userIndex + projectIndex) % 4),
          overdueTasks: (userIndex + projectIndex) % 5 === 0 ? 1 : 0
        });
      });

      return {
        ...project,
        plannedHours: round(plannedHours),
        actualHours: round(actualHours),
        closedHours: round(closedHours)
      };
    });
  }

  if (!hasFinanceForAll) {
    const existingFinance = new Map(data.charts.financeByProject.map((row) => [row.name, row]));
    data.projects = data.projects.map((project, index) => {
      if (project.income || project.expense || project.profit) return project;
      const income = 8_000_000 + index * 1_750_000;
      const expense = Math.round(income * (0.58 + (index % 4) * 0.06));
      return {
        ...project,
        income,
        expense,
        profit: income - expense,
        margin: Math.round(((income - expense) / income) * 100)
      };
    });
    data.projects.forEach((project) => {
      if (!existingFinance.has(project.name) && (project.income || project.expense || project.profit)) {
        existingFinance.set(project.name, {
          name: project.name,
          income: project.income || 0,
          expense: project.expense || 0,
          profit: project.profit || 0
        });
      }
    });
    data.charts.financeByProject = [...existingFinance.values()];
  }

  data.charts.hoursByEmployee = data.users.map((user) => ({ name: user.name, hours: user.actualHours || 0, closed: user.closedHours || 0, load: user.load || 0 })).filter((row) => row.hours || row.closed);
  data.charts.hoursByProject = data.projects.map((project) => ({ name: project.name, planned: project.plannedHours || 0, actual: project.actualHours || 0, closed: project.closedHours || 0 })).filter((row) => row.planned || row.actual || row.closed);
  data.charts.occupancyShare = data.projects.map((project) => ({ name: project.name, value: project.actualHours || 0 })).filter((row) => row.value);
  data.charts.stackedHours = data.projects.map((project) => {
    const row = { name: project.name };
    data.assignments.filter((assignment) => assignment.project === project.name && assignment.actualHours > 0).forEach((assignment) => { row[assignment.employee] = assignment.actualHours; });
    return row;
  }).filter((row) => Object.keys(row).length > 1);

  if (!data.charts.hoursTrend.length) {
    data.charts.hoursTrend = ['янв.', 'февр.', 'март', 'апр.', 'май', 'июнь'].map((month, index) => ({
      month,
      hours: 180 + index * 35,
      closed: 130 + index * 28
    }));
  }

  if (!data.charts.financeTrend.length) {
    data.charts.financeTrend = ['янв.', 'февр.', 'март', 'апр.', 'май', 'июнь'].map((month, index) => {
      const income = 14_000_000 + index * 2_200_000;
      const expense = 9_000_000 + index * 1_450_000;
      return { month, income, expense, profit: income - expense };
    });
  }

  if (!data.charts.expenseStructure.length) {
    data.charts.expenseStructure = [
      { name: 'ФОТ', value: 18_400_000 },
      { name: 'Подрядчики', value: 9_800_000 },
      { name: 'Инфраструктура', value: 4_300_000 },
      { name: 'Командировки', value: 2_100_000 }
    ];
  }

  data.kpis = {
    ...data.kpis,
    plannedHours: round(sum(data.projects, 'plannedHours')),
    actualHours: round(sum(data.projects, 'actualHours')),
    closedHours: round(sum(data.projects, 'closedHours')),
    avgLoad: Math.round(avg(data.users.map((user) => user.load))),
    teamLoad: Math.round(avg(data.users.map((user) => user.load))),
    income: round(sum(data.projects, 'income')),
    expense: round(sum(data.projects, 'expense')),
    profit: round(sum(data.projects, 'profit'))
  };

  data.meta = {
    ...data.meta,
    source: 'bitrix-demo',
    demoComplements: true,
    warnings: demoWarnings,
    availability: {
      ...data.meta.availability,
      taskTime: true,
      financeIncome: true,
      financeExpense: true
    }
  };

  return data;
}
