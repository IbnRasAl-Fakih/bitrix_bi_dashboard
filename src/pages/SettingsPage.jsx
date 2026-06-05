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

export default function SettingsPage({ status, syncNow, data }) {
  const [period, setPeriod] = useState(status.settings?.defaultPeriod || '90d');
  const [useDemoComplements, setUseDemoComplements] = useState(Boolean(status.settings?.useDemoComplements));
  const [mapping, setMapping] = useState({ ...defaultMapping, ...(status.settings?.financeMapping || {}) });
  const [check, setCheck] = useState(null);

  async function checkAccess() {
    const response = await fetch('/api/check-access');
    setCheck(await response.json());
  }

  async function save(nextDemoValue = useDemoComplements) {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultPeriod: period, useDemoComplements: nextDemoValue, financeMapping: mapping })
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
          <button className={`btn ${useDemoComplements ? 'border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200' : 'btn-primary'}`} onClick={toggleDemoComplements}>
            {useDemoComplements ? 'Отключить демонстрационные данные' : 'Добавить демонстрационные данные'}
          </button>
        </div>
        {data.meta.demoComplements && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
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
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn" onClick={checkAccess}>Проверить API-доступ</button>
              <button className="btn btn-primary" onClick={syncNow}>Запустить синхронизацию</button>
            </div>
            {check && <div className={`mt-3 rounded-lg p-3 text-sm ${check.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{check.ok ? 'API-доступ подтвержден' : check.message}</div>}
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
