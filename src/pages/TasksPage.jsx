import { useMemo, useState } from 'react';
import ChartCard from '../components/ChartCard.jsx';
import DataTable from '../components/DataTable.jsx';
import Metric from '../components/Metric.jsx';
import { BarSimple, LinePanel } from '../components/charts.jsx';
import { groupCount } from '../utils/data.js';

const WORK_DAY_HOURS = 8;

export default function TasksPage({ data }) {
  const [unit, setUnit] = useState('days');
  const isDays = unit === 'days';
  const unitSuffix = isDays ? 'дн.' : 'ч';
  const tasks = useMemo(() => {
    if (!isDays) return data.tasks;

    return data.tasks.map((task) => ({
      ...task,
      plannedHours: toDays(task.plannedHours),
      actualHours: toDays(task.actualHours)
    }));
  }, [data.tasks, isDays]);

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
        <Metric title="В работе" value={data.tasks.filter((task) => task.status === 'progress').length} />
        <Metric title="Без дедлайна" value={data.tasks.filter((task) => !task.deadline).length} />
        <Metric title="Без ответственного" value={data.tasks.filter((task) => !task.responsibleId).length} />
      </section>
      <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Распределение задач по проектам" empty={!data.tasks.length}><BarSimple data={groupCount(data.tasks, 'project')} valueName="Количество задач" /></ChartCard>
        <ChartCard title="Динамика закрытия задач" empty={!data.charts.taskTrend.length}><LinePanel data={data.charts.taskTrend} first="closed" second="created" /></ChartCard>
      </section>
      <DataTable title={`Задачи, ${unitSuffix}`} rows={tasks} columns={[
        ['title', 'Название'], ['project', 'Проект'], ['responsible', 'Ответственный'], ['creator', 'Постановщик'], ['status', 'Статус'],
        ['deadline', 'Дедлайн'], ['createdAt', 'Создана'], ['closedAt', 'Выполнена'], ['lastTimeLogAt', 'Дата факта'], ['plannedHours', `План, ${unitSuffix}`], ['actualHours', `Факт, ${unitSuffix}`], ['overdue', 'Просрочка'], ['url', 'Ссылка']
      ]} />
    </>
  );
}

function toDays(value) {
  return Math.round((Number(value || 0) / WORK_DAY_HOURS) * 10) / 10;
}
