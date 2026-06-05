import { useMemo, useState } from 'react';
import DataTable from '../components/DataTable.jsx';
import { Gantt, ProjectCard } from '../components/ProjectWidgets.jsx';

export default function ProjectsPage({ data }) {
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const selectedProject = useMemo(
    () => data.projects.find((project) => project.id === selectedProjectId) || null,
    [data.projects, selectedProjectId]
  );

  return (
    <>
      <section className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            selected={project.id === selectedProjectId}
            onClick={() => setSelectedProjectId(project.id)}
          />
        ))}
      </section>

      <Gantt
        projects={data.projects}
        tasks={data.tasks}
        selectedProject={selectedProject}
        onSelectProject={(project) => setSelectedProjectId(project.id)}
        onClearSelected={() => setSelectedProjectId('')}
      />

      <DataTable
        title="Таблица проектов"
        rows={data.projects}
        columns={[
          ['name', 'Название'],
          ['responsible', 'Ответственный'],
          ['status', 'Статус'],
          ['progress', 'Прогресс срока, %'],
          ['taskCount', 'Задач'],
          ['closedTasks', 'Завершено'],
          ['overdueTasks', 'Просрочено'],
          ['plannedHours', 'План'],
          ['actualHours', 'Факт'],
          ['income', 'Доход'],
          ['expense', 'Расход'],
          ['profit', 'Прибыль'],
          ['margin', 'Маржа, %'],
          ['risk', 'Риск']
        ]}
      />
    </>
  );
}
