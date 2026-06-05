import ChartCard from '../components/ChartCard.jsx';
import DataTable from '../components/DataTable.jsx';
import { Donut, FinanceBars, LinePanel } from '../components/charts.jsx';

export default function FinancePage({ data }) {
  return (
    <>
      <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Доход / расход / прибыль" empty={!data.charts.financeByProject.length} emptyText="Нет связанных финансовых данных по проектам."><FinanceBars data={data.charts.financeByProject} /></ChartCard>
        <ChartCard title="Динамика финансов по месяцам" empty={!data.charts.financeTrend.length} emptyText="Bitrix24 API не вернул помесячную финансовую динамику. Она не рассчитывается искусственно."><LinePanel data={data.charts.financeTrend} first="income" second="expense" third="profit" /></ChartCard>
        <ChartCard title="Структура расходов" empty={!data.charts.expenseStructure.length} emptyText="Поле расходов не найдено или не заполнено."><Donut data={data.charts.expenseStructure} /></ChartCard>
        <ChartCard title="Самые прибыльные проекты" empty={!data.charts.financeByProject.some((row) => row.profit)} emptyText="Прибыль рассчитывается только при наличии дохода и расхода."><FinanceBars data={[...data.charts.financeByProject].filter((row) => row.profit).sort((a, b) => b.profit - a.profit).slice(0, 5)} /></ChartCard>
      </section>
      <DataTable title="Финансовые показатели по проектам" rows={data.projects} columns={[
        ['name', 'Проект'], ['income', 'Доход'], ['expense', 'Расход'], ['profit', 'Прибыль'], ['margin', 'Маржинальность, %'], ['risk', 'Риск']
      ]} />
    </>
  );
}
