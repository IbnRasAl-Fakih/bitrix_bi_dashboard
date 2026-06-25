import { useState } from 'react';
import SourceBadge from '../components/SourceBadge.jsx';
import Dropdown from '../components/Dropdown.jsx';

const defaultMapping = {
  projectLinkField: 'UF_CRM_PROJECT_ID',
  incomeField: 'opportunity',
  expenseField: 'UF_CRM_EXPENSE',
  smartProcessEntityTypeId: '1038',
  smartProcessTitle: 'Финансы проекта',
  smartProjectField: 'ufCrm_8_PROJECT_1C',
  smartAmountField: 'ufCrm8Amount',
  smartDateField: 'ufCrm8DocDate',
  smartHierarchyField: 'ufCrm8Hierarchy',
  smartArticleField: 'ufCrm_8_ARTICLE_1C'
};

const defaultItsmMapping = {
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
};

export default function SettingsPage({ status, syncNow, data }) {
  const [period, setPeriod] = useState(status.settings?.defaultPeriod || '90d');
  const [useDemoComplements, setUseDemoComplements] = useState(Boolean(status.settings?.useDemoComplements));
  const [mapping, setMapping] = useState({ ...defaultMapping, ...(status.settings?.financeMapping || {}) });
  const [itsmMapping, setItsmMapping] = useState({ ...defaultItsmMapping, ...(status.settings?.itsmMapping || {}) });
  const [check, setCheck] = useState(null);

  async function checkAccess() {
    const response = await fetch('/api/check-access');
    setCheck(await response.json());
  }

  async function save(nextDemoValue = useDemoComplements) {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultPeriod: period, useDemoComplements: nextDemoValue, financeMapping: mapping, itsmMapping })
    });
    await syncNow();
  }

  async function toggleDemoComplements() {
    const next = !useDemoComplements;
    setUseDemoComplements(next);
    await save(next);
  }

  return (
    <div className="grid gap-4">
      <section className="panel p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-bold">Демонстрационные дополнения</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
              Реальные данные остаются основой. Если включить режим, система добавит недостающие часы, ряды графиков и финансовые значения только для демонстрации возможностей дашбордов.
            </p>
          </div>
          <button className={`btn ${useDemoComplements ? 'border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100 dark:hover:bg-amber-900/60' : 'btn-primary'}`} onClick={toggleDemoComplements}>
            {useDemoComplements ? 'Отключить демонстрационные данные' : 'Добавить демонстрационные данные'}
          </button>
        </div>
        {data.meta.demoComplements && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            Сейчас включены демонстрационные дополнения. Такие значения используются только для показа интерфейса и не являются данными Bitrix24.
          </div>
        )}
      </section>

      <section className="panel p-5">
        <div className="grid gap-6 xl:grid-cols-2">
          <div>
            <h2 className="mb-4 text-lg font-bold">Подключение</h2>
            <div className="grid gap-2 text-sm text-slate-600 dark:text-slate-300">
              <p>Ключ: {status.maskedKey || 'не задан'}</p>
              <p>Источник данных: <SourceBadge source={status.source || data.meta.source} /></p>
              <p>Последняя синхронизация: {status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString('ru-RU') : 'нет'}</p>
              <p>Смарт-процесс финансов: {data.meta.financeSmartProcess?.entityTypeId || mapping.smartProcessEntityTypeId || 'не найден'}</p>
              <p>Финансовых строк: {data.meta.financeSmartProcess?.records ?? 0}</p>
              <p>ITSM: задачи с тегом {data.meta.itsmSmartProcess?.tag || itsmMapping.tag || '\u0437\u0430\u044f\u0432\u043a\u0430 itsm'}</p>
              <p>Заявок ITSM: {data.meta.itsmSmartProcess?.records ?? 0}</p>
              <p>Связанные задачи: {data.meta.taskRelations?.available ? `${data.meta.taskRelations.count} связей получено` : 'нужен BITRIX_WEBHOOK_URL'}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn" onClick={checkAccess}>Проверить API-доступ</button>
              <button className="btn btn-primary" onClick={syncNow}>Запустить синхронизацию</button>
            </div>
            {check && <div className={`mt-3 rounded-lg p-3 text-sm ${check.ok ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200'}`}>{check.ok ? 'API-доступ подтвержден' : check.message}</div>}
          </div>
          <div>
            <h2 className="mb-4 text-lg font-bold">Маппинг финансов</h2>
            <label className="mb-3 grid gap-1 text-sm text-slate-500">
              Период по умолчанию
              <Dropdown value={period} onChange={setPeriod} options={[['30d', '30 дней'], ['90d', '90 дней'], ['year', 'Год']]} placeholder="Выберите период" className="w-fit" searchable={false} />
            </label>
            <SettingsInput label="Название смарт-процесса" value={mapping.smartProcessTitle} onChange={(value) => setMapping({ ...mapping, smartProcessTitle: value })} />
            <SettingsInput label="ID смарт-процесса" value={mapping.smartProcessEntityTypeId} onChange={(value) => setMapping({ ...mapping, smartProcessEntityTypeId: value })} />
            <SettingsInput label="Поле проекта в финансах" value={mapping.smartProjectField} onChange={(value) => setMapping({ ...mapping, smartProjectField: value })} />
            <SettingsInput label="Поле суммы" value={mapping.smartAmountField} onChange={(value) => setMapping({ ...mapping, smartAmountField: value })} />
            <SettingsInput label="Поле даты" value={mapping.smartDateField} onChange={(value) => setMapping({ ...mapping, smartDateField: value })} />
            <SettingsInput label="Поле иерархии / типа ДДС" value={mapping.smartHierarchyField} onChange={(value) => setMapping({ ...mapping, smartHierarchyField: value })} />
            <SettingsInput label="Поле статьи расходов/доходов" value={mapping.smartArticleField} onChange={(value) => setMapping({ ...mapping, smartArticleField: value })} />
            <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
              <h3 className="mb-3 text-base font-bold">Заявки ITSM</h3>
              <SettingsInput label="Тег ITSM-задачи" value={itsmMapping.tag} onChange={(value) => setItsmMapping({ ...itsmMapping, tag: value })} />
              <SettingsInput label="Название смарт-таблицы ITSM" value={itsmMapping.smartProcessTitle} onChange={(value) => setItsmMapping({ ...itsmMapping, smartProcessTitle: value })} />
              <SettingsInput label="ID смарт-таблицы ITSM" value={itsmMapping.smartProcessEntityTypeId} onChange={(value) => setItsmMapping({ ...itsmMapping, smartProcessEntityTypeId: value })} />
              <SettingsInput label="Поле номера заявки" value={itsmMapping.requestNumberField} onChange={(value) => setItsmMapping({ ...itsmMapping, requestNumberField: value })} />
              <SettingsInput label="Поле краткого описания" value={itsmMapping.shortDescriptionField} onChange={(value) => setItsmMapping({ ...itsmMapping, shortDescriptionField: value })} />
              <SettingsInput label="Поле полного описания" value={itsmMapping.fullDescriptionField} onChange={(value) => setItsmMapping({ ...itsmMapping, fullDescriptionField: value })} />
              <SettingsInput label="Поле типа заявки" value={itsmMapping.requestTypeField} onChange={(value) => setItsmMapping({ ...itsmMapping, requestTypeField: value })} />
              <SettingsInput label="Поле инициатора" value={itsmMapping.initiatorField} onChange={(value) => setItsmMapping({ ...itsmMapping, initiatorField: value })} />
              <SettingsInput label="Поле исполнителя" value={itsmMapping.assigneeField} onChange={(value) => setItsmMapping({ ...itsmMapping, assigneeField: value })} />
              <SettingsInput label="Поле решения" value={itsmMapping.solutionField} onChange={(value) => setItsmMapping({ ...itsmMapping, solutionField: value })} />
              <SettingsInput label="Поле даты регистрации" value={itsmMapping.registeredAtField} onChange={(value) => setItsmMapping({ ...itsmMapping, registeredAtField: value })} />
              <SettingsInput label="Поле даты выполнения" value={itsmMapping.completedAtField} onChange={(value) => setItsmMapping({ ...itsmMapping, completedAtField: value })} />
              <SettingsInput label="Поле даты закрытия" value={itsmMapping.closedAtField} onChange={(value) => setItsmMapping({ ...itsmMapping, closedAtField: value })} />
              <SettingsInput label="Поле нарушения" value={itsmMapping.violatedField} onChange={(value) => setItsmMapping({ ...itsmMapping, violatedField: value })} />
            </div>
            <button className="btn btn-primary mt-2" onClick={() => save()}>Сохранить настройки</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function SettingsInput({ label, value, onChange }) {
  return (
    <label className="mb-3 grid gap-1 text-sm text-slate-500">
      {label}
      <input className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" value={value || ''} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
