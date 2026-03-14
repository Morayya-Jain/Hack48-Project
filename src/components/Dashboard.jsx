import logo from '../assets/dojobuild-logo-riya.png'

function normalizeSkillLabel(value) {
  const normalized = `${value || ''}`.trim().toLowerCase()
  if (normalized === 'advanced' || normalized === 'master') {
    return 'Advanced'
  }

  if (normalized === 'intermediate' || normalized === 'exploring' || normalized === 'student') {
    return 'Intermediate'
  }

  return 'Beginner'
}

function Dashboard({
  projects = [],
  isLoadingProjects = false,
  deletingProjectId = null,
  onStartNewProject = () => {},
  onEditProfile = () => {},
  onContinueProject = () => {},
  onDeleteProject = () => {},
  onLogOut = () => {},
  errorMessage = '',
}) {
  const isDeletingProject = Boolean(deletingProjectId)
  const actionButtonClass =
    'inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 transition hover:border-green-300 hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-100 focus-visible:border-green-500 disabled:cursor-not-allowed disabled:opacity-60'
  const logoutButtonClass =
    'inline-flex h-10 items-center justify-center rounded-xl border border-red-700 bg-red-600 px-4 text-sm font-medium text-white transition hover:border-red-600 hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-60'
  const continueButtonClass =
    'inline-flex h-10 items-center justify-center rounded-xl border border-green-700 bg-green-600 px-6 text-sm font-semibold text-white transition hover:border-green-600 hover:bg-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-300 disabled:cursor-not-allowed disabled:opacity-60'
  const deleteButtonClass =
    'inline-flex h-10 items-center justify-center rounded-xl border border-red-300 bg-white px-6 text-sm font-semibold text-red-700 transition hover:border-red-400 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:cursor-not-allowed disabled:opacity-60'

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="DojoBuild logo" className="h-8 w-8 rounded-md" />
            <p className="text-lg font-semibold text-slate-900 md:text-xl">DojoBuild</p>
          </div>

          <div className="flex flex-wrap gap-2 md:gap-3">
            <button
              type="button"
              className={actionButtonClass}
              onClick={onStartNewProject}
              disabled={isLoadingProjects || isDeletingProject}
            >
              Start a new project
            </button>
            <button
              type="button"
              className={actionButtonClass}
              onClick={onEditProfile}
              disabled={isLoadingProjects || isDeletingProject}
            >
              Edit profile
            </button>
            <button
              type="button"
              className={logoutButtonClass}
              onClick={onLogOut}
              disabled={isDeletingProject}
            >
              Log Out
            </button>
          </div>
        </div>
      </header>

      <section className="p-4 md:p-8">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">Dashboard</h1>
          <h2 className="mt-6 text-xl font-semibold text-slate-900 md:mt-8 md:text-2xl">
            Past projects
          </h2>

          {isLoadingProjects ? <p className="mt-4 text-sm text-slate-700">Loading projects...</p> : null}
          {isDeletingProject ? <p className="mt-2 text-sm text-slate-700">Deleting project...</p> : null}
          {errorMessage ? <p className="mt-3 text-sm text-red-600">{errorMessage}</p> : null}

          {!isLoadingProjects && projects.length === 0 ? (
            <p className="mt-4 text-sm text-slate-700">No projects yet. Start one now.</p>
          ) : null}

          <div className="mt-4 space-y-4">
            {projects.map((project) => (
              <article
                key={project.id}
                className="rounded-2xl border-2 border-slate-300 bg-slate-100 p-4 transition-colors hover:border-green-200 md:p-6"
              >
                <div className="space-y-3">
                  <p className="break-words text-sm text-slate-900 md:text-base">
                    <strong className="font-semibold">Description:</strong> {project.description}
                  </p>
                  <p className="text-sm text-slate-900 md:text-base">
                    <strong className="font-semibold">Skill level:</strong>{' '}
                    {normalizeSkillLabel(project.skill_level)}
                  </p>
                  <p className="text-sm text-slate-900 md:text-base">
                    <strong className="font-semibold">Status:</strong>{' '}
                    {project.completed ? 'Completed' : 'In Progress'}
                  </p>
                  <p className="text-sm text-slate-900 md:text-base">
                    <strong className="font-semibold">Created:</strong>{' '}
                    {new Date(project.created_at).toLocaleString()}
                  </p>
                  <div className="pt-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className={continueButtonClass}
                        onClick={() => onContinueProject(project)}
                        disabled={isLoadingProjects || isDeletingProject}
                      >
                        Continue
                      </button>
                      <button
                        type="button"
                        className={deleteButtonClass}
                        onClick={() => onDeleteProject(project)}
                        disabled={isLoadingProjects || isDeletingProject}
                      >
                        {deletingProjectId === project.id ? 'Deleting...' : 'Delete project'}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

      </section>
    </main>
  )
}

export default Dashboard
