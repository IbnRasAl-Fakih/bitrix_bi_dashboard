import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
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

app.use(cors());
app.use(express.json({ limit: '2mb' }));

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
    strategyProjectId: process.env.STRATEGY_PROJECT_ID || '38',
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
  if (!response.ok || payload.error) throw new Error(payload.error_description || payload.error || `HTTP ${response.status}`);
  return payload.result;
}

async function fetchTaskRelations(tasks, strategyProjectId) {
  const strategyTasks = (tasks || []).filter((task) => String(task.GROUP_ID ?? task.groupId ?? '') === String(strategyProjectId || ''));
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

async function syncFromBitrix() {
  state.syncStatus = 'running';
  state.error = null;
  logSync('info', 'Запущена синхронизация данных');

  try {
    const [me, users, tasks, workgroups, deals, financeSmart] = await Promise.allSettled([
      vibeFetch('/me'),
      fetchEntity('users', { limit: 500 }),
      fetchEntity('tasks', { limit: 1000 }),
      fetchEntity('workgroups', { limit: 500 }),
      fetchEntity('deals', { limit: 1000 }),
      fetchFinanceSmartProcessItems(state.settings)
    ]);

    if (me.status === 'rejected') throw me.reason;

    const errors = [users, tasks, workgroups, deals, financeSmart]
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason.message);

    if (financeSmart.status === 'fulfilled') {
      errors.push(...financeSmart.value.warnings);
    }

    const raw = {
      me: me.value.data,
      users: users.status === 'fulfilled' ? users.value.data || [] : [],
      tasks: tasks.status === 'fulfilled' ? tasks.value.data || [] : [],
      workgroups: workgroups.status === 'fulfilled' ? workgroups.value.data || [] : [],
      deals: deals.status === 'fulfilled' ? deals.value.data || [] : [],
      financeItems: financeSmart.status === 'fulfilled' ? financeSmart.value.items || [] : [],
      financeEntityTypeId: financeSmart.status === 'fulfilled' ? financeSmart.value.entityTypeId : null,
      errors
    };

    raw.taskRelations = await fetchTaskRelations(raw.tasks, state.settings.strategyProjectId);
    const data = normalizeBitrixData(raw, state.settings);
    state.data = data;
    state.lastSyncAt = new Date().toISOString();
    state.syncStatus = errors.length ? 'partial' : 'success';
    state.source = 'bitrix';

    if (errors.length) logSync('warn', 'Часть сущностей Bitrix24 недоступна. Данные по ним не отображаются.', errors);
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
