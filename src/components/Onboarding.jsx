import { useEffect, useMemo, useRef, useState } from 'react'
import logo from '../assets/new-project-logo.png'
import LoadingSpinner from './LoadingSpinner'
import {
  deriveWelcomeName,
  getStarterTemplate,
  STARTER_PROMPT_CARDS,
} from '../lib/homeFlow'
import { getProjectDisplayTitle } from '../lib/projectTitle'
import { LANGUAGE_LABELS, languagesConflict } from '../lib/runtimeUtils'

const SKILL_LEVEL_CHIPS = [
  { id: 'beginner', label: 'Beginner', value: 'beginner' },
  { id: 'intermediate', label: 'Intermediate', value: 'intermediate' },
  { id: 'advanced', label: 'Advanced', value: 'advanced' },
  { id: 'master', label: 'Master', value: 'master' },
]

function mapSkillChipToPreference(chipId) {
  return SKILL_LEVEL_CHIPS.find((chip) => chip.id === chipId)?.value || 'beginner'
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 text-slate-500" aria-hidden="true">
      <path
        d="M13.5 12h-.79l-.28-.27a5.5 5.5 0 1 0-.71.71l.27.28v.79l5 4.99L18.49 17l-4.99-5ZM8.5 13A4.5 4.5 0 1 1 13 8.5 4.5 4.5 0 0 1 8.5 13Z"
        fill="currentColor"
      />
    </svg>
  )
}

function CodeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="m8 8-4 4 4 4M16 8l4 4-4 4M13 5l-2 14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M3 6h6l2 2h10v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DatabaseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <ellipse
        cx="12"
        cy="5"
        rx="8"
        ry="3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 5v6c0 1.657 3.582 3 8 3s8-1.343 8-3V5M4 11v6c0 1.657 3.582 3 8 3s8-1.343 8-3v-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function RocketIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M12 15c-3 0-5-2-5-5 0-4 5-7 5-7s5 3 5 7c0 3-2 5-5 5Zm0 0-3 6 3-2 3 2-3-6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="9" r="1.6" fill="currentColor" />
    </svg>
  )
}

function StarterCardIcon({ starterId }) {
  if (starterId === 'build-frontend') {
    return <FolderIcon />
  }

  if (starterId === 'build-backend') {
    return <DatabaseIcon />
  }

  if (starterId === 'setting-domain') {
    return <RocketIcon />
  }

  return <CodeIcon />
}

function ProjectListIcon({ index }) {
  if (index % 3 === 1) {
    return <DatabaseIcon />
  }

  if (index % 3 === 2) {
    return <RocketIcon />
  }

  return <CodeIcon />
}

const ALL_LANGUAGE_IDS = Object.keys(LANGUAGE_LABELS).filter((id) => id !== 'auto')

function Onboarding({
  onSubmit,
  onSuggestLanguages,
  projects = [],
  isLoadingProjects = false,
  deletingProjectId = null,
  isBackfillingProjectTitles = false,
  projectTitleStatusMessage = '',
  onContinueProject = () => {},
  onDeleteProject = () => {},
  onLogOut = () => {},
  onBackToDashboard = null,
  onEditProfile = () => {},
  user,
  isGeneratingRoadmap,
  errorMessage,
  defaultDescription,
}) {
  const [stepIndex, setStepIndex] = useState(0)
  const [description, setDescription] = useState(defaultDescription || '')
  const [selectedStarterId, setSelectedStarterId] = useState('')
  const [selectedSkillChip, setSelectedSkillChip] = useState('beginner')
  const [experience, setExperience] = useState('')
  const [scope, setScope] = useState('')
  const [timeCommitment, setTimeCommitment] = useState('')
  const [suggestedLanguages, setSuggestedLanguages] = useState([])
  const [selectedLanguages, setSelectedLanguages] = useState([])
  const [isSuggestingLanguages, setIsSuggestingLanguages] = useState(false)
  const [languageSuggestionError, setLanguageSuggestionError] = useState('')
  const descriptionInputRef = useRef(null)

  const welcomeName = useMemo(() => deriveWelcomeName(user), [user])
  const trimmedDescription = description.trim()
  const isDeletingProject = Boolean(deletingProjectId)

  useEffect(() => {
    const input = descriptionInputRef.current
    if (!input || stepIndex !== 0) {
      return
    }

    input.style.height = '0px'
    input.style.height = `${Math.max(input.scrollHeight, 44)}px`
    input.style.overflowY = 'hidden'
  }, [description, stepIndex])

  const handleStarterSelect = (starterId) => {
    const template = getStarterTemplate(starterId)
    if (!template) {
      return
    }

    setSelectedStarterId(starterId)
    setDescription(template)
  }

  const handleDescriptionChange = (nextValue) => {
    setDescription(nextValue)

    const hasTemplateMatch = STARTER_PROMPT_CARDS.some(
      (card) => getStarterTemplate(card.id) === nextValue,
    )

    if (!hasTemplateMatch) {
      setSelectedStarterId('')
    }
  }

  const handleToggleLanguage = (languageId) => {
    setSelectedLanguages((prev) => {
      if (prev.includes(languageId)) {
        return prev.filter((id) => id !== languageId)
      }
      // Auto-deselect any currently-selected languages that conflict with the new pick.
      const withoutConflicts = prev.filter((id) => !languagesConflict(languageId, id))
      return [...withoutConflicts, languageId]
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (stepIndex === 0) {
      if (!trimmedDescription) {
        return
      }

      setIsSuggestingLanguages(true)
      setLanguageSuggestionError('')
      try {
        const result = await onSuggestLanguages(trimmedDescription)
        const languages = result?.data || ['javascript']
        setSuggestedLanguages(languages)
        setSelectedLanguages(languages)
      } catch {
        setSuggestedLanguages(ALL_LANGUAGE_IDS)
        setSelectedLanguages(['javascript'])
        setLanguageSuggestionError('Could not suggest languages. Please select manually.')
      } finally {
        setIsSuggestingLanguages(false)
      }

      setStepIndex(1)
      return
    }

    if (stepIndex === 1) {
      if (selectedLanguages.length === 0) {
        return
      }

      setStepIndex(2)
      return
    }

    await onSubmit(
      trimmedDescription,
      {
        skillLevelPreference: mapSkillChipToPreference(selectedSkillChip),
        experience: experience.trim() || 'Not specified.',
        scope: scope.trim() || 'Start with a simple MVP.',
        time: timeCommitment.trim() || 'Moderate pace.',
      },
      selectedLanguages,
    )
  }

  const projectPreview = (project) => {
    const text = getProjectDisplayTitle(project)
    return text.length > 34 ? `${text.slice(0, 34)}...` : text
  }

  const actionButtonClass =
    'inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-60'
  const logoutButtonClass =
    'inline-flex h-10 items-center justify-center rounded-xl border border-red-700 bg-red-600 px-4 text-sm font-semibold text-white transition hover:border-red-600 hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:cursor-not-allowed disabled:opacity-60'
  const primaryButtonClass =
    'inline-flex h-12 items-center justify-center rounded-xl border border-green-700 bg-green-600 px-5 text-sm font-semibold text-white transition hover:border-green-600 hover:bg-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-100 focus-visible:border-green-500 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-400'
  const secondaryButtonClass =
    'inline-flex h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-100 focus-visible:border-green-500 disabled:cursor-not-allowed disabled:opacity-60'

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="BuildDojo logo" className="h-8 w-8 rounded-md object-cover" />
            <p className="text-lg font-semibold text-slate-900 md:text-xl">BuildDojo</p>
          </div>

          <div className="flex flex-wrap gap-2 md:gap-3">
            {onBackToDashboard ? (
            <button
              type="button"
              className={actionButtonClass}
              onClick={onBackToDashboard}
              disabled={isGeneratingRoadmap || isDeletingProject}
            >
              Dashboard
            </button>
          ) : null}
          <button
            type="button"
            className={actionButtonClass}
            onClick={onEditProfile}
            disabled={isGeneratingRoadmap || isDeletingProject}
          >
            Edit profile
          </button>
            <button
              type="button"
              className={logoutButtonClass}
              onClick={onLogOut}
              disabled={isGeneratingRoadmap || isDeletingProject}
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[300px_1fr]">
        <aside className="border-b border-slate-200 bg-white px-4 py-6 lg:min-h-[calc(100vh-81px)] lg:border-b-0 lg:border-r">
          <div className="mt-2">
            <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Projects
            </p>

            <div className="mt-3 flex flex-col gap-2">
              {isLoadingProjects ? (
                <p className="px-2 text-sm text-slate-600">Loading projects...</p>
              ) : isDeletingProject ? (
                <p className="px-2 text-sm text-slate-600">Deleting project...</p>
              ) : projects.length === 0 ? (
                <p className="px-2 text-sm text-slate-600">No projects yet. Start one below.</p>
              ) : (
                projects.map((project, index) => (
                  <div key={project.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      className="flex h-11 min-w-0 flex-1 items-center justify-start gap-2 rounded-xl border border-transparent px-3 text-left text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => onContinueProject(project)}
                      disabled={isGeneratingRoadmap || isDeletingProject}
                      title={getProjectDisplayTitle(project)}
                    >
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                        <ProjectListIcon index={index} />
                      </span>
                      <span className="truncate">{projectPreview(project)}</span>
                      <span className="shrink-0 text-slate-500">›</span>
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-red-300 bg-white px-3 text-xs font-semibold text-red-700 transition hover:border-red-400 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => onDeleteProject(project)}
                      disabled={isGeneratingRoadmap || isDeletingProject}
                    >
                      {deletingProjectId === project.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                ))
              )}

              {isBackfillingProjectTitles ? (
                <p className="px-2 text-xs text-slate-500">Updating project titles...</p>
              ) : null}

              {projectTitleStatusMessage ? (
                <p className="px-2 text-xs text-red-600">{projectTitleStatusMessage}</p>
              ) : null}
            </div>
          </div>

          {onBackToDashboard ? (
            <div className="mt-10 border-t border-slate-200 pt-6">
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-xl px-2 text-base font-medium text-slate-800 transition hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={onBackToDashboard}
                disabled={isGeneratingRoadmap || isDeletingProject}
              >
                <span className="text-lg leading-none">›</span>
                Back to Dashboard
              </button>
            </div>
          ) : null}
        </aside>

        <div className="min-w-0 px-4 py-6 sm:px-8 sm:py-8">
          <div className="mx-auto w-full max-w-5xl">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Welcome To Your Dojo, {welcomeName}!
            </h1>
            <p className="mt-2 text-lg text-slate-600">
              Type or select from the options below to get started.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
              {stepIndex === 0 ? (
                <>
                  <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {STARTER_PROMPT_CARDS.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        className={`rounded-3xl border p-6 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-100 focus-visible:border-green-500 ${
                          selectedStarterId === card.id
                            ? 'border-green-400 bg-green-50'
                            : 'border-slate-200 bg-white hover:border-green-300'
                        }`}
                        onClick={() => handleStarterSelect(card.id)}
                        disabled={isGeneratingRoadmap}
                      >
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-green-100 text-green-600">
                            <StarterCardIcon starterId={card.id} />
                          </span>
                          <p className="text-2xl font-semibold text-slate-900">{card.title}</p>
                        </div>
                        <p className="mt-6 text-base text-slate-600">{card.description}</p>
                      </button>
                    ))}
                  </section>

                  <div className="mt-2 rounded-3xl border border-slate-300 bg-white px-4 py-3 shadow-sm">
                    <label className="flex min-w-0 items-start gap-3">
                      <span className="mt-2 shrink-0">
                        <SearchIcon />
                      </span>
                      <textarea
                        ref={descriptionInputRef}
                        value={description}
                        onChange={(event) => handleDescriptionChange(event.target.value)}
                        placeholder="Describe what you want to build or ask your next coding question..."
                        rows={1}
                        className="w-full min-w-0 resize-none border-none bg-transparent py-2 text-lg leading-7 text-slate-900 outline-none placeholder:text-slate-500"
                        disabled={isGeneratingRoadmap}
                        required
                      />
                    </label>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {SKILL_LEVEL_CHIPS.map((chip) => {
                        const isActive = chip.id === selectedSkillChip

                        return (
                          <button
                            key={chip.id}
                            type="button"
                            onClick={() => setSelectedSkillChip(chip.id)}
                            className={`inline-flex h-10 items-center rounded-full border px-4 text-base font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-100 ${
                              isActive
                                ? 'border-green-700 bg-green-600 text-white'
                                : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-50'
                            }`}
                            disabled={isGeneratingRoadmap}
                          >
                            {chip.label}
                            {isActive ? <span className="ml-1.5 text-sm">x</span> : null}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </>
              ) : stepIndex === 1 ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
                  <h2 className="text-xl font-semibold text-slate-900">Select project languages</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Based on your project, we recommend these languages. Toggle to adjust.
                  </p>

                  {languageSuggestionError ? (
                    <p className="mt-2 text-sm text-amber-600">{languageSuggestionError}</p>
                  ) : null}

                  {isSuggestingLanguages ? (
                    <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                      <LoadingSpinner className="h-4 w-4 text-slate-600" />
                      Analyzing project languages...
                    </div>
                  ) : (
                    <>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {suggestedLanguages.map((langId) => {
                          const isActive = selectedLanguages.includes(langId)
                          const wouldConflict =
                            !isActive &&
                            selectedLanguages.some((sel) => languagesConflict(langId, sel))
                          return (
                            <button
                              key={langId}
                              type="button"
                              onClick={() => handleToggleLanguage(langId)}
                              title={
                                wouldConflict
                                  ? `Selecting ${LANGUAGE_LABELS[langId] || langId} will deselect incompatible languages`
                                  : undefined
                              }
                              className={`inline-flex h-10 items-center rounded-full border px-4 text-base font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-100 ${
                                isActive
                                  ? 'border-green-700 bg-green-600 text-white'
                                  : wouldConflict
                                    ? 'border-slate-200 bg-white text-slate-400 hover:border-amber-400 hover:text-slate-700'
                                    : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-50'
                              }`}
                            >
                              {LANGUAGE_LABELS[langId] || langId}
                              {isActive ? <span className="ml-1.5 text-sm">✓</span> : null}
                            </button>
                          )
                        })}
                      </div>

                      {selectedLanguages.length === 0 ? (
                        <p className="mt-2 text-sm text-red-600">Select at least one language to continue.</p>
                      ) : null}
                    </>
                  )}
                </div>
              ) : (
                <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
                  <h2 className="text-xl font-semibold text-slate-900">Personalize your roadmap</h2>

                  <div className="mt-4 space-y-4">
                    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                      What experience do you already have with similar tools or tech? (Optional)
                      <textarea
                        value={experience}
                        onChange={(event) => setExperience(event.target.value)}
                        rows={3}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-base outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
                        placeholder="Example: I know basic HTML/CSS and a bit of JavaScript"
                        disabled={isGeneratingRoadmap}
                      />
                    </label>

                    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                      What is the smallest MVP you want first? (Optional)
                      <textarea
                        value={scope}
                        onChange={(event) => setScope(event.target.value)}
                        rows={3}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-base outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
                        placeholder="Example: Sign up, log in, and create one todo list"
                        disabled={isGeneratingRoadmap}
                      />
                    </label>

                    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                      What pace can you commit to each week? (Optional)
                      <input
                        type="text"
                        value={timeCommitment}
                        onChange={(event) => setTimeCommitment(event.target.value)}
                        className="h-12 rounded-xl border border-slate-300 px-3 text-base outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
                        placeholder="Example: 4 hours per week"
                        disabled={isGeneratingRoadmap}
                      />
                    </label>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {stepIndex > 0 ? (
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    onClick={() => setStepIndex(stepIndex - 1)}
                    disabled={isGeneratingRoadmap || isSuggestingLanguages}
                  >
                    Back
                  </button>
                ) : null}

                <button
                  type="submit"
                  className={primaryButtonClass}
                  disabled={
                    isGeneratingRoadmap ||
                    isSuggestingLanguages ||
                    (stepIndex === 0 && !trimmedDescription) ||
                    (stepIndex === 1 && selectedLanguages.length === 0)
                  }
                >
                  {stepIndex === 0
                    ? isSuggestingLanguages
                      ? (
                        <span className="inline-flex items-center gap-2">
                          <LoadingSpinner className="h-4 w-4 text-white" />
                          Analyzing...
                        </span>
                        )
                      : 'Continue'
                    : stepIndex === 1
                      ? 'Continue'
                      : isGeneratingRoadmap
                        ? (
                          <span className="inline-flex items-center gap-2">
                            <LoadingSpinner className="h-4 w-4 text-white" />
                            Generating roadmap...
                          </span>
                          )
                        : 'Generate roadmap'}
                </button>
              </div>
            </form>

            {errorMessage ? <p className="mt-4 text-sm text-red-600">{errorMessage}</p> : null}
            {isGeneratingRoadmap ? (
              <p className="mt-2 text-sm text-slate-600">
                <span className="inline-flex items-center gap-2">
                  <LoadingSpinner className="h-4 w-4 text-slate-600" />
                  Generating roadmap...
                </span>
              </p>
            ) : null}

          </div>
        </div>
      </div>
    </main>
  )
}

export default Onboarding
