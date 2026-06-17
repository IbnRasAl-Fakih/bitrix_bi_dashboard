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
        hours: toDays(row.hours),
        closed: toDays(row.closed)
      })),
      hoursByDepartment: (data.charts.hoursByDepartment || []).map((row) => ({
        ...row,
        hours: toDays(row.hours),
        closed: toDays(row.closed)
      })),
      stackedHours: data.charts.stackedHours.map((row) => convertDynamicHours(row, data.users.map((user) => user.name))),
      occupancyShare: data.charts.occupancyShare.map((row) => ({
        ...row,
        value: toDays(row.value)
      })),
      hoursTrend: data.charts.hoursTrend.map((row) => ({
        ...row,
        hours: toDays(row.hours),
        closed: toDays(row.closed)
      })),
      assignments: data.assignments.map((row) => ({
        ...row,
        plannedHours: toDays(row.plannedHours),
        actualHours: toDays(row.actualHours),
        deviation: toDays(row.deviation)
      }))
    };
  }, [data, isDays]);

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
        <ChartCard title={`Занятость по сотрудникам в ${unitLabel}`} empty={!view.hoursByEmployee.length} emptyText="В задачах нет заполненного времени по сотрудникам.">
          <EmployeeBars data={view.hoursByEmployee} onClick={(row) => setFilters({ ...filters, employee: data.users.find((user) => user.name === row.name)?.id || '' })} />
        </ChartCard>
        <ChartCard title={`Занятость по отделам в ${unitLabel}`} empty={!view.hoursByDepartment.length}>
          <EmployeeBars data={view.hoursByDepartment} onClick={(row) => setFilters({ ...filters, department: row.name })} />
        </ChartCard>
        <ChartCard title={`Распределение занятости по проектам в ${unitLabel}`} empty={!view.stackedHours.length}>
          <Stacked data={view.stackedHours} keys={data.users.map((user) => user.name)} />
        </ChartCard>
        <ChartCard title={`Доля занятости по проектам в ${unitLabel}`} empty={!view.occupancyShare.length}>
          <Donut data={view.occupancyShare} />
        </ChartCard>
        <ChartCard title={`Динамика отработанного времени в ${unitLabel}`} empty={!view.hoursTrend.length}>
          <LinePanel data={view.hoursTrend} first="hours" firstName={isDays ? 'Дни' : 'Часы'} />
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
    acc[key] = toDays(row[key]);
    return acc;
  }, { ...row });
}

function toDays(value) {
  return Math.round((Number(value || 0) / WORK_DAY_HOURS) * 10) / 10;
}
