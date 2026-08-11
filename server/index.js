import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { buildEmptyData, normalizeBitrixData } from './normalize.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 3000);
const VIBE_API_BASE = process.env.VIBE_API_BASE || 'https://vibecode.bitrix24.tech/v1';
const VIBE_API_KEY = process.env.VIBE_API_KEY || '';
const BITRIX_WEBHOOK_URL = String(process.env.BITRIX_WEBHOOK_URL || '').replace(/\/+$/, '');
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 5 * 60 * 1000);
const INSTRUCTIONS_DIR = path.join(__dirname, '..', 'storage', 'instructions');
const INSTRUCTIONS_INDEX = path.join(INSTRUCTIONS_DIR, 'index.json');
const INSTRUCTION_MAX_BYTES = Number(process.env.INSTRUCTION_MAX_BYTES || 50 * 1024 * 1024);
const ALLOWED_INSTRUCTION_TYPES = new Map([
  ['application/pdf', '.pdf']
]);
const INSTRUCTION_TYPES_BY_EXT = new Map([...ALLOWED_INSTRUCTION_TYPES].map(([type, ext]) => [ext, type]));

app.use(cors());
app.use(express.json({ limit: '70mb' }));

const state = {
  data: buildEmptyData(),
  lastSyncAt: null,
  syncStatus: 'idle',
  source: 'bitrix',
  error: null,
  logs: [],
  settings: {
    defaultPeriod: '30d',
    useDemoComplements: false,
    financeMapping: {
      projectLinkField: 'UF_CRM_PROJECT_ID',
      incomeField: 'opportunity',
      expenseField: 'UF_CRM_EXPENSE',
      smartProcessEntityTypeId: '1038',
      smartProcessTitle: 'Финансы проекта',
      smartProjectField: 'ufCrm_8_PROJECT_1C',
      smartAmountField: 'ufCrm8Amount',
      smartDateField: 'ufCrm8DocDate',
      smartHierarchyField: 'ufCrm8Hierarchy',
      smartArticleField: 'ufCrm_8_ARTICLE_1C',
      smartIncomeMarkers: ['Sales', 'Доход'],
      smartExpenseMarkers: ['CoGS', 'Расход', 'Затрат']
    },
    itsmMapping: {
      tag: '\u0437\u0430\u044f\u0432\u043a\u0430 itsm',
      smartProcessEntityTypeId: '1096',
      smartProcessTitle: 'Заявки ITSM',
      requestNumberField: 'ufAuto885369673643',
      shortDescriptionField: 'ufAuto191392845151',
      fullDescriptionField: 'ufAuto447780473544',
      requestTypeField: 'ufAuto468913797382',
      initiatorField: 'ufAuto661205472288',
      assigneeField: 'ufAuto535616254121',
      solutionField: 'ufAuto308729817905',
      registeredAtField: 'ufAuto608394397253',
      completedAtField: 'ufAuto144419585953',
      closedAtField: 'ufAuto107537441376',
      violatedField: 'ufAuto222164407847'
    },
    visibleKpis: [
      'activeProjects', 'completedProjects', 'employees', 'tasks', 'openTasks', 'closedTasks',
      'plannedHours', 'actualHours', 'closedHours', 'avgLoad', 'income', 'expense',
      'profit', 'overdueTasks', 'completionRate', 'teamLoad'
    ]
  }
};

function logSync(level, message, details = {}) {
  state.logs.unshift({
    id: randomUUID(),
    level,
    message,
    details: sanitize(details),
    at: new Date().toISOString()
  });
  state.logs = state.logs.slice(0, 80);
}

function sanitize(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value || {});
  return text.replace(/vibe_(api|app)_[A-Za-z0-9_ -]+/g, 'vibe_$1_****');
}

function maskKey(key) {
  if (!key) return 'ключ не задан';
  return `${key.slice(0, 9)}****${key.slice(-4)}`;
}

async function vibeFetch(pathname, options = {}) {
  if (!VIBE_API_KEY) throw new Error('VIBE_API_KEY не задан на сервере');
  const res = await fetch(`${VIBE_API_BASE}${pathname}`, {
    ...options,
    headers: {
      'X-Api-Key': VIBE_API_KEY,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload.success === false) {
    const message = payload?.error?.userMessage || payload?.error?.message || payload?.message || `HTTP ${res.status}`;
    const err = new Error(message);
    err.payload = payload;
    throw err;
  }
  return payload;
}

async function fetchEntity(entity, params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) query.set(key, value.join(','));
    else query.set(key, String(value));
  });
  const suffix = query.toString() ? `?${query}` : '';
  return vibeFetch(`/${entity}${suffix}`);
}

async function bitrixWebhookFetch(method, params = {}, apiV3 = false) {
  if (!BITRIX_WEBHOOK_URL) throw new Error('BITRIX_WEBHOOK_URL is not configured');
  const baseUrl = apiV3 ? BITRIX_WEBHOOK_URL.replace('/rest/', '/rest/api/') : BITRIX_WEBHOOK_URL;
  const url = new URL(`${baseUrl}/${method}${apiV3 ? '' : '.json'}`);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(params)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    const message = payload.error_description
      || payload.error?.message
      || payload.error?.code
      || payload.error
      || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload.result;
}

function workgroupTags(group) {
  const value = group?.TAGS ?? group?.tags ?? group?.KEYWORDS ?? group?.keywords ?? [];
  const values = Array.isArray(value) ? value : typeof value === 'object' ? Object.values(value) : String(value).split(',');
  return values.map((item) => String(item?.name ?? item?.NAME ?? item?.value ?? item?.VALUE ?? item).trim().toLowerCase()).filter(Boolean);
}

async function fetchTaskRelations(tasks, workgroups) {
  const goalProjectIds = new Set((workgroups || [])
    .filter((group) => workgroupTags(group).includes('цель'))
    .map((group) => String(group.ID ?? group.id ?? '')));
  const strategyTasks = (tasks || []).filter((task) => goalProjectIds.has(String(task.GROUP_ID ?? task.groupId ?? '')));
  if (!BITRIX_WEBHOOK_URL) return { available: false, source: 'unavailable', relations: {}, error: null };

  try {
    const entries = await Promise.all(strategyTasks.map(async (task) => {
      const taskId = String(task.ID ?? task.id);
      let result;
      try {
        const taskResult = await bitrixWebhookFetch('tasks.task.get', {
          id: Number(taskId),
          select: ['relatedTasks.id', 'relatedTasks.title', 'dependsOn', 'containsRelatedTasks', 'containsGanttLinks']
        }, true);
        result = [
          ...(taskResult?.item?.relatedTasks || taskResult?.relatedTasks || []),
          ...(taskResult?.item?.dependsOn || taskResult?.dependsOn || [])
        ];
      } catch {
        result = await bitrixWebhookFetch('task.item.getdependson', { TASKID: taskId });
      }
      return [taskId, relationIds(result, taskId)];
    }));
    return { available: true, source: 'bitrix-webhook', relations: Object.fromEntries(entries), error: null };
  } catch (error) {
    return { available: false, source: 'bitrix-webhook', relations: {}, error: sanitize(error.message) };
  }
}

async function fetchTaskElapsedTimes(tasks) {
  if (!BITRIX_WEBHOOK_URL) return { available: false, source: 'unavailable', elapsedTimes: {}, warnings: ['BITRIX_WEBHOOK_URL is required for task time log dates'] };
  const taskQueue = (tasks || [])
    .filter((task) => Number(task.TIME_SPENT_IN_LOGS ?? task.timeSpentInLogs ?? task.timeSpent ?? 0) > 0)
    .slice(0, 1000);
  const entries = [];

  for (let index = 0; index < taskQueue.length; index += 5) {
    const chunk = taskQueue.slice(index, index + 5);
    const chunkEntries = await Promise.allSettled(chunk.map(async (task) => {
    const taskId = String(task.ID ?? task.id ?? '');
    if (!taskId) return null;
    const result = await bitrixWebhookFetch('task.elapseditem.getlist', [
      Number(taskId),
      { ID: 'ASC' },
      {},
      ['ID', 'TASK_ID', 'SECONDS', 'MINUTES', 'CREATED_DATE', 'USER_ID']
    ]);
    const items = Array.isArray(result) ? result : result?.items || result?.data || [];
    const normalized = items.map((item) => ({
      id: String(item.ID ?? item.id ?? ''),
      taskId,
      seconds: Number(item.SECONDS ?? item.seconds ?? 0) || (Number(item.MINUTES ?? item.minutes ?? 0) || 0) * 60,
      createdAt: item.CREATED_DATE ?? item.createdDate ?? item.CREATED_DATE_FORMATTED ?? item.createdDateFormatted ?? item.CREATED_AT ?? item.createdAt ?? null,
      userId: String(item.USER_ID ?? item.userId ?? '')
    })).filter((item) => item.seconds > 0 || item.createdAt);
    return [taskId, {
      seconds: normalized.reduce((total, item) => total + item.seconds, 0),
      dates: normalized.map((item) => item.createdAt).filter(Boolean),
      items: normalized
    }];
    }));
    entries.push(...chunkEntries);
  }

  const elapsedTimes = {};
  const warnings = [];
  entries.forEach((entry) => {
    if (entry.status === 'fulfilled' && entry.value) {
      const [taskId, value] = entry.value;
      elapsedTimes[taskId] = value;
    } else if (entry.status === 'rejected') {
      warnings.push(sanitize(entry.reason?.message || entry.reason));
    }
  });
  return {
    available: warnings.length < entries.length,
    source: 'bitrix-webhook',
    elapsedTimes,
    warnings: [...new Set(warnings)].slice(0, 5)
  };
}

function relationIds(value, sourceTaskId) {
  const ids = [];
  const idKeys = new Set(['id', 'taskid', 'task_id', 'dependsonid', 'depends_on_id']);

  function visit(item, key = '') {
    if (Array.isArray(item)) return item.forEach((child) => visit(child));
    if (item && typeof item === 'object') return Object.entries(item).forEach(([childKey, child]) => visit(child, childKey));
    if ((!key || idKeys.has(key.toLowerCase())) && /^\d+$/.test(String(item || ''))) ids.push(String(item));
  }

  visit(value);
  return [...new Set(ids.filter((id) => id !== '0' && id !== String(sourceTaskId)))];
}

function mergeTaskSources(primaryTasks = [], taggedTasks = []) {
  const byId = new Map();
  primaryTasks.forEach((task) => {
    const id = String(task.ID ?? task.id ?? '');
    if (id) byId.set(id, task);
  });
  taggedTasks.forEach((task) => {
    const id = String(task.ID ?? task.id ?? '');
    if (!id) return;
    const current = byId.get(id) || {};
    const supplemental = Object.fromEntries(Object.entries(task).filter(([key]) => {
      const value = current[key];
      return value === undefined || value === null || value === '';
    }));
    byId.set(id, { ...task, ...supplemental, ...current });
  });
  return [...byId.values()];
}

async function fetchWebhookTasks() {
  if (!BITRIX_WEBHOOK_URL) return { items: [], warnings: [] };
  const warnings = [];
  const items = [];
  let start = 0;

  try {
    while (items.length < 1000 && start !== null && start !== undefined) {
      const result = await bitrixWebhookFetch('tasks.task.list', {
        order: { ID: 'DESC' },
        select: [
          'ID', 'TITLE', 'DESCRIPTION', 'TAGS', 'TAG', 'UF_*', 'GROUP_ID', 'PARENT_ID',
          'CREATED_BY', 'RESPONSIBLE_ID', 'ACCOMPLICES', 'AUDITORS', 'STATUS',
          'PRIORITY', 'DEADLINE', 'CREATED_DATE', 'CLOSED_DATE', 'ACTIVITY_DATE',
          'CHANGED_DATE', 'START_DATE_PLAN', 'END_DATE_PLAN', 'TIME_ESTIMATE',
          'TIME_SPENT_IN_LOGS', 'URL'
        ],
        start
      });
      const tasks = result?.tasks || result?.items || [];
      items.push(...tasks);
      start = Number.isFinite(Number(result?.next)) ? Number(result.next) : null;
      if (!tasks.length) break;
    }
  } catch (error) {
    warnings.push(`Bitrix task tags unavailable: ${sanitize(error.message)}`);
  }

  return { items: items.slice(0, 1000), warnings };
}

async function fetchFinanceSmartProcessItems(settings) {
  const warnings = [];
  try {
    let entityTypeId = settings.financeMapping.smartProcessEntityTypeId;

    if (!entityTypeId) {
      const processes = await fetchEntity('smart-processes', { limit: 500 });
      const process = (processes.data || []).find((item) => {
        const title = String(item.title || item.name || '').trim().toLowerCase();
        return title === String(settings.financeMapping.smartProcessTitle || '').trim().toLowerCase();
      });
      entityTypeId = process?.entityTypeId;
    }

    if (!entityTypeId) {
      warnings.push('Смарт-процесс “Финансы проекта” не найден.');
      return { items: [], entityTypeId: null, warnings };
    }

    const response = await fetchEntity(`items/${entityTypeId}`, { limit: 5000 });
    return { items: response.data || [], entityTypeId: Number(entityTypeId), warnings };
  } catch (error) {
    return { items: [], entityTypeId: null, warnings: [`Не удалось получить смарт-процесс “Финансы проекта”: ${sanitize(error.message)}`] };
  }
}

async function fetchItsmSmartProcessItems(settings) {
  const warnings = [];
  const mapping = settings.itsmMapping || {};
  try {
    const entityTypeId = mapping.smartProcessEntityTypeId || '1096';
    const [itemsResponse, fieldsResponse] = await Promise.all([
      fetchEntity(`items/${entityTypeId}`, { limit: 5000 }),
      fetchEntity(`items/${entityTypeId}/fields`).catch((error) => {
        warnings.push(`ITSM fields unavailable: ${sanitize(error.message)}`);
        return { data: null };
      })
    ]);
    return { items: itemsResponse.data || [], fields: fieldsResponse.data?.fields || fieldsResponse.data || null, entityTypeId: Number(entityTypeId), warnings };
  } catch (error) {
    return { items: [], entityTypeId: null, warnings: [`Не удалось получить смарт-таблицу "Заявки ITSM": ${sanitize(error.message)}`] };
  }
}

async function fetchDepartments() {
  const sources = await Promise.allSettled([
    fetchEntity('departments', { limit: 1000 }),
    BITRIX_WEBHOOK_URL ? bitrixWebhookFetch('department.get') : Promise.resolve([])
  ]);

  return sources.flatMap((result) => {
    if (result.status !== 'fulfilled') return [];
    const value = result.value;
    if (Array.isArray(value)) return value;
    return value?.data || value?.items || value?.departments || [];
  });
}

async function syncFromBitrix() {
  state.syncStatus = 'running';
  state.error = null;
  logSync('info', 'Запущена синхронизация данных');

  try {
    const [me, users, tasks, webhookTasks, workgroups, deals, financeSmart, departments] = await Promise.allSettled([
      vibeFetch('/me'),
      fetchEntity('users', { limit: 500 }),
      fetchEntity('tasks', { limit: 1000 }),
      fetchWebhookTasks(),
      fetchEntity('workgroups', { limit: 500 }),
      fetchEntity('deals', { limit: 1000 }),
      fetchFinanceSmartProcessItems(state.settings),
      fetchDepartments()
    ]);

    if (me.status === 'rejected') throw me.reason;

    const criticalErrors = [users, tasks, workgroups]
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason.message);
    const warnings = [webhookTasks, deals, financeSmart, departments]
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason.message);

    if (financeSmart.status === 'fulfilled') {
      warnings.push(...financeSmart.value.warnings);
    }
    if (webhookTasks.status === 'fulfilled') {
      warnings.push(...webhookTasks.value.warnings);
    }
    const mergedTasks = mergeTaskSources(
      tasks.status === 'fulfilled' ? tasks.value.data || [] : [],
      webhookTasks.status === 'fulfilled' ? webhookTasks.value.items || [] : []
    );

    const raw = {
      me: me.value.data,
      users: users.status === 'fulfilled' ? users.value.data || [] : [],
      tasks: mergedTasks,
      workgroups: workgroups.status === 'fulfilled' ? workgroups.value.data || [] : [],
      deals: deals.status === 'fulfilled' ? deals.value.data || [] : [],
      financeItems: financeSmart.status === 'fulfilled' ? financeSmart.value.items || [] : [],
      financeEntityTypeId: financeSmart.status === 'fulfilled' ? financeSmart.value.entityTypeId : null,
      departments: departments.status === 'fulfilled' ? departments.value || [] : [],
      errors: [...criticalErrors, ...warnings]
    };

    const [taskRelations, taskElapsedTimes] = await Promise.all([
      fetchTaskRelations(raw.tasks, raw.workgroups),
      fetchTaskElapsedTimes(raw.tasks)
    ]);
    raw.taskRelations = taskRelations;
    raw.taskElapsedTimes = taskElapsedTimes.elapsedTimes;
    if (taskElapsedTimes.warnings?.length) warnings.push(...taskElapsedTimes.warnings.map((message) => `Task time logs unavailable: ${message}`));
    const data = normalizeBitrixData(raw, state.settings);
    state.data = data;
    state.lastSyncAt = new Date().toISOString();
    state.syncStatus = criticalErrors.length ? 'partial' : 'success';
    state.source = 'bitrix';

    if (criticalErrors.length) logSync('warn', 'Часть основных сущностей Bitrix24 недоступна. Данные по ним не отображаются.', criticalErrors);
    if (warnings.length) logSync('warn', 'Часть дополнительных источников Bitrix24 недоступна или пуста.', warnings);
    if (!data.meta.realRecords) logSync('warn', 'Синхронизация прошла, но доступных данных не найдено');
    logSync('success', 'Синхронизация завершена', { records: data.meta.realRecords });
    return data;
  } catch (error) {
    state.syncStatus = 'error';
    state.error = 'Не удалось получить данные из Bitrix24. Проверьте API-ключ, права доступа и доступность VibeCode API.';
    state.source = 'bitrix';
    state.data = buildEmptyData([state.error, sanitize(error.message)]);
    state.lastSyncAt = new Date().toISOString();
    logSync('error', state.error, error.payload || error.message);
    return state.data;
  }
}

function ensureData() {
  const expired = !state.lastSyncAt || Date.now() - new Date(state.lastSyncAt).getTime() > CACHE_TTL_MS;
  if (!state.data || expired) return syncFromBitrix();
  return Promise.resolve(state.data);
}

async function ensureInstructionsStore() {
  await fs.mkdir(INSTRUCTIONS_DIR, { recursive: true });
  try {
    await fs.access(INSTRUCTIONS_INDEX);
  } catch {
    await fs.writeFile(INSTRUCTIONS_INDEX, '[]', 'utf8');
  }
}

async function readInstructions() {
  await ensureInstructionsStore();
  const text = await fs.readFile(INSTRUCTIONS_INDEX, 'utf8');
  const rows = JSON.parse(text || '[]');
  return Array.isArray(rows) ? rows : [];
}

async function writeInstructions(rows) {
  await ensureInstructionsStore();
  await fs.writeFile(INSTRUCTIONS_INDEX, JSON.stringify(rows, null, 2), 'utf8');
}

function instructionFilename(name = 'instruction') {
  return String(name)
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 120) || 'instruction';
}

function contentDisposition(type, filename) {
  const fallback = instructionFilename(filename).replace(/"/g, '');
  const encoded = encodeURIComponent(filename).replace(/['()]/g, escape);
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

async function sendInstructionFile(req, res, disposition) {
  const rows = await readInstructions();
  const item = rows.find((row) => row.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Файл не найден' });

  const filePath = path.join(INSTRUCTIONS_DIR, item.storedName);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(INSTRUCTIONS_DIR))) {
    return res.status(400).json({ error: 'Некорректный путь файла' });
  }

  res.setHeader('Content-Type', item.mimeType);
  res.setHeader('Content-Disposition', contentDisposition(disposition, item.originalName));
  res.sendFile(resolved);
}

app.get('/api/status', (req, res) => {
  res.json({
    status: state.syncStatus,
    source: state.source,
    lastSyncAt: state.lastSyncAt,
    error: state.error,
    maskedKey: maskKey(VIBE_API_KEY),
    hasKey: Boolean(VIBE_API_KEY),
    settings: state.settings,
    logs: state.logs.slice(0, 20)
  });
});

app.get('/api/data', async (req, res) => {
  try {
    const data = await ensureData();
    res.json({ data, status: state.syncStatus, source: state.source, lastSyncAt: state.lastSyncAt, error: state.error, settings: state.settings });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка загрузки аналитики', message: sanitize(error.message), data: buildEmptyData([sanitize(error.message)]) });
  }
});

app.post('/api/sync', async (req, res) => {
  const data = await syncFromBitrix();
  res.json({ data, status: state.syncStatus, source: state.source, lastSyncAt: state.lastSyncAt, error: state.error, logs: state.logs.slice(0, 20), settings: state.settings });
});

app.post('/api/settings', (req, res) => {
  state.settings = { ...state.settings, ...req.body };
  state.data = null;
  logSync('info', 'Настройки обновлены. Запустите синхронизацию, чтобы применить маппинг.');
  res.json({ settings: state.settings });
});

app.get('/api/instructions', async (req, res) => {
  try {
    const rows = await readInstructions();
    res.json({ files: rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
  } catch (error) {
    res.status(500).json({ error: 'Не удалось получить список файлов', message: sanitize(error.message) });
  }
});

app.post('/api/instructions', async (req, res) => {
  try {
    const { name, mimeType, content } = req.body || {};
    if (!name || !content) {
      return res.status(400).json({ error: 'Передайте файл для загрузки' });
    }
    const sourceExt = path.extname(name).toLowerCase();
    const resolvedMimeType = ALLOWED_INSTRUCTION_TYPES.has(mimeType) ? mimeType : INSTRUCTION_TYPES_BY_EXT.get(sourceExt);
    if (!resolvedMimeType) {
      return res.status(400).json({ error: 'Поддерживаются только PDF-файлы' });
    }

    const buffer = Buffer.from(String(content), 'base64');
    if (!buffer.length || buffer.length > INSTRUCTION_MAX_BYTES) {
      return res.status(400).json({ error: `Размер файла должен быть до ${Math.round(INSTRUCTION_MAX_BYTES / 1024 / 1024)} МБ` });
    }

    const expectedExt = ALLOWED_INSTRUCTION_TYPES.get(resolvedMimeType);
    if (sourceExt !== expectedExt) {
      return res.status(400).json({ error: `Расширение файла должно быть ${expectedExt}` });
    }

    const id = randomUUID();
    const storedName = `${id}${expectedExt}`;
    await ensureInstructionsStore();
    await fs.writeFile(path.join(INSTRUCTIONS_DIR, storedName), buffer);

    const rows = await readInstructions();
    await Promise.all(rows.map((row) => fs.rm(path.join(INSTRUCTIONS_DIR, row.storedName), { force: true })));
    const file = {
      id,
      originalName: path.basename(name),
      storedName,
      mimeType: resolvedMimeType,
      size: buffer.length,
      createdAt: new Date().toISOString()
    };
    await writeInstructions([file]);
    res.status(201).json({ file });
  } catch (error) {
    res.status(500).json({ error: 'Не удалось загрузить файл', message: sanitize(error.message) });
  }
});

app.get('/api/instructions/:id/view', (req, res) => {
  sendInstructionFile(req, res, 'inline').catch((error) => {
    res.status(500).json({ error: 'Не удалось открыть файл', message: sanitize(error.message) });
  });
});

app.get('/api/instructions/:id/download', (req, res) => {
  sendInstructionFile(req, res, 'attachment').catch((error) => {
    res.status(500).json({ error: 'Не удалось скачать файл', message: sanitize(error.message) });
  });
});

app.delete('/api/instructions/:id', async (req, res) => {
  try {
    const rows = await readInstructions();
    const item = rows.find((row) => row.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Файл не найден' });
    await fs.rm(path.join(INSTRUCTIONS_DIR, item.storedName), { force: true });
    await writeInstructions(rows.filter((row) => row.id !== req.params.id));
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Не удалось удалить файл', message: sanitize(error.message) });
  }
});

app.get('/api/check-access', async (req, res) => {
  try {
    const me = await vibeFetch('/me');
    res.json({ ok: true, maskedKey: maskKey(VIBE_API_KEY), data: me.data });
  } catch (error) {
    res.status(200).json({ ok: false, maskedKey: maskKey(VIBE_API_KEY), message: sanitize(error.message) });
  }
});

app.use(express.static(path.join(__dirname, '..', 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`BI dashboard listening on ${PORT}`);
  syncFromBitrix().catch((error) => logSync('error', 'Первичная синхронизация не выполнена', error.message));
});
