import { useMemo, useState } from 'react';
import ChartCard from '../components/ChartCard.jsx';
import DataTable from '../components/DataTable.jsx';
import { Matrix } from '../components/ProjectWidgets.jsx';
import { Donut, EmployeeBars, LinePanel, Stacked } from '../components/charts.jsx';

const WORK_DAY_HOURS = 8;

export default function Occupancy({ data, filters, setFilters }) {
  const [unit, setUnit] = useState('days');
  const isDays = unit === 'days';
  const unitLabel = isDays ? 'днях' : 'часах';
  const unitSuffix = isDays ? 'дн.' : 'ч';
  const factLabel = isDays ? 'Факт, дн.' : 'Факт, ч';

  const view = useMemo(() => {
    if (!isDays) return {
      hoursByEmployee: data.charts.hoursByEmployee,
      hoursByDepartment: data.charts.hoursByDepartment || [],
      stackedHours: data.charts.stackedHours,
      occupancyShare: data.charts.occupancyShare,
      hoursTrend: data.charts.hoursTrend,
      assignments: data.assignments
    };

    return {
      hoursByEmployee: data.charts.hoursByEmployee.map((row) => ({
        ...row,
        hours: toMetricDays(row.hours, row),
        closed: toMetricDays(row.closed, row)
      })),
      hoursByDepartment: (data.charts.hoursByDepartment || []).map((row) => ({
        ...row,
        hours: toMetricDays(row.hours, row),
        closed: toMetricDays(row.closed, row)
      })),
      stackedHours: data.charts.stackedHours.map((row) => convertDynamicHours(row, data.users.map((user) => user.name))),
      occupancyShare: data.charts.occupancyShare.map((row) => ({
        ...row,
        value: toMetricDays(row.value, row)
      })),
      hoursTrend: data.charts.hoursTrend.map((row) => ({
        ...row,
        hours: toMetricDays(row.hours, row),
        closed: toMetricDays(row.closed, row)
      })),
      assignments: data.assignments.map((row) => ({
        ...row,
        plannedHours: toDays(row.plannedHours),
        actualHours: toDays(row.actualHours),
        deviation: toDays(row.deviation)
      }))
    };
  }, [data, isDays]);
  const trendMetricName = view.hoursTrend.find((row) => row.metricName)?.metricName;
  const chartMetricName = view.hoursByEmployee.find((row) => row.metricName)?.metricName;
  const chartValueName = chartMetricName || factLabel;
  const chartUnitSuffix = chartMetricName ? chartMetricName.toLowerCase() : unitSuffix;

  return (
    <>
      <div className="mb-4 flex justify-end">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <button
            className={`rounded-md px-3 py-1.5 font-semibold ${isDays ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
            type="button"
            onClick={() => setUnit('days')}
          >
            Дни
          </button>
          <button
            className={`rounded-md px-3 py-1.5 font-semibold ${!isDays ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
            type="button"
            onClick={() => setUnit('hours')}
          >
            Часы
          </button>
        </div>
      </div>
      <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title={`Фактические трудозатраты по сотрудникам, ${chartUnitSuffix}`} empty={!view.hoursByEmployee.length} emptyText="В задачах нет заполненного времени по сотрудникам.">
          <EmployeeBars data={view.hoursByEmployee} valueName={chartValueName} onClick={(row) => setFilters({ ...filters, employee: data.users.find((user) => user.name === row.name)?.id || '' })} />
        </ChartCard>
        <ChartCard title={`Фактические трудозатраты по отделам, ${chartUnitSuffix}`} empty={!view.hoursByDepartment.length}>
          <EmployeeBars data={view.hoursByDepartment} valueName={chartValueName} onClick={(row) => setFilters({ ...filters, department: row.name })} />
        </ChartCard>
        <ChartCard title={`Факт по проектам в разрезе сотрудников, ${chartUnitSuffix}`} empty={!view.stackedHours.length}>
          <Stacked data={view.stackedHours} keys={data.users.map((user) => user.name)} />
        </ChartCard>
        <ChartCard title={`Доля фактических трудозатрат по проектам, ${chartUnitSuffix}`} empty={!view.occupancyShare.length}>
          <Donut data={view.occupancyShare} valueName={chartValueName} />
        </ChartCard>
        <ChartCard title={`Динамика фактических трудозатрат, ${chartUnitSuffix}`} empty={!view.hoursTrend.length}>
          <LinePanel data={view.hoursTrend} first="hours" firstName={trendMetricName || chartValueName} />
        </ChartCard>
      </section>
      <Matrix rows={view.assignments} unit={unit} />
      <DataTable title={`Занятость сотрудников по проектам, ${unitSuffix}`} rows={view.assignments} columns={[
        ['employee', 'Сотрудник'], ['department', 'Отдел'], ['project', 'Проект'], ['plannedHours', `План, ${unitSuffix}`], ['actualHours', `Факт, ${unitSuffix}`],
        ['deviation', `Отклонение, ${unitSuffix}`], ['load', 'Загрузка, %'], ['taskCount', 'Задач'], ['openTasks', 'Открыто'], ['overdueTasks', 'Просрочено']
      ]} />
    </>
  );
}

function convertDynamicHours(row, keys) {
  return keys.reduce((acc, key) => {
    acc[key] = row.metricKind === 'tasks' ? row[key] : toDays(row[key]);
    return acc;
  }, { ...row });
}

function toDays(value) {
  return Math.round((Number(value || 0) / WORK_DAY_HOURS) * 10) / 10;
}

function toMetricDays(value, row) {
  return row.metricKind === 'tasks' ? value : toDays(value);
}
