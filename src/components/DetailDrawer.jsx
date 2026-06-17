import { X } from '../icons/index.jsx';
import DataTable from './DataTable.jsx';

const projectColumns = [
  ['name', 'Проект'],
  ['responsible', 'Ответственный'],
  ['status', 'Статус'],
  ['taskCount', 'Задач'],
  ['overdueTasks', 'Просрочено'],
  ['plannedHours', 'План'],
  ['actualHours', 'Факт'],
  ['income', 'Доход'],
  ['expense', 'Расход'],
  ['profit', 'Прибыль']
];

const taskColumns = [
  ['title', 'Задача'],
  ['project', 'Проект'],
  ['responsible', 'Ответственный'],
  ['status', 'Статус'],
  ['deadline', 'Дедлайн'],
  ['plannedHours', 'План'],
  ['actualHours', 'Факт']
];

const userColumns = [
  ['name', 'Сотрудник'],
  ['position', 'Должность'],
  ['department', 'Отдел'],
  ['projects', 'Проектов'],
  ['tasks', 'Задач'],
  ['overdueTasks', 'Просрочено'],
  ['load', 'Загрузка, %'],
  ['efficiency', 'Эффективность']
];

const assignmentColumns = [
  ['employee', 'Сотрудник'],
  ['project', 'Проект'],
  ['department', 'Отдел'],
  ['plannedHours', 'План'],
  ['actualHours', 'Факт'],
  ['deviation', 'Отклонение'],
  ['load', 'Загрузка, %']
];

const financeColumns = [
  ['name', 'Проект'],
  ['income', 'Доход'],
  ['expense', 'Расход'],
  ['profit', 'Прибыль'],
  ['margin', 'Маржа, %'],
  ['status', 'Статус'],
  ['risk', 'Риск']
];

export default function DetailDrawer({ detail, data, onClose }) {
  const config = getDetailConfig(detail, data);

  return (
    <div className="fixed inset-0 z-[210]">
      <button
        className="absolute inset-0 h-full w-full bg-slate-950/45 backdrop-blur-[2px]"
        type="button"
        aria-label="Закрыть детализацию"
        onClick={onClose}
      />
      <aside className="absolute right-0 top-0 flex h-screen w-[min(860px,94vw)] flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-4 border-b border-slate-200 p-5 dark:border-slate-800">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold">{detail.label}</h2>
            <p className="mt-2 text-sm text-slate-500">{config.description}</p>
          </div>
          <button className="icon-btn shrink-0" onClick={onClose} title="Закрыть">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-5">
          <DataTable title={config.title} rows={config.rows} columns={config.columns} />
        </div>
      </aside>
    </div>
  );
}

function getDetailConfig(detail, data) {
  if (detail.rows && detail.columns) {
    return {
      title: detail.title || detail.label,
      description: detail.description || '',
      rows: detail.rows,
      columns: detail.columns
    };
  }

  const key = detail.key;

  if (key === 'activeProjects') {
    return {
      title: 'Активные проекты',
      description: 'Список активных проектов с учетом текущих фильтров.',
      rows: data.projects.filter((project) => project.status === 'active'),
      columns: projectColumns
    };
  }

  if (key === 'completedProjects') {
    return {
      title: 'Завершенные проекты',
      description: 'Список завершенных проектов с учетом текущих фильтров.',
      rows: data.projects.filter((project) => project.status === 'completed'),
      columns: projectColumns
    };
  }

  if (key === 'employees' || key === 'avgLoad' || key === 'teamLoad') {
    return {
      title: key === 'employees' ? 'Сотрудники в проектах' : 'Загрузка сотрудников',
      description: 'Сотрудники и их текущие показатели с учетом выбранных фильтров.',
      rows: data.users,
      columns: userColumns
    };
  }

  if (key === 'plannedHours' || key === 'actualHours' || key === 'closedHours') {
    return {
      title: 'Часы по сотрудникам и проектам',
      description: 'Детализация трудозатрат по проектам и сотрудникам.',
      rows: data.assignments,
      columns: assignmentColumns
    };
  }

  if (key === 'income' || key === 'expense' || key === 'profit') {
    return {
      title: 'Финансы по проектам',
      description: 'Финансовые показатели проектов с учетом текущих фильтров.',
      rows: data.projects.filter((project) => hasFinance(project)),
      columns: financeColumns
    };
  }

  if (key === 'openTasks') {
    return {
      title: 'Открытые задачи',
      description: 'Задачи, которые еще не закрыты.',
      rows: data.tasks.filter((task) => task.status !== 'closed'),
      columns: taskColumns
    };
  }

  if (key === 'closedTasks') {
    return {
      title: 'Выполненные задачи',
      description: 'Задачи со статусом выполнения.',
      rows: data.tasks.filter((task) => task.status === 'closed'),
      columns: taskColumns
    };
  }

  if (key === 'overdueTasks') {
    return {
      title: 'Просроченные задачи',
      description: 'Открытые задачи, у которых дедлайн или расчетная дата окончания уже прошли.',
      rows: data.tasks.filter((task) => task.overdue),
      columns: taskColumns
    };
  }

  if (key === 'completionRate') {
    return {
      title: 'Выполнение задач',
      description: 'Задачи, участвующие в расчете процента выполнения.',
      rows: data.tasks,
      columns: taskColumns
    };
  }

  return {
    title: 'Связанные задачи',
    description: 'Детализация показателя с учетом активных фильтров.',
    rows: data.tasks,
    columns: taskColumns
  };
}

function hasFinance(project) {
  return project.income !== null || project.expense !== null || project.profit !== null;
}
