import ChartCard from '../components/ChartCard.jsx';
import KpiCard from '../components/KpiCard.jsx';
import { Donut, EmployeeBars, FinanceBars, LinePanel } from '../components/charts.jsx';
import { kpiLabels } from '../utils/data.js';

export default function Dashboard({ data, setDetail }) {
  return (
    <>
      <section className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Object.entries(kpiLabels).map(([key, label]) => (
          <KpiCard key={key} metricKey={key} label={label} value={data.kpis[key]} onClick={() => setDetail({ key, label })} />
        ))}
      </section>
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Доход / расход / прибыль по проектам"
          empty={!data.charts.financeByProject.length}
          emptyText="Нет связанных финансовых данных по проектам. Настройте маппинг CRM-сделок или смарт-процесса."
        >
          <FinanceBars data={data.charts.financeByProject} />
        </ChartCard>
        <ChartCard title="Динамика закрытия задач" empty={!data.charts.taskTrend.length}>
          <LinePanel data={data.charts.taskTrend} first="closed" second="created" />
        </ChartCard>
        <ChartCard
          title="Загрузка сотрудников"
          empty={!data.charts.hoursByEmployee.length}
          emptyText="В задачах нет заполненных полей фактического времени."
        >
          <EmployeeBars data={data.charts.hoursByEmployee} />
        </ChartCard>
        <ChartCard
          title="Доля занятости по проектам"
          empty={!data.charts.occupancyShare.length}
          emptyText="В задачах нет данных о затраченном времени по проектам."
        >
          <Donut data={data.charts.occupancyShare} />
        </ChartCard>
      </section>
    </>
  );
}
