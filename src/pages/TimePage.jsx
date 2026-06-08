import { useMemo, useState } from 'react';
import ChartCard from '../components/ChartCard.jsx';
import DataTable from '../components/DataTable.jsx';
import Metric from '../components/Metric.jsx';
import { EmployeeBars, LinePanel } from '../components/charts.jsx';

const WORK_DAY_HOURS = 8;

export default function TimePage({ data }) {
  const [unit, setUnit] = useState('days');
  const isDays = unit === 'days';
  const unitLabel = isDays ? 'дней' : 'часов';
  const unitSuffix = isDays ? 'дн.' : 'ч';

  const view = useMemo(() => {
    if (!isDays) return {
      hoursByEmployee: data.charts.hoursByEmployee,
      hoursTrend: data.charts.hoursTrend,
      tasks: data.tasks
    };

    return {
      hoursByEmployee: data.charts.hoursByEmployee.map((row) => ({
        ...row,
        hours: toDays(row.hours),
        closed: toDays(row.closed)
      })),
      hoursTrend: data.charts.hoursTrend.map((row) => ({
        ...row,
        hours: toDays(row.hours),
        closed: toDays(row.closed)
      })),
      tasks: data.tasks.map((row) => ({
        ...row,
        plannedHours: toDays(row.plannedHours),
        actualHours: toDays(row.actualHours),
        closedHours: toDays(row.closedHours),
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
      <section className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Metric title="Недозагрузка" value={data.users.filter((user) => user.loadState === 'low').length} />
        <Metric title="Перегрузка" value={data.users.filter((user) => user.loadState === 'overload').length} />
        <Metric title="Без активности" value={data.users.filter((user) => !user.lastActivity).length} />
      </section>
      <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title={`Гистограмма ${unitLabel} по сотрудникам`} empty={!view.hoursByEmployee.length}>
          <EmployeeBars data={view.hoursByEmployee} />
        </ChartCard>
        <ChartCard title={`Динамика ${unitLabel} по датам`} empty={!view.hoursTrend.length}>
          <LinePanel data={view.hoursTrend} first="hours" firstName={isDays ? 'Дни' : 'Часы'} second="closed" />
        </ChartCard>
      </section>
      <DataTable title={`Рабочее время и закрытое время, ${unitSuffix}`} rows={view.tasks} columns={[
        ['responsible', 'Сотрудник'], ['project', 'Проект'], ['title', 'Задача'], ['plannedHours', `План, ${unitSuffix}`], ['actualHours', `Факт, ${unitSuffix}`], ['closedHours', `Закрыто, ${unitSuffix}`], ['deviation', `Отклонение, ${unitSuffix}`]
      ]} />
    </>
  );
}

function toDays(value) {
  return Math.round((Number(value || 0) / WORK_DAY_HOURS) * 10) / 10;
}
