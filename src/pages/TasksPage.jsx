import ChartCard from '../components/ChartCard.jsx';
import DataTable from '../components/DataTable.jsx';
import Metric from '../components/Metric.jsx';
import { BarSimple, LinePanel } from '../components/charts.jsx';
import { groupCount } from '../utils/data.js';

export default function TasksPage({ data }) {
  return (
    <>
      <section className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Metric title="В работе" value={data.tasks.filter((task) => task.status === 'progress').length} />
        <Metric title="Без дедлайна" value={data.tasks.filter((task) => !task.deadline).length} />
        <Metric title="Без ответственного" value={data.tasks.filter((task) => !task.responsibleId).length} />
      </section>
      <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Распределение задач по проектам" empty={!data.tasks.length}><BarSimple data={groupCount(data.tasks, 'project')} /></ChartCard>
        <ChartCard title="Динамика закрытия задач" empty={!data.charts.taskTrend.length}><LinePanel data={data.charts.taskTrend} first="closed" second="created" /></ChartCard>
      </section>
      <DataTable title="Задачи" rows={data.tasks} columns={[
        ['title', 'Название'], ['project', 'Проект'], ['responsible', 'Ответственный'], ['creator', 'Постановщик'], ['status', 'Статус'],
        ['deadline', 'Дедлайн'], ['createdAt', 'Создана'], ['closedAt', 'Закрыта'], ['plannedHours', 'План'], ['actualHours', 'Факт'], ['overdue', 'Просрочка'], ['url', 'Ссылка']
      ]} />
    </>
  );
}
