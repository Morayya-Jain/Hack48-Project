import { useEffect, useMemo, useRef, useState } from 'react'
import logo from '../assets/dojobuild-logo.png'
import {
  deriveWelcomeName,
  getStarterTemplate,
  STARTER_PROMPT_CARDS,
} from '../lib/homeFlow'

function Onboarding({
  onSubmit,
  projects = [],
  isLoadingProjects = false,
  onContinueProject = () => {},
  onEditProfile = () => {},
  onLogOut = () => {},
  user,
  isGeneratingRoadmap,
  errorMessage,
  defaultDescription,
}) {
  const [stepIndex, setStepIndex] = useState(0)
  const [description, setDescription] = useState(defaultDescription || '')
  const [selectedStarterId, setSelectedStarterId] = useState('')
  const [selectedSkillLevel, setSelectedSkillLevel] = useState('intermediate')
  const [experience, setExperience] = useState('')
  const [scope, setScope] = useState('')
  const [timeCommitment, setTimeCommitment] = useState('')
  const descriptionInputRef = useRef(null)

  const welcomeName = useMemo(() => deriveWelcomeName(user), [user])
  const trimmedDescription = description.trim()

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

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (stepIndex === 0) {
      if (!trimmedDescription) {
        return
      }

      setStepIndex(1)
      return
    }

    await onSubmit(trimmedDescription, {
      skillLevelPreference: selectedSkillLevel,
      experience: experience.trim() || 'Not specified.',
      scope: scope.trim() || 'Start with a simple MVP.',
      time: timeCommitment.trim() || 'Moderate pace.',
    })
  }

  const projectPreview = (project) => {
    const text = project?.description || 'Untitled project'
    return text.length > 34 ? `${text.slice(0, 34)}...` : text
  }

  const actionButtonClass =
    'inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 transition hover:border-green-300 hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-100 focus-visible:border-green-500 disabled:cursor-not-allowed disabled:opacity-60'
  const primaryButtonClass =
    'inline-flex h-12 items-center justify-center rounded-xl border border-green-700 bg-green-600 px-4 text-sm font-semibold text-white transition hover:border-green-600 hover:bg-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-100 focus-visible:border-green-500 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-400'
  const secondaryButtonClass =
    'inline-flex h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-100 focus-visible:border-green-500 disabled:cursor-not-allowed disabled:opacity-60'

  return (
    <main className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[288px_1fr]">
      <aside className="border-b border-slate-200 bg-white px-4 py-6 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3 px-2">
            <img
              src={logo}
              alt="DojoBuild logo"
              className="h-8 w-8 rounded-lg border border-green-200 bg-white p-1"
            />
            <p className="text-xl font-bold text-slate-900">DojoBuild</p>
          </div>

          <div className="mt-8">
            <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Projects
            </p>

            <div className="mt-3 flex flex-col gap-2">
              {isLoadingProjects ? (
                <p className="px-2 text-sm text-slate-600">Loading projects...</p>
              ) : projects.length === 0 ? (
                <p className="px-2 text-sm text-slate-600">No projects yet. Start one below.</p>
              ) : (
                projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    className="flex h-11 items-center justify-start gap-2 rounded-xl border border-transparent px-3 text-left text-sm font-medium text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => onContinueProject(project)}
                    disabled={isGeneratingRoadmap}
                    title={project.description}
                  >
                    <span className="truncate">{projectPreview(project)}</span>
                    <span className="shrink-0 text-slate-500">›</span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="mt-8">
            <button
              type="button"
              className="flex h-10 w-full items-center justify-start rounded-xl border border-transparent px-3 text-sm font-medium text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-100 focus-visible:border-green-500 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onEditProfile}
              disabled={isGeneratingRoadmap}
            >
              Settings
            </button>
          </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex flex-wrap items-center justify-end gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-8">
            <button
              type="button"
              className={actionButtonClass}
              onClick={onEditProfile}
              disabled={isGeneratingRoadmap}
            >
              Edit profile
            </button>
            <button
              type="button"
              className={actionButtonClass}
              onClick={onLogOut}
              disabled={isGeneratingRoadmap}
            >
              Log out
            </button>
        </header>

        <div className="flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <div className="mx-auto w-full max-w-5xl">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Welcome To Your Dojo, {welcomeName}!
            </h1>
            <p className="mt-2 text-base text-slate-600">
              Type or select from the options below to get started.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
              {stepIndex === 0 ? (
                <>
                  <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {STARTER_PROMPT_CARDS.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        className={`rounded-2xl border p-6 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-100 focus-visible:border-green-500 ${
                          selectedStarterId === card.id
                            ? 'border-green-400 bg-green-50'
                            : 'border-slate-200 bg-white hover:border-green-300'
                        }`}
                        onClick={() => handleStarterSelect(card.id)}
                        disabled={isGeneratingRoadmap}
                      >
                        <p className="text-2xl font-semibold text-slate-900">{card.title}</p>
                        <p className="mt-3 text-base text-slate-600">{card.description}</p>
                      </button>
                    ))}
                  </section>

                  <div className="mt-2 rounded-2xl border border-slate-300 bg-white px-4 py-3">
                    <div className="flex flex-col gap-3">
                      <label className="flex min-w-0 flex-1 items-start gap-3">
                        <svg
                          viewBox="0 0 20 20"
                          className="mt-3 h-5 w-5 shrink-0 text-slate-500"
                          aria-hidden="true"
                        >
                          <path
                            d="M13.5 12h-.79l-.28-.27a5.5 5.5 0 1 0-.71.71l.27.28v.79l5 4.99L18.49 17l-4.99-5ZM8.5 13A4.5 4.5 0 1 1 13 8.5 4.5 4.5 0 0 1 8.5 13Z"
                            fill="currentColor"
                          />
                        </svg>
                        <textarea
                          ref={descriptionInputRef}
                          value={description}
                          onChange={(event) => handleDescriptionChange(event.target.value)}
                          placeholder="Search or ask a question..."
                          rows={1}
                          className="w-full min-w-0 resize-none border-none bg-transparent py-2 text-base leading-6 text-slate-900 outline-none placeholder:text-slate-500"
                          disabled={isGeneratingRoadmap}
                          required
                        />
                      </label>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Personalize your roadmap
                  </h2>

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
                </>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {stepIndex === 1 ? (
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    onClick={() => setStepIndex(0)}
                    disabled={isGeneratingRoadmap}
                  >
                    Back
                  </button>
                ) : null}

                <button
                  type="submit"
                  className={primaryButtonClass}
                  disabled={isGeneratingRoadmap || (stepIndex === 0 && !trimmedDescription)}
                >
                  {stepIndex === 0
                    ? 'Continue'
                    : isGeneratingRoadmap
                      ? 'Generating roadmap...'
                      : 'Generate roadmap'}
                </button>

                {stepIndex === 0 ? (
                  <label className="inline-flex items-center gap-2">
                    <span className="sr-only">Skill level preference</span>
                    <div className="relative">
                      <select
                        value={selectedSkillLevel}
                        onChange={(event) => setSelectedSkillLevel(event.target.value)}
                        className="h-12 appearance-none rounded-xl border border-slate-300 bg-white pl-3 pr-8 text-sm font-semibold text-slate-800 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isGeneratingRoadmap}
                      >
                        <option value="none">None</option>
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                      <svg
                        viewBox="0 0 20 20"
                        className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600"
                        aria-hidden="true"
                      >
                        <path
                          d="m5 7 5 6 5-6"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </label>
                ) : null}
              </div>
            </form>

            {errorMessage ? <p className="mt-4 text-sm text-red-600">{errorMessage}</p> : null}
            {isGeneratingRoadmap ? (
              <p className="mt-2 text-sm text-slate-600">Generating roadmap...</p>
            ) : null}

            <div className="mt-10 flex flex-col items-center justify-center gap-2">
              <img
                src={logo}
                alt="DojoBuild mark"
                className="h-14 w-14 rounded-2xl border border-slate-200 bg-white p-2"
              />
              <p className="text-xs text-slate-500">DojoBuild.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

export default Onboarding
