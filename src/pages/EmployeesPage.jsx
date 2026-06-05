import ChartCard from '../components/ChartCard.jsx';
import DataTable from '../components/DataTable.jsx';
import { BarSimple } from '../components/charts.jsx';

export default function EmployeesPage({ data }) {
  return (
    <>
      <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Рейтинг по закрытым задачам" empty={!data.users.length}><BarSimple data={data.users.map((user) => ({ name: user.name, value: user.closedTasks }))} /></ChartCard>
        <ChartCard title="Рейтинг по эффективности" empty={!data.users.length}><BarSimple data={data.users.map((user) => ({ name: user.name, value: user.efficiency }))} /></ChartCard>
      </section>
      <DataTable title="Сотрудники" rows={data.users} columns={[
        ['name', 'ФИО'], ['position', 'Должность'], ['department', 'Отдел'], ['projects', 'Проектов'], ['tasks', 'Задач'],
        ['closedTasks', 'Закрыто задач'], ['overdueTasks', 'Просрочки'], ['plannedHours', 'План'], ['actualHours', 'Факт'], ['closedHours', 'Закрыто часов'], ['load', 'Загрузка, %'], ['efficiency', 'Эффективность'], ['lastActivity', 'Последняя активность']
      ]} />
    </>
  );
}
