import {
  buttonDanger,
  buttonPrimary,
  buttonSecondary,
  sizeMd,
  sizeSm,
} from '../lib/buttonStyles'

function Dashboard({
  projects,
  isLoadingProjects,
  onStartNewProject,
  onEditProfile,
  onContinueProject,
  onLogOut,
  onRefresh,
  errorMessage,
}) {
  return (
    <main className="p-4 flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <button
          type="button"
          className={`${buttonDanger} ${sizeSm}`}
          onClick={onLogOut}
        >
          Log Out
        </button>
      </header>

      <div className="flex gap-2">
        <button
          type="button"
          className={`${buttonPrimary} ${sizeMd}`}
          onClick={onStartNewProject}
          disabled={isLoadingProjects}
        >
          Start a new project
        </button>
        <button
          type="button"
          className={`${buttonSecondary} ${sizeMd}`}
          onClick={onRefresh}
          disabled={isLoadingProjects}
        >
          Refresh
        </button>
        <button
          type="button"
          className={`${buttonSecondary} ${sizeMd}`}
          onClick={onEditProfile}
          disabled={isLoadingProjects}
        >
          Edit profile
        </button>
      </div>

      {isLoadingProjects && <p>Loading projects...</p>}
      {errorMessage && <p className="text-red-600">{errorMessage}</p>}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Past projects</h2>

        {projects.length === 0 ? (
          <p>No projects yet. Start one now.</p>
        ) : (
          projects.map((project) => (
            <article key={project.id} className="border p-3 flex flex-col gap-2">
              <p>
                <strong>Description:</strong>{' '}
                {project.description.length > 120
                  ? `${project.description.slice(0, 120)}...`
                  : project.description}
              </p>
              <p>
                <strong>Skill level:</strong> {project.skill_level}
              </p>
              <p>
                <strong>Status:</strong> {project.completed ? 'Completed' : 'In Progress'}
              </p>
              <p>
                <strong>Created:</strong>{' '}
                {new Date(project.created_at).toLocaleString()}
              </p>
              <div>
                <button
                  type="button"
                  className={`${buttonSecondary} ${sizeSm}`}
                  onClick={() => onContinueProject(project)}
                >
                  Continue
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  )
}

export default Dashboard
