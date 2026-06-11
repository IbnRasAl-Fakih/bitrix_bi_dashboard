import { useMemo, useState } from 'react';
import DataTable from '../components/DataTable.jsx';
import { Gantt, ProjectCard, projectTypeMeta } from '../components/ProjectWidgets.jsx';

export default function ProjectsPage({ data }) {
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const projects = useMemo(() => data.projects.map((project) => ({ ...project, projectType: projectTypeMeta(project).label })), [data.projects]);
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  return (
    <>
      <section className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            selected={project.id === selectedProjectId}
            onClick={() => setSelectedProjectId(project.id)}
          />
        ))}
      </section>

      <Gantt
        projects={projects}
        tasks={data.tasks}
        selectedProject={selectedProject}
        onSelectProject={(project) => setSelectedProjectId(project.id)}
        onClearSelected={() => setSelectedProjectId('')}
      />

      <DataTable
        title="Таблица проектов"
        rows={projects}
        columns={[
          ['name', 'Название'],
          ['projectType', 'Тип'],
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
