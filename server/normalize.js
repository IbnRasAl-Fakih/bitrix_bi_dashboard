function n(value) {
  const normalized = String(value ?? '').replace(/\s/g, '').replace(',', '.').split('|')[0];
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function taskTimeSeconds(task, rawElapsedTime = null) {
  const elapsedTime = rawElapsedTime || task.elapsedTime || task.ELAPSED_TIME;
  if (elapsedTime && typeof elapsedTime === 'object') {
    const seconds = n(elapsedTime.seconds ?? elapsedTime.SECONDS);
    if (seconds > 0) return seconds;

    const minutes = n(elapsedTime.minutes ?? elapsedTime.MINUTES);
    if (minutes > 0) return minutes * 60;
  }

  return n(task.TIME_SPENT_IN_LOGS ?? task.timeSpentInLogs ?? task.timeSpent);
}

const NO_PROJECT_ID = '__no_project__';

function text(...values) {
  return values.filter(Boolean).join(' ').trim();
}

function dateOrNull(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const european = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  const date = european
    ? new Date(
      Number(european[3]),
      Number(european[2]) - 1,
      Number(european[1]),
      Number(european[4] || 0),
      Number(european[5] || 0),
      Number(european[6] || 0)
    )
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function stringIds(value) {
  if (!value) return [];
  const values = Array.isArray(value) ? value : typeof value === 'object' ? Object.values(value) : String(value).split(',');
  return [...new Set(values.map((item) => String(item?.id ?? item?.ID ?? item).trim()).filter((item) => item && item !== '0'))];
}

function stringTags(value) {
  if (!value) return [];
  const values = Array.isArray(value) ? value : typeof value === 'object' ? Object.values(value) : String(value).split(',');
  return [...new Set(values
    .map((item) => String(item?.title ?? item?.TITLE ?? item?.name ?? item?.NAME ?? item?.value ?? item?.VALUE ?? item).trim())
    .filter(Boolean))];
}

function tableCellValue(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map((item) => tableCellValue(item)).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    return value.title ?? value.TITLE ?? value.name ?? value.NAME ?? value.value ?? value.VALUE ?? value.label ?? value.LABEL ?? value.id ?? value.ID ?? JSON.stringify(value);
  }
  return value;
}

function parseGenericSmartRows(items, settings = {}, users = [], fields = null) {
  const userById = new Map((users || []).map((user) => [String(user.id), user.name]));
  const enumMaps = buildFieldEnumMaps(fields);
  return (items || []).map((item, index) => {
    const row = {};
    Object.entries(item || {}).forEach(([key, value]) => {
      row[key] = tableCellValue(value);
    });

    const sourceRequestNumber = firstValue(row, ['requestNumber', 'number', 'code', 'Номер заявки', 'Номер Заявки']);
    const shortDescription = sourceRequestNumber || firstValue(row, ['shortDescription', 'title', 'name', 'Краткое описание заявки', 'Краткое описание ЗН', 'Краткое описание']);
    const fullDescription = firstValue(row, ['fullDescription', 'description', 'Описание', 'Полное описание заявки', 'Полное описание ЗИ', 'Полное описание ЗН', 'Полное описание']);
    const requestType = firstValue(row, ['requestType', 'type', 'Тип заявки', 'Тип', 'categoryName', 'categoryId']);
    const initiator = firstValue(row, ['initiator', 'createdBy', 'createdByName', 'Инициатор']);
    const assignee = firstValue(row, ['assignee', 'assignedById', 'assignedByName', 'Исполнитель']);
    const solution = firstValue(row, ['solution', 'result', 'resolution', 'Решение']);
    const registeredAt = dateOrNull(firstValue(row, ['registeredAt', 'createdTime', 'createdAt', 'Дата регистрации заявки', 'Дата регистрации ЗИ', 'Дата регистрации']));
    const completedAt = dateOrNull(firstValue(row, ['completedAt', 'Дата выполнения заявки', 'Дата выполнения']));
    const closedAt = dateOrNull(firstValue(row, ['closedAt', 'closedTime', 'Дата закрытия заявки', 'Дата закрытия']));

    const mappedRequestNumber = firstValue(row, [settings.requestNumberField, 'ufCrm36Id'].filter(Boolean)) || sourceRequestNumber || index + 1;
    const mappedShortDescription = firstValue(row, [settings.shortDescriptionField, 'ufCrm36ShortDescription'].filter(Boolean)) || shortDescription;
    const mappedFullDescription = firstValue(row, [settings.fullDescriptionField, 'ufCrm36FullDescription'].filter(Boolean)) || fullDescription;
    const requestTypeField = settings.requestTypeField || 'ufCrm36Type';
    const mappedRequestTypeRaw = firstValue(row, [requestTypeField, 'ufCrm36Type'].filter(Boolean)) || requestType;
    const mappedRequestType = enumMaps.get(requestTypeField)?.get(String(mappedRequestTypeRaw)) || enumMaps.get('ufCrm36Type')?.get(String(mappedRequestTypeRaw)) || mappedRequestTypeRaw;
    const mappedInitiatorRaw = firstValue(row, [settings.initiatorField, 'ufCrm36Initiator'].filter(Boolean)) || initiator;
    const mappedAssigneeRaw = firstValue(row, [settings.assigneeField, 'ufCrm36Executor'].filter(Boolean)) || assignee;
    const mappedSolution = firstValue(row, [settings.solutionField, 'ufCrm36Solution'].filter(Boolean)) || solution;
    const mappedRegisteredAt = dateOrNull(firstValue(row, [settings.registeredAtField, 'ufCrm36RegistrationDate'].filter(Boolean))) || registeredAt;
    const mappedCompletedAt = dateOrNull(firstValue(row, [settings.completedAtField, 'ufCrm36ProcessingDate'].filter(Boolean))) || completedAt;
    const mappedClosedAt = dateOrNull(firstValue(row, [settings.closedAtField, 'ufCrm36ClosedDate'].filter(Boolean))) || closedAt;
    const mappedViolated = firstValue(row, [settings.violatedField, 'ufCrm36Violated'].filter(Boolean));
    const initiatorId = /^\d+$/.test(String(mappedInitiatorRaw)) ? String(mappedInitiatorRaw) : '';
    const assigneeId = /^\d+$/.test(String(mappedAssigneeRaw)) ? String(mappedAssigneeRaw) : '';

    return {
      ...row,
      id: String(item?.id ?? item?.ID ?? index + 1),
      requestNumber: mappedRequestNumber,
      shortDescription: mappedShortDescription,
      fullDescription: mappedFullDescription,
      requestType: mappedRequestType,
      initiator: userById.get(initiatorId) || mappedInitiatorRaw,
      initiatorId,
      assignee: userById.get(assigneeId) || mappedAssigneeRaw,
      assigneeId,
      solution: mappedSolution,
      registeredAt: mappedRegisteredAt,
      completedAt: mappedCompletedAt,
      closedAt: mappedClosedAt,
      violated: mappedViolated === '' ? booleanValue(firstValue(row, ['violated', 'overdue'])) : booleanValue(mappedViolated)
    };
  });
}

function firstValue(row, keys) {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return '';
}

function buildFieldEnumMaps(fields) {
  const maps = new Map();
  const entries = Array.isArray(fields)
    ? fields.map((field) => [field.key || field.name || field.code, field])
    : Object.entries(fields || {});

  entries.forEach(([key, field]) => {
    const items = field?.items || field?.Items || field?.values || field?.VALUES;
    if (!key || !Array.isArray(items)) return;
    const map = new Map();
    items.forEach((item) => {
      const id = item.ID ?? item.id ?? item.VALUE_ID ?? item.valueId ?? item.value;
      const value = item.VALUE ?? item.value ?? item.NAME ?? item.name ?? item.label;
      if (id !== null && id !== undefined && value !== null && value !== undefined) map.set(String(id), String(value));
    });
    if (map.size) maps.set(String(key), map);
  });

  return maps;
}

function booleanValue(value) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return false;
  return ['y', 'yes', 'true', '1', 'да', 'нарушено'].includes(normalized);
}

function tagLabel(value) {
  return String((value?.title ?? value?.TITLE ?? value?.name ?? value?.NAME ?? value?.value ?? value?.VALUE ?? value) || '').trim();
}

function normalizedTag(value) {
  return tagLabel(value).toLowerCase().replace(/\s+/g, ' ');
}

function taskHasTag(task, expectedTag) {
  const tag = String(expectedTag || '\u0437\u0430\u044f\u0432\u043a\u0430 itsm').trim().toLowerCase().replace(/\s+/g, ' ');
  return (task.tags || []).some((item) => normalizedTag(item) === tag);
}

function itsmStatusLabel(status) {
  if (status === 'closed') return '\u0412\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u0430';
  if (status === 'progress') return '\u0412 \u0440\u0430\u0431\u043e\u0442\u0435';
  return '\u041e\u0442\u043a\u0440\u044b\u0442\u0430';
}

function buildItsmRequestsFromTasks(tasks, users = [], projects = [], settings = {}) {
  const userById = new Map((users || []).map((user) => [String(user.id), user.name]));
  const projectById = new Map((projects || []).map((project) => [String(project.id), project.name]));
  const tag = settings.tag || '\u0437\u0430\u044f\u0432\u043a\u0430 itsm';

  return (tasks || [])
    .filter((task) => taskHasTag(task, tag))
    .map((task) => {
      const row = { ...task };
      const typeTag = (task.tags || []).map(tagLabel).find((item) => item && normalizedTag(item) !== normalizedTag(tag));
      const requestNumber = firstValue(row, [settings.requestNumberField].filter(Boolean));
      const shortDescription = firstValue(row, [settings.shortDescriptionField].filter(Boolean)) || task.title;
      const fullDescription = firstValue(row, [settings.fullDescriptionField].filter(Boolean)) || task.description;
      const requestType = firstValue(row, [settings.requestTypeField].filter(Boolean)) || typeTag || itsmStatusLabel(task.status);
      const rawInitiator = firstValue(row, [settings.initiatorField].filter(Boolean));
      const rawAssignee = firstValue(row, [settings.assigneeField].filter(Boolean));
      const solution = firstValue(row, [settings.solutionField].filter(Boolean)) || (task.status === 'closed' ? itsmStatusLabel(task.status) : '');
      const registeredAt = dateOrNull(firstValue(row, [settings.registeredAtField].filter(Boolean))) || task.createdAt;
      const completedAt = dateOrNull(firstValue(row, [settings.completedAtField].filter(Boolean))) || task.closedAt;
      const closedAt = dateOrNull(firstValue(row, [settings.closedAtField].filter(Boolean))) || task.closedAt;
      const violated = firstValue(row, [settings.violatedField].filter(Boolean));
      return {
        id: `task:${task.id}`,
        taskId: task.id,
        requestNumber,
        shortDescription,
        fullDescription,
        requestType,
        initiator: rawInitiator || userById.get(String(task.creatorId)) || '\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d',
        initiatorId: task.creatorId,
        assignee: rawAssignee || userById.get(String(task.responsibleId)) || '\u041d\u0435 \u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d',
        assigneeId: task.responsibleId,
        solution,
        registeredAt,
        completedAt,
        closedAt,
        violated: violated === '' ? task.overdue : booleanValue(violated),
        project: projectById.get(String(task.projectId)) || '',
        projectId: task.projectId,
        deadline: task.deadline,
        status: task.status,
        source: 'task'
      };
    });
}

function buildDepartmentMap(departments) {
  const map = new Map();
  departments.forEach((department) => {
    const id = department?.ID ?? department?.id ?? department?.ID_PARENT ?? department?.xmlId;
    const name = department?.NAME ?? department?.name ?? department?.title ?? department?.TITLE;
    if (id && name) map.set(String(id), String(name).trim());
  });
  return map;
}

function departmentLabel(user, departmentById) {
  const direct = user.department || user.DEPARTMENT || user.WORK_DEPARTMENT;
  const raw = user.UF_DEPARTMENT ?? user.ufDepartment ?? user.departmentId ?? user.departmentID ?? user.departments ?? user.departmentIds;
  const values = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object'
      ? Object.values(raw)
      : raw
        ? String(raw).split(',')
        : [];

  const names = values.map((item) => {
    if (item && typeof item === 'object') {
      const name = item.NAME ?? item.name ?? item.title ?? item.TITLE;
      const id = item.ID ?? item.id ?? item.value;
      return name || departmentById.get(String(id));
    }
    return departmentById.get(String(item).trim()) || (String(item).trim() && !/^\d+$/.test(String(item).trim()) ? String(item).trim() : '');
  }).filter(Boolean);

  if (names.length) return names.at(-1);
  return direct || 'Не указан';
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
    financeExpense: false,
    departments: false
      }
    },
    kpis: emptyKpis(),
    users: [],
    projects: [],
    tasks: [],
    assignments: [],
    financeRecords: [],
    itsmRequests: [],
    charts: emptyCharts()
  };
}

export function normalizeBitrixData(raw, settings) {
  const warnings = [...(raw.errors || [])];
  const elapsedTimeByTaskId = new Map(Object.entries(raw.taskElapsedTimes || {}).map(([id, value]) => [String(id), value]));
  const financeSettings = settings.financeMapping || {};
  const departmentById = buildDepartmentMap(raw.departments || []);

  const users = (raw.users || []).map((user, index) => ({
    id: String(user.ID ?? user.id ?? index + 1),
    name: text(user.NAME, user.LAST_NAME) || user.name || `Пользователь ${user.ID ?? user.id ?? index + 1}`,
    department: departmentLabel(user, departmentById),
    position: user.WORK_POSITION || user.position || 'Не указана',
    source: 'bitrix'
  }));

  const baseProjects = (raw.workgroups || []).map((group, index) => ({
    id: String(group.ID ?? group.id ?? index + 1),
    name: group.NAME || group.name || `Проект ${group.ID ?? group.id ?? index + 1}`,
    status: String(group.CLOSED ?? group.closed ?? '').toUpperCase() === 'Y' ? 'completed' : 'active',
    responsibleId: String(group.OWNER_ID ?? group.ownerId ?? ''),
    startDate: dateOrNull(group.PROJECT_DATE_START ?? group.projectDateStart ?? group.DATE_START ?? group.dateStart),
    endDate: dateOrNull(group.PROJECT_DATE_FINISH ?? group.projectDateFinish ?? group.DATE_FINISH ?? group.dateFinish),
    tags: stringTags(group.TAGS ?? group.tags ?? group.KEYWORDS ?? group.keywords),
    source: 'bitrix'
  }));

  const taskRows = (raw.tasks || []).map((task, index) => {
    const status = taskStatus(task);
    const plannedSeconds = n(task.TIME_ESTIMATE ?? task.timeEstimate);
    const taskId = String(task.ID ?? task.id ?? index + 1);
    const elapsedTime = elapsedTimeByTaskId.get(taskId);
    const actualSeconds = taskTimeSeconds(task, elapsedTime);
    const timeLogs = (elapsedTime?.items || [])
      .map((item) => ({
        id: item.id || '',
        userId: item.userId || '',
        seconds: n(item.seconds),
        createdAt: dateOrNull(item.createdAt)
      }))
      .filter((item) => item.createdAt);
    const timeLogDates = timeLogs.map((item) => item.createdAt);
    const deadline = dateOrNull(task.DEADLINE ?? task.deadline);
    const rawProjectId = String(task.GROUP_ID ?? task.groupId ?? '');
    const projectId = rawProjectId && rawProjectId !== '0' ? rawProjectId : NO_PROJECT_ID;
    const customFields = Object.fromEntries(Object.entries(task || {})
      .filter(([key]) => /^uf/i.test(key))
      .map(([key, value]) => [key, tableCellValue(value)]));
    return {
      ...customFields,
      id: taskId,
      title: task.TITLE || task.title || `Задача ${task.ID ?? task.id ?? index + 1}`,
      projectId,
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
      lastTimeLogAt: timeLogDates.slice().sort().at(-1) || null,
      timeLogDates,
      timeLogs,
      startDatePlan: dateOrNull(task.START_DATE_PLAN ?? task.startDatePlan ?? task.DATE_START ?? task.dateStart),
      endDatePlan: dateOrNull(task.END_DATE_PLAN ?? task.endDatePlan),
      accompliceIds: stringIds(task.ACCOMPLICES ?? task.accomplices),
      auditorIds: stringIds(task.AUDITORS ?? task.auditors),
      tags: stringTags(task.TAGS ?? task.tags),
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
  const itsmRequests = buildItsmRequestsFromTasks(taskRows, users, baseProjects, settings.itsmMapping || {});
  const financeByProject = aggregateFinanceByProject(financeRecords);
  const projects = ensureTaskProjects(mergeFinanceProjects(baseProjects, financeByProject), taskRows);
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

  const data = assembleAnalytics(users, projects, taskRows, financeByProject, financeRecords, warnings, itsmRequests);
  data.meta.realRecords = users.length + projects.length + taskRows.length + (raw.deals || []).length + financeRecords.length + itsmRequests.length;
  data.meta.financeSmartProcess = {
    entityTypeId: raw.financeEntityTypeId || financeSettings.smartProcessEntityTypeId || null,
    records: financeRecords.length,
    projectField: financeSettings.smartProjectField,
    amountField: financeSettings.smartAmountField
  };
  data.meta.itsmSmartProcess = {
    source: 'tasks',
    tag: settings.itsmMapping?.tag || '\u0437\u0430\u044f\u0432\u043a\u0430 itsm',
    records: itsmRequests.length,
    title: settings.itsmMapping?.smartProcessTitle || 'Заявки ITSM'
  };
  data.meta.taskRelations = {
    available: Boolean(raw.taskRelations?.available),
    source: raw.taskRelations?.source || 'unavailable',
    count: Object.values(raw.taskRelations?.relations || {}).reduce((total, ids) => total + ids.length, 0),
    error: raw.taskRelations?.error || null
  };
  data.meta.taskElapsedTimes = {
    records: Object.values(raw.taskElapsedTimes || {}).reduce((total, item) => total + (item.items?.length || 0), 0),
    tasksWithDates: taskRows.filter((task) => task.timeLogDates?.length).length
  };
  data.meta.availability = {
    users: users.length > 0,
    departments: departmentById.size > 0,
    projects: projects.length > 0,
    tasks: taskRows.length > 0,
    taskTime: taskRows.some((task) => task.plannedHours > 0 || task.actualHours > 0 || task.closedHours > 0),
    financeIncome: hasIncome,
    financeExpense: hasExpense,
    itsmRequests: itsmRequests.length > 0
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

function ensureTaskProjects(projects, tasks) {
  const projectIds = new Set(projects.map((project) => project.id));
  const missingProjectIds = [...new Set(tasks.map((task) => task.projectId).filter(Boolean))]
    .filter((projectId) => !projectIds.has(projectId));

  if (!missingProjectIds.length) return projects;

  return [
    ...projects,
    ...missingProjectIds.map((projectId) => ({
      id: projectId,
      name: projectId === NO_PROJECT_ID ? 'Без проекта' : `Проект ${projectId}`,
      status: 'active',
      responsibleId: '',
      startDate: null,
      endDate: null,
      tags: [],
      source: 'tasks'
    }))
  ];
}

function assembleAnalytics(users, projects, tasks, financeByProject, financeRecords, warnings, itsmRequests = []) {
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
    meta: { source: 'bitrix', warnings, generatedAt: new Date().toISOString(), realRecords: users.length + projects.length + tasks.length + financeRecords.length + itsmRequests.length },
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
    itsmRequests,
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
  const hasTime = tasks.some((task) => task.actualHours > 0 || task.closedHours > 0);
  return {
    hoursByEmployee: hasTime
      ? users.filter((user) => user.actualHours || user.closedHours).map((user) => ({ name: user.name, hours: user.actualHours, closed: user.closedHours, load: user.load }))
      : users.filter((user) => user.tasks).map((user) => ({ name: user.name, hours: user.tasks, closed: user.closedTasks, load: user.load, metricKind: 'tasks', metricName: 'Задач' })),
    hoursByDepartment: buildHoursByDepartment(users, !hasTime),
    hoursByProject: projects
      .filter((project) => project.actualHours || project.plannedHours || project.closedHours || (!hasTime && project.taskCount))
      .map((project) => ({ name: project.name, planned: project.plannedHours, actual: project.actualHours, closed: project.closedHours, taskCount: project.taskCount, metricKind: hasTime ? 'hours' : 'tasks' })),
    occupancyShare: hasTime
      ? projects.filter((project) => project.actualHours > 0).map((project) => ({ name: project.name, value: project.actualHours }))
      : projects.filter((project) => project.taskCount > 0).map((project) => ({ name: project.name, value: project.taskCount, metricKind: 'tasks', metricName: 'Задач' })),
    financeByProject: projects.filter((project) => project.income !== null || project.expense !== null || project.profit !== null).map((project) => ({ name: project.name, income: project.income || 0, expense: project.expense || 0, profit: project.profit || 0 })),
    financeTrend: buildFinanceTrend(financeRecords),
    taskTrend: buildTaskTrend(tasks),
    hoursTrend: hasTime ? buildHoursTrend(tasks) : buildTaskVolumeTrend(tasks),
    stackedHours: projects.map((project) => {
      const row = { name: project.name };
      assignments
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
      hours: round(row.hours),
      closed: round(row.closed),
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
    hoursByDepartment: [],
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
  addDemoStrategy(data);
  addDemoItsmRequests(data);

  const demoWarnings = [
    ...data.meta.warnings,
    'Включены демонстрационные дополнения: задачи, роли, часы и финансы добавлены к существующим целям только для показа функционала дашбордов.'
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
  data.charts.hoursByDepartment = buildHoursByDepartment(data.users);
  data.charts.hoursByProject = data.projects.map((project) => ({ name: project.name, planned: project.plannedHours || 0, actual: project.actualHours || 0, closed: project.closedHours || 0 })).filter((row) => row.planned || row.actual || row.closed);
  data.charts.occupancyShare = data.projects.map((project) => ({ name: project.name, value: project.actualHours || 0 })).filter((row) => row.value);
  data.charts.financeByProject = data.projects.filter((project) => project.income !== null || project.expense !== null || project.profit !== null).map((project) => ({
    name: project.name,
    income: project.income || 0,
    expense: project.expense || 0,
    profit: project.profit || 0
  }));
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
    activeProjects: data.projects.filter((project) => project.status === 'active').length,
    completedProjects: data.projects.filter((project) => project.status === 'completed').length,
    employees: data.users.length,
    tasks: data.tasks.length,
    openTasks: data.tasks.filter((task) => task.status !== 'closed').length,
    closedTasks: data.tasks.filter((task) => task.status === 'closed').length,
    overdueTasks: data.tasks.filter((task) => task.overdue).length,
    completionRate: Math.round((data.tasks.filter((task) => task.status === 'closed').length / Math.max(data.tasks.length, 1)) * 100),
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
    realRecords: data.users.length + data.projects.length + data.tasks.length + data.financeRecords.length + (data.itsmRequests || []).length,
    warnings: demoWarnings,
    availability: {
      ...data.meta.availability,
      taskTime: true,
      financeIncome: true,
      financeExpense: true,
      itsmRequests: (data.itsmRequests || []).length > 0
    }
  };

  return data;
}

function addDemoItsmRequests(data) {
  const realItsmRequests = data.itsmRequests || [];

  data.itsmRequests = [
    {
      id: 'demo-itsm-1',
      requestNumber: 'MTAA-DQXF3T',
      shortDescription: 'Контроль ЕР по БЕ в ИТ0001',
      fullDescription: 'Контроль ЕР по БЕ в ИТ0001',
      requestType: 'запрос на изменение',
      initiator: 'Абдикеримова М. Т.',
      assignee: 'Нурбакова Э. Е.',
      solution: 'Нурбакова Э. Е.',
      registeredAt: dateOrNull('2026-02-04'),
      source: 'demo-itsm'
    },
    {
      id: 'demo-itsm-2',
      requestNumber: 'ESMA-DU89XP',
      shortDescription: 'Добавлении кредитора по СН ОДС (ВО 7РБП)',
      fullDescription: 'Добавлении кредитора по СН ОДС (ВО 7РБП)',
      requestType: 'запрос на изменение',
      initiator: 'Мальдыбекова Э. С.',
      assignee: 'Нурбакова Э. Е.',
      solution: 'Нурбакова Э. Е.',
      registeredAt: dateOrNull('2026-05-19'),
      source: 'demo-itsm'
    },
    {
      id: 'demo-itsm-3',
      requestNumber: 'LAAA-DU89ST',
      shortDescription: 'Дополнения к настройкам сегмента РУ бизнес сфер по 33ZA',
      fullDescription: 'Дополнения к настройкам сегмента РУ бизнес сфер по 33ZA',
      requestType: 'запрос на изменение',
      initiator: 'Ахметова Л. А.',
      assignee: 'Нурбакова Э. Е.',
      solution: 'Нурбакова Э. Е.',
      registeredAt: dateOrNull('2026-05-20'),
      source: 'demo-itsm'
    },
    {
      id: 'demo-itsm-4',
      requestNumber: 'ESMA-DUA8RR',
      shortDescription: 'Перенос в PCE добавлении кредитора по СН ОДС (ВО 7РБП)',
      fullDescription: 'Перенос в PCE добавлении кредитора по СН ОДС (ВО 7РБП)',
      requestType: 'запрос на изменение',
      initiator: 'Мальдыбекова Э. С.',
      assignee: 'Нурбакова Э. Е.',
      solution: 'Нурбакова Э. Е.',
      registeredAt: dateOrNull('2026-05-21'),
      source: 'demo-itsm'
    },
    {
      id: 'demo-itsm-5',
      requestNumber: 'ATKV-DUB8RY',
      shortDescription: 'Корректировка ZH58, переменн. РП и должности',
      fullDescription: 'Корректировка ZH58, переменн. РП и должности',
      requestType: 'запрос на изменение',
      initiator: 'Карабаева А. Т.',
      assignee: 'Нурбакова Э. Е.',
      solution: 'Нурбакова Э. Е.',
      registeredAt: dateOrNull('2026-05-22'),
      source: 'demo-itsm'
    },
    {
      id: 'demo-itsm-6',
      requestNumber: 'ATKV-DUH6GY',
      shortDescription: 'Дополнение справочника должностей в SAP',
      fullDescription: 'Дополнение справочника должностей в SAP',
      requestType: 'запрос на изменение',
      initiator: 'Карабаева А. Т.',
      assignee: 'Нурбакова Э. Е.',
      solution: 'Нурбакова Э. Е.',
      registeredAt: dateOrNull('2026-05-28'),
      source: 'demo-itsm'
    },
    {
      id: 'demo-itsm-7',
      requestNumber: '',
      shortDescription: 'Ошибка при указании МВП в Заказе РМ (ТОРО) 331200031160',
      fullDescription: 'В основных данных Заказа РМ (ТОРО) некорректно указан МВП. Заказ уже был рассчитан.',
      requestType: 'инцидент',
      initiator: 'Самалтикова А.К.',
      assignee: 'Непашева Э.Н.',
      solution: 'Создать новый Заказ. Сделать перенос затрат с МВЗ, на который был рассчитан "старый" Заказ, на новый Заказ. Рассчитать новый Заказ актуальным периодом.',
      registeredAt: dateOrNull('2023-12-05'),
      source: 'demo-itsm'
    },
    {
      id: 'demo-itsm-8',
      requestNumber: '',
      shortDescription: 'Не могу создать ДВС Бизнес-сферу указываю 29 NA, а оно обратно исчезает',
      fullDescription: 'Не могу создать ДВС Бизнес-сферу указываю 29 NA, а оно обратно исчезает.',
      requestType: 'инцидент',
      initiator: 'Байбатчаев О. и др.',
      assignee: 'Сложеникина Е.',
      solution: 'Некорректный перенос запроса в продуктив',
      registeredAt: dateOrNull('2023-12-12'),
      source: 'demo-itsm'
    },
    {
      id: 'demo-itsm-9',
      requestNumber: '',
      shortDescription: 'Ошибка создание ДВС',
      fullDescription: 'Ошибка создание ДВС',
      requestType: 'инцидент',
      initiator: 'Тойшманова А.Р.',
      assignee: 'Шокалакова',
      solution: 'В договоре проверить сумму в закладке ПЛ/Данные и ПЛ/спецификация ПЛ/Данные (-) ПЛ/спецификация (=) ???',
      registeredAt: dateOrNull('2023-12-01'),
      source: 'demo-itsm'
    },
    {
      id: 'demo-itsm-10',
      requestNumber: '',
      shortDescription: 'Подскажите пожалуйста что тут не так?',
      fullDescription: 'Ошибка в ДВС "Укажите только действующие контировки"',
      requestType: 'инцидент',
      initiator: 'Байбатчаев Олжас',
      assignee: 'Шокалакова',
      solution: 'В инструкции по созданию ДВС написано указать СПП или СГ',
      registeredAt: dateOrNull('2023-12-04'),
      source: 'demo-itsm'
    },
    {
      id: 'demo-itsm-11',
      requestNumber: '',
      shortDescription: 'Ошибка при сохранении КД ДС2',
      fullDescription: 'Ошибка - нет цены',
      requestType: 'инцидент',
      initiator: 'Alla G Ivanova',
      assignee: 'Шейкина',
      solution: 'Некорректно создана позиция контракта при сохранении ДС1, поправила',
      registeredAt: dateOrNull('2023-12-01'),
      source: 'demo-itsm'
    }
  ];

  data.itsmRequests = [...realItsmRequests, ...data.itsmRequests];

  data.itsmRequests = data.itsmRequests.map((row, index) => {
    const isDemo = row.source === 'demo-itsm';
    return {
      ...row,
      requestNumber: isDemo ? index + 1 : row.requestNumber,
      shortDescription: isDemo ? row.requestNumber || row.shortDescription : row.shortDescription,
      completedAt: isDemo ? row.completedAt || row.registeredAt : row.completedAt,
      closedAt: isDemo ? row.closedAt || row.registeredAt : row.closedAt,
      violated: row.violated ?? (isDemo && [2, 8].includes(index))
    };
  });

  data.meta.itsmSmartProcess = {
    ...(data.meta.itsmSmartProcess || {}),
    records: data.itsmRequests.length
  };
}

function addDemoStrategy(data) {
  const goals = data.projects.filter((project) => (project.tags || []).some((tag) => String(tag).trim().toLowerCase() === 'цель'));
  if (!goals.length) return;

  const people = [
    ['demo-strategy-user-1', 'Томирис', 'Стратегия', 'Директор по развитию'],
    ['demo-strategy-user-2', 'Мерей', 'Продажи', 'Коммерческий директор'],
    ['demo-strategy-user-3', 'Диас', 'Продукт', 'Руководитель продукта'],
    ['demo-strategy-user-4', 'Мирас', 'Инженерия', 'Технический директор'],
    ['demo-strategy-user-5', 'Ержан', 'Финансы', 'Финансовый директор'],
    ['demo-strategy-user-6', 'Амира', 'Операции', 'Руководитель проектов'],
    ['demo-strategy-user-7', 'Нурсултан', 'Консалтинг', 'Архитектор решений'],
    ['demo-strategy-user-8', 'Асель', 'Производство', 'Главный инженер'],
    ['demo-strategy-user-9', 'Эльнура', 'Маркетинг', 'Руководитель маркетинга'],
    ['demo-strategy-user-10', 'Инкар', 'Продажи', 'Менеджер ключевых клиентов'],
    ['demo-strategy-user-11', 'Аружан', 'Качество', 'Руководитель по качеству'],
    ['demo-strategy-user-12', 'Мадина', 'Аналитика', 'Бизнес-аналитик']
  ].map(([id, name, department, position]) => ({
    id, name, department, position, source: 'demo-strategy',
    projects: 2, tasks: 6, closedTasks: 3, overdueTasks: 1,
    plannedHours: 120, actualHours: 104, closedHours: 62, load: 65,
    loadState: 'normal', efficiency: 78, lastActivity: demoDate(-2)
  }));
  const userById = new Map(people.map((user) => [user.id, user]));
  const existingUserIds = new Set(data.users.map((user) => user.id));
  data.users.push(...people.filter((user) => !existingUserIds.has(user.id)));

  const strategyTasks = [];
  const financeRecords = [];
  goals.forEach((goal, goalIndex) => {
    if (data.tasks.some((task) => task.projectId === goal.id && task.source === 'demo-strategy')) return;

    const company = (goal.tags || []).some((tag) => String(tag).trim().toLowerCase() === 'iqse') ? 'iqse' : 'iqs';
    const owner = goal.responsibleId && data.users.some((user) => user.id === goal.responsibleId)
      ? goal.responsibleId
      : `demo-strategy-user-${(goalIndex % 6) + 1}`;
    const start = goal.startDate ? Math.round((new Date(goal.startDate).getTime() - Date.now()) / 86400000) : -120 - goalIndex * 20;
    const end = goal.endDate ? Math.round((new Date(goal.endDate).getTime() - Date.now()) / 86400000) : 120 + goalIndex * 30;
    const directions = demoGoalScenario(goal, goalIndex, company);

    let sequence = 0;
    directions.forEach(([directionTitle, initiatives], directionIndex) => {
      const directionId = `demo-strategy-${goal.id}-direction-${directionIndex + 1}`;
      const personalizedInitiatives = initiatives.map(([title, status, ownerIndex], initiativeIndex) => [
        title,
        demoInitiativeStatus(status, goalIndex, directionIndex, initiativeIndex),
        ownerIndex
      ]);
      const directionStatus = personalizedInitiatives.every(([, status]) => status === 'closed') ? 'closed' : 'progress';
      strategyTasks.push(demoStrategyTask({
        id: directionId, projectId: goal.id, title: directionTitle, status: directionStatus,
        ownerId: owner, accompliceIds: ['demo-strategy-user-1'], auditorIds: ['demo-strategy-user-5'],
        start: start + directionIndex * 25, end: end - (1 - directionIndex) * 35, sequence: sequence++
      }, new Map(data.users.map((user) => [user.id, user]))));
      personalizedInitiatives.forEach(([title, status, ownerIndex], initiativeIndex) => {
        const overdue = goalIndex === 0 && directionIndex === 0 && initiativeIndex === 1;
        const taskId = `${directionId}-task-${initiativeIndex + 1}`;
        const memberNumber = ((ownerIndex + goalIndex * 2 - 1) % people.length) + 1;
        const accompliceNumber = (memberNumber % people.length) + 1;
        const observerNumber = ((memberNumber + 3) % people.length) + 1;
        strategyTasks.push(demoStrategyTask({
          id: taskId, projectId: goal.id, parentId: directionId, title, status: overdue ? 'progress' : status,
          ownerId: `demo-strategy-user-${memberNumber}`,
          accompliceIds: [`demo-strategy-user-${accompliceNumber}`, 'demo-strategy-user-1'],
          auditorIds: [owner, `demo-strategy-user-${observerNumber}`],
          start: start + 20 + initiativeIndex * 45 + directionIndex * 20,
          end: overdue ? -12 : Math.min(end - 15, 30 + initiativeIndex * 45 + directionIndex * 20),
          sequence: sequence++,
          relatedTaskIds: initiativeIndex ? [`${directionId}-task-${initiativeIndex}`] : []
        }, userById));
      });
    });

    if (goal.income === null || goal.expense === null || goal.profit === null) {
      const income = 48_000_000 + goalIndex * 17_000_000;
      const expense = Math.round(income * (0.62 + (goalIndex % 3) * 0.05));
      goal.income = income;
      goal.expense = expense;
      goal.profit = income - expense;
      goal.margin = Math.round((goal.profit / income) * 100);
      financeRecords.push(
        demoFinanceRecord(`demo-strategy-${goal.id}-income`, goal.name, income, 'income', -30 - goalIndex * 12, 'Продажи'),
        demoFinanceRecord(`demo-strategy-${goal.id}-expense`, goal.name, expense, 'expense', -18 - goalIndex * 9, 'Проектные затраты')
      );
    }
  });

  data.tasks.push(...strategyTasks);
  goals.forEach((goal) => {
    const tasks = data.tasks.filter((task) => task.projectId === goal.id);
    goal.taskCount = tasks.length;
    goal.closedTasks = tasks.filter((task) => task.status === 'closed').length;
    goal.openTasks = tasks.length - goal.closedTasks;
    goal.overdueTasks = tasks.filter((task) => task.overdue).length;
    goal.plannedHours = round(sum(tasks, 'plannedHours'));
    goal.actualHours = round(sum(tasks, 'actualHours'));
    goal.closedHours = round(sum(tasks, 'closedHours'));
    goal.team = [...new Set(tasks.map((task) => task.responsible).filter(Boolean))];
  });
  data.assignments.push(...buildAssignments(data.users, goals, strategyTasks));
  data.financeRecords.push(...financeRecords);
  addDemoGoalProjects(data, goals, people);
  data.meta.taskRelations = {
    available: true,
    source: 'demo-strategy',
    count: strategyTasks.reduce((total, task) => total + task.relatedTaskIds.length, 0),
    error: null
  };
}

function addDemoGoalProjects(data, goals, people) {
  if (data.projects.some((project) => project.source === 'demo-goal-project')) return;
  const linkedProjects = [];
  const projectTasks = [];
  const projectNames = [
    ['Пилотное внедрение', 'Масштабирование решения'],
    ['Разработка продукта', 'Коммерческий запуск'],
    ['Подготовка инфраструктуры', 'Внедрение у заказчика'],
    ['Проектирование решения', 'Промышленная эксплуатация']
  ];

  goals.forEach((goal, goalIndex) => {
    const company = (goal.tags || []).some((tag) => String(tag).toLowerCase() === 'iqse') ? 'iqse' : 'iqs';
    const shortGoal = String(goal.name).replace(/^Перевод клиентов на |^Продвижение |^Развитие |^Выход на рынок |^Рост /i, '');
    for (let projectIndex = 0; projectIndex < 2; projectIndex += 1) {
      const id = `demo-linked-${goal.id}-${projectIndex + 1}`;
      const owner = people[(goalIndex * 2 + projectIndex + 3) % people.length];
      const income = 18_000_000 + goalIndex * 4_500_000 + projectIndex * 7_000_000;
      const expense = Math.round(income * (0.58 + ((goalIndex + projectIndex) % 4) * 0.06));
      const tasks = Array.from({ length: 5 + ((goalIndex + projectIndex) % 3) }, (_, taskIndex) => demoProjectTask({
        id: `${id}-task-${taskIndex + 1}`,
        projectId: id,
        title: ['Анализ требований', 'Проектирование', 'Разработка и настройка', 'Тестирование', 'Ввод в эксплуатацию', 'Обучение команды', 'Подтверждение эффекта'][taskIndex],
        owner: people[(goalIndex + projectIndex + taskIndex) % people.length],
        status: taskIndex < 2 + ((goalIndex + projectIndex) % 4) ? 'closed' : taskIndex === 3 ? 'progress' : 'open',
        start: -90 + goalIndex * 4 + projectIndex * 25 + taskIndex * 18,
        end: -55 + goalIndex * 4 + projectIndex * 25 + taskIndex * 22,
        index: taskIndex
      }));
      projectTasks.push(...tasks);
      const closed = tasks.filter((task) => task.status === 'closed').length;
      linkedProjects.push({
        id,
        name: `${projectNames[goalIndex % projectNames.length][projectIndex]}: ${shortGoal}`,
        status: 'active',
        responsibleId: owner.id,
        responsible: owner.name,
        team: [...new Set(tasks.map((task) => task.responsible))],
        startDate: tasks[0].startDatePlan,
        endDate: tasks.at(-1).endDatePlan,
        tags: [company, 'демо-проект'],
        goalId: goal.id,
        company,
        source: 'demo-goal-project',
        taskCount: tasks.length,
        closedTasks: closed,
        openTasks: tasks.length - closed,
        overdueTasks: tasks.filter((task) => task.overdue).length,
        plannedHours: round(sum(tasks, 'plannedHours')),
        actualHours: round(sum(tasks, 'actualHours')),
        closedHours: round(sum(tasks, 'closedHours')),
        income,
        expense,
        profit: income - expense,
        margin: Math.round(((income - expense) / income) * 100),
        progress: Math.round((closed / tasks.length) * 100),
        risk: tasks.some((task) => task.overdue) ? 'high' : closed / tasks.length < 0.45 ? 'medium' : 'low'
      });
    }
  });

  ['iqs', 'iqse'].forEach((company, index) => {
    const id = `demo-unlinked-${company}`;
    const owner = people[9 + index];
    const tasks = Array.from({ length: 4 + index }, (_, taskIndex) => demoProjectTask({
      id: `${id}-task-${taskIndex + 1}`, projectId: id,
      title: ['Уточнить бизнес-кейс', 'Согласовать ресурсы', 'Подготовить прототип', 'Провести пилот', 'Принять решение о масштабировании'][taskIndex],
      owner: people[(8 + taskIndex + index) % people.length],
      status: taskIndex < 2 ? 'closed' : 'progress', start: -55 + taskIndex * 16, end: -20 + taskIndex * 22, index: taskIndex
    }));
    projectTasks.push(...tasks);
    const income = 24_000_000 + index * 8_000_000;
    const expense = Math.round(income * 0.72);
    linkedProjects.push({
      id, name: index ? 'Модернизация инженерной лаборатории' : 'Корпоративный портал знаний',
      status: 'active', responsibleId: owner.id, responsible: owner.name,
      team: [...new Set(tasks.map((task) => task.responsible))], startDate: tasks[0].startDatePlan, endDate: tasks.at(-1).endDatePlan,
      tags: [company, 'демо-проект'], goalId: null, company, source: 'demo-goal-project',
      taskCount: tasks.length, closedTasks: 2, openTasks: tasks.length - 2, overdueTasks: tasks.filter((task) => task.overdue).length,
      plannedHours: round(sum(tasks, 'plannedHours')), actualHours: round(sum(tasks, 'actualHours')), closedHours: round(sum(tasks, 'closedHours')),
      income, expense, profit: income - expense, margin: 28, progress: Math.round((2 / tasks.length) * 100), risk: 'medium'
    });
  });

  data.projects.push(...linkedProjects);
  data.tasks.push(...projectTasks);
  data.assignments.push(...buildAssignments(data.users, linkedProjects, projectTasks));
}

function demoProjectTask({ id, projectId, title, owner, status, start, end, index }) {
  const closed = status === 'closed';
  const endDate = demoDate(end);
  const plannedHours = 48 + index * 12;
  const actualHours = closed ? Math.round(plannedHours * 0.92) : Math.round(plannedHours * 0.58);
  return {
    id, title, projectId, parentId: '0', responsibleId: owner.id, responsible: owner.name,
    creatorId: 'demo-strategy-user-6', creator: 'Руслан Ахметов', status,
    description: 'Демонстрационная задача проекта, связанного со стратегической целью.',
    priority: index % 3 === 0 ? '2' : '1', deadline: endDate, createdAt: demoDate(start - 7),
    closedAt: closed ? demoDate(Math.min(end - 3, -2)) : null, activityAt: demoDate(-1 - index),
    startDatePlan: demoDate(start), endDatePlan: endDate, accompliceIds: [], auditorIds: [],
    accomplices: [], auditors: [], tags: ['проект'], relatedTaskIds: [], plannedHours, actualHours,
    closedHours: closed ? actualHours : 0, overdue: !closed && new Date(endDate) < new Date(),
    deviation: actualHours - plannedHours, url: '', source: 'demo-goal-project'
  };
}

function demoInitiativeStatus(defaultStatus, goalIndex, directionIndex, initiativeIndex) {
  const patterns = [
    ['closed', 'progress', 'open', 'closed', 'progress', 'open'],
    ['closed', 'closed', 'progress', 'closed', 'progress', 'open'],
    ['closed', 'closed', 'closed', 'progress', 'progress', 'open'],
    ['closed', 'closed', 'closed', 'closed', 'progress', 'open'],
    ['closed', 'progress', 'progress', 'open', 'open', 'open']
  ];
  return patterns[goalIndex % patterns.length]?.[directionIndex * 3 + initiativeIndex] || defaultStatus;
}

function demoGoalScenario(goal, index, company) {
  const title = String(goal.name || '').toLowerCase();
  const scenarios = [
    [['Миграционная готовность клиентов', [['Провести оценку текущих SAP-ландшафтов', 'closed', 4], ['Согласовать дорожные карты перехода', 'progress', 6], ['Подготовить пакет миграционных предложений', 'closed', 2]]], ['Центр компетенций S/4HANA', [['Сертифицировать консультантов', 'progress', 3], ['Создать библиотеку типовых миграций', 'closed', 1], ['Запустить контроль качества проектов', 'open', 5]]]],
    [['Продуктовый портфель Business AI', [['Определить приоритетные AI-сценарии', 'closed', 3], ['Создать демонстрационные прототипы', 'progress', 4], ['Провести пилоты с ключевыми клиентами', 'progress', 2]]], ['Экспертиза и партнерство SAP', [['Сертифицировать AI-команду', 'closed', 1], ['Согласовать совместный go-to-market', 'progress', 6], ['Подготовить референсную архитектуру', 'open', 5]]]],
    [['Облачное предложение SAP', [['Сформировать каталог облачных сервисов', 'closed', 3], ['Рассчитать TCO для целевых сегментов', 'closed', 5], ['Запустить пакет RISE with SAP', 'progress', 2]]], ['Продвижение и продажи', [['Подготовить отраслевые кампании', 'progress', 1], ['Обучить команду продаж', 'closed', 6], ['Конвертировать пилоты в контракты', 'open', 2]]]],
    [['MES-продукт и архитектура', [['Определить MVP для производственных клиентов', 'closed', 4], ['Разработать интеграцию с ERP', 'progress', 3], ['Подготовить промышленный релиз', 'open', 6]]], ['Выход на рынок MES', [['Выбрать пилотные предприятия', 'closed', 2], ['Провести отраслевую демонстрацию', 'progress', 1], ['Получить первый коммерческий контракт', 'open', 5]]]],
    [['Инфраструктурное решение ЦОД', [['Разработать типовую архитектуру ЦОД', 'closed', 4], ['Сформировать пул поставщиков', 'progress', 6], ['Подтвердить сметную модель', 'closed', 5]]], ['Коммерциализация ЦОД', [['Подготовить предложения для трех сегментов', 'progress', 2], ['Заключить партнерские соглашения', 'closed', 1], ['Запустить первый проект', 'open', 6]]]],
    [['APC/ИИ-продукт', [['Подготовить модель оптимизации процесса', 'closed', 3], ['Интегрировать данные АСУ ТП', 'progress', 4], ['Подтвердить экономический эффект пилота', 'progress', 5]]], ['Нефтегазовый рынок', [['Выбрать пилотные установки', 'closed', 6], ['Согласовать требования промышленной безопасности', 'closed', 1], ['Масштабировать решение на клиента', 'open', 2]]]],
    [['Сертификация и документация', [['Подготовить техническое досье', 'closed', 4], ['Завершить лабораторные испытания', 'progress', 6], ['Подать комплект документов в комиссию', 'open', 1]]], ['Локализация производства', [['Утвердить локальных поставщиков', 'closed', 5], ['Организовать контроль качества', 'progress', 3], ['Подготовиться к производственному аудиту', 'progress', 6]]]],
    [['Экспортное предложение', [['Адаптировать услуги под целевые страны', 'closed', 3], ['Подготовить экспортное ценообразование', 'progress', 5], ['Локализовать коммерческие материалы', 'closed', 2]]], ['Выход на зарубежные рынки', [['Выбрать локальных партнеров', 'progress', 1], ['Провести встречи с заказчиками', 'closed', 6], ['Заключить первый экспортный контракт', 'open', 2]]]],
    [['Экономика сервисных контрактов', [['Пересчитать маржинальность портфеля', 'closed', 5], ['Обновить модели ценообразования', 'progress', 2], ['Согласовать KPI доходности', 'closed', 1]]], ['Операционная эффективность АСУ ТП', [['Сократить время реакции поддержки', 'progress', 6], ['Автоматизировать сервисную отчетность', 'closed', 4], ['Запустить допродажи по установленной базе', 'open', 2]]]]
  ];
  const matched = title.includes('s/4') ? 0
    : title.includes('business ai') ? 1
      : title.includes('облач') ? 2
        : title.includes('mes') ? 3
          : title.includes('цод') ? 4
            : title.includes('apc') || title.includes('ии для') ? 5
              : title.includes('реестр') ? 6
                : title.includes('экспорт') || title.includes('рубеж') ? 7
                  : title.includes('доходност') || title.includes('асу тп') ? 8
                    : -1;
  if (matched >= 0) return scenarios[matched];
  return company === 'iqse'
    ? [['Проектная реализация', [['Утвердить план достижения цели', 'closed', 6], ['Устранить ключевые технические риски', 'progress', 4], ['Подтвердить готовность результата', 'open', 3]]], ['Экономический эффект', [['Согласовать бюджет', 'closed', 5], ['Подтвердить эффект с заказчиком', 'progress', 2], ['Закрыть итоговые KPI', index % 2 ? 'open' : 'progress', 1]]]]
    : [['Коммерческий результат', [['Согласовать финансовую модель', 'closed', 2], ['Сформировать воронку возможностей', 'progress', 1], ['Закрепить план продаж', 'closed', 6]]], ['Продукт и масштабирование', [['Подтвердить потребности клиентов', 'closed', 3], ['Подготовить план развития решения', 'progress', 4], ['Запустить контроль KPI', 'open', 5]]]];
}

function demoStrategyTask(definition, userById) {
  const responsible = userById.get(definition.ownerId);
  const closed = definition.status === 'closed';
  const plannedHours = 32 + (definition.sequence % 5) * 12;
  const actualHours = closed ? Math.round(plannedHours * (0.82 + (definition.sequence % 3) * 0.08)) : Math.round(plannedHours * 0.55);
  const endDate = demoDate(definition.end);
  const accompliceIds = [...new Set((definition.accompliceIds || []).filter((id) => id !== definition.ownerId))];
  const auditorIds = [...new Set((definition.auditorIds || []).filter((id) => id !== definition.ownerId))];
  return {
    id: definition.id,
    title: definition.title,
    projectId: definition.projectId,
    parentId: definition.parentId || '0',
    responsibleId: definition.ownerId,
    responsible: responsible?.name || 'Не назначен',
    creatorId: 'demo-strategy-user-1',
    creator: userById.get('demo-strategy-user-1')?.name,
    status: definition.status,
    description: 'Демонстрационная стратегическая инициатива для презентации руководству.',
    priority: definition.sequence % 4 === 0 ? '2' : '1',
    deadline: endDate,
    createdAt: demoDate(definition.start - 10),
    closedAt: closed ? demoDate(Math.min(definition.end - 5, -3)) : null,
    activityAt: demoDate(-1 - (definition.sequence % 7)),
    startDatePlan: demoDate(definition.start),
    endDatePlan: endDate,
    accompliceIds,
    auditorIds,
    accomplices: accompliceIds.map((id) => userById.get(id)?.name).filter(Boolean),
    auditors: auditorIds.map((id) => userById.get(id)?.name).filter(Boolean),
    tags: ['стратегия', definition.parentId ? 'инициатива' : 'направление'],
    relatedTaskIds: definition.relatedTaskIds || [],
    plannedHours,
    actualHours,
    closedHours: closed ? actualHours : 0,
    overdue: !closed && new Date(endDate).getTime() < Date.now(),
    deviation: actualHours - plannedHours,
    url: '',
    source: 'demo-strategy'
  };
}

function demoFinanceRecord(id, projectName, amount, kind, dayOffset, article) {
  return {
    id,
    projectName,
    amount,
    signedAmount: kind === 'expense' ? -amount : amount,
    kind,
    date: demoDate(dayOffset),
    hierarchy: kind === 'income' ? 'Sales' : 'CoGS',
    article,
    type: 'Демонстрационные данные',
    dealId: null,
    source: 'demo-strategy'
  };
}

function demoDate(dayOffset) {
  return new Date(Date.now() + dayOffset * 86400000).toISOString();
}
