import ChartCard from '../components/ChartCard.jsx';
import DataTable from '../components/DataTable.jsx';
import Metric from '../components/Metric.jsx';
import { EmployeeBars, LinePanel } from '../components/charts.jsx';

export default function TimePage({ data }) {
  return (
    <>
      <section className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Metric title="Недозагрузка" value={data.users.filter((user) => user.loadState === 'low').length} />
        <Metric title="Перегрузка" value={data.users.filter((user) => user.loadState === 'overload').length} />
        <Metric title="Без активности" value={data.users.filter((user) => !user.lastActivity).length} />
      </section>
      <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Гистограмма часов по сотрудникам" empty={!data.charts.hoursByEmployee.length}><EmployeeBars data={data.charts.hoursByEmployee} /></ChartCard>
        <ChartCard title="Динамика часов по датам" empty={!data.charts.hoursTrend.length}><LinePanel data={data.charts.hoursTrend} first="hours" second="closed" /></ChartCard>
      </section>
      <DataTable title="Рабочее время и закрытые часы" rows={data.tasks} columns={[
        ['responsible', 'Сотрудник'], ['project', 'Проект'], ['title', 'Задача'], ['plannedHours', 'План'], ['actualHours', 'Факт'], ['closedHours', 'Закрыто'], ['deviation', 'Отклонение']
      ]} />
    </>
  );
}
