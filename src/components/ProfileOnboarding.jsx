import { useMemo, useState } from 'react'
import {
  EXPERTISE_OPTIONS,
  INTEREST_OPTIONS,
  SKILL_OPTIONS,
  normalizeProfile,
} from '../lib/profile'

const STEP_COUNT = 3

const OPTION_DESCRIPTIONS = {
  frontend: 'Designing front-end interfaces and interactions users rely on.',
  backend: 'Building secure APIs, services, and data workflows.',
  'full-stack': 'Connecting UI, APIs, and data into complete product features.',
  mobile: 'Creating mobile-first app experiences for real users.',
  data: 'Working with datasets, analytics, and practical insights.',
  'ai-ml': 'Applying AI and ML to solve concrete product problems.',
  deeptech: 'Exploring advanced technologies and research-driven ideas.',
  agtech: 'Improving agricultural systems with modern software tools.',
  'data-analysis': 'Turning raw data into clear, actionable understanding.',
  stem: 'Learning through science, technology, engineering, and math.',
  education: 'Building learning experiences and education-focused products.',
  healthtech: 'Improving health outcomes through thoughtful software design.',
}

function OptionIcon({ value, className = 'h-10 w-10 text-slate-700' }) {
  const iconClass = className

  if (value === 'beginner') {
    return (
      <svg viewBox="0 0 48 48" fill="none" className={iconClass} aria-hidden="true">
        <path
          d="m24 8 3.2 7.8L35 19l-7.8 3.2L24 30l-3.2-7.8L13 19l7.8-3.2L24 8Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="m35 31 1.7 4.3L41 37l-4.3 1.7L35 43l-1.7-4.3L29 37l4.3-1.7L35 31Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (value === 'exploring') {
    return (
      <svg viewBox="0 0 48 48" fill="none" className={iconClass} aria-hidden="true">
        <path d="M10 34h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path
          d="m17 30 8-8 5 5 8-8"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M34 19h9v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (value === 'student') {
    return (
      <svg viewBox="0 0 48 48" fill="none" className={iconClass} aria-hidden="true">
        <path d="m7 19 17-8 17 8-17 8-17-8Z" stroke="currentColor" strokeWidth="2" />
        <path d="M14 22v8c0 2 4.8 5 10 5s10-3 10-5v-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  if (value === 'master') {
    return (
      <svg viewBox="0 0 48 48" fill="none" className={iconClass} aria-hidden="true">
        <path d="M14 10v7c0 5.5 4.5 10 10 10s10-4.5 10-10v-7" stroke="currentColor" strokeWidth="2" />
        <path d="M10 12h4v6a5 5 0 0 1-5 5h-1v-3h1a2 2 0 0 0 2-2v-6Zm28 0h-4v6a5 5 0 0 0 5 5h1v-3h-1a2 2 0 0 1-2-2v-6Z" fill="currentColor" />
        <path d="M24 27v7m-7 4h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  if (value === 'frontend') {
    return (
      <svg viewBox="0 0 48 48" fill="none" className={iconClass} aria-hidden="true">
        <circle cx="19" cy="19" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="M27 27 38 38" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="14" cy="14" r="1.5" fill="currentColor" />
      </svg>
    )
  }

  if (value === 'backend' || value === 'full-stack') {
    return (
      <svg viewBox="0 0 48 48" fill="none" className={iconClass} aria-hidden="true">
        <path d="m18 16-8 8 8 8M30 16l8 8-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M26 12 22 36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  if (value === 'mobile') {
    return (
      <svg viewBox="0 0 48 48" fill="none" className={iconClass} aria-hidden="true">
        <rect x="15" y="7" width="18" height="34" rx="4" stroke="currentColor" strokeWidth="2" />
        <circle cx="24" cy="34" r="1.5" fill="currentColor" />
      </svg>
    )
  }

  if (value === 'data' || value === 'data-analysis') {
    return (
      <svg viewBox="0 0 48 48" fill="none" className={iconClass} aria-hidden="true">
        <path d="M10 36h28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M14 31V20m10 11V12m10 19v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  if (value === 'ai-ml' || value === 'deeptech') {
    return (
      <svg viewBox="0 0 48 48" fill="none" className={iconClass} aria-hidden="true">
        <circle cx="24" cy="24" r="6" stroke="currentColor" strokeWidth="2" />
        <path d="M24 8v6m0 20v6M8 24h6m20 0h6m-5.3-10.7-4.2 4.2M17.5 30.5l-4.2 4.2m0-21.4 4.2 4.2m13.2 13.2 4.2 4.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  if (value === 'agtech') {
    return (
      <svg viewBox="0 0 48 48" fill="none" className={iconClass} aria-hidden="true">
        <path d="M24 38V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M24 24c0-6 4.5-10 11-10 0 6.5-4 11-10 11M24 24c0-6-4.5-10-11-10 0 6.5 4 11 10 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  if (value === 'stem') {
    return (
      <svg viewBox="0 0 48 48" fill="none" className={iconClass} aria-hidden="true">
        <path d="M18 10h12M22 10v9l-8 14a4 4 0 0 0 3.4 6h13.2a4 4 0 0 0 3.4-6l-8-14v-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (value === 'education') {
    return (
      <svg viewBox="0 0 48 48" fill="none" className={iconClass} aria-hidden="true">
        <path d="M9 14h14a5 5 0 0 1 5 5v15H14a5 5 0 0 0-5 5V14Zm30 0H25a5 5 0 0 0-5 5v15h14a5 5 0 0 1 5 5V14Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    )
  }

  if (value === 'healthtech') {
    return (
      <svg viewBox="0 0 48 48" fill="none" className={iconClass} aria-hidden="true">
        <path d="M24 38s-12-7.5-12-16a7 7 0 0 1 12-4.6A7 7 0 0 1 36 22c0 8.5-12 16-12 16Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M24 18v8m-4-4h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 48 48" fill="none" className={iconClass} aria-hidden="true">
      <circle cx="24" cy="24" r="14" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function OptionCard({ option, selected, onClick }) {
  const description = option.description || OPTION_DESCRIPTIONS[option.value] || ''

  return (
    <button
      type="button"
      onClick={() => onClick(option.value)}
      className={`relative flex min-h-[210px] flex-col items-center justify-start overflow-hidden rounded-2xl border px-5 py-6 text-center transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-100 ${
        selected
          ? 'border-green-500 bg-green-50 text-slate-900 shadow-sm'
          : 'border-slate-200 bg-white text-slate-900 hover:border-green-300'
      }`}
      aria-pressed={selected}
    >
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.07]" aria-hidden="true">
        <OptionIcon value={option.value} className="h-36 w-36 text-slate-600" />
      </div>
      <div className="relative z-10 flex flex-col items-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white">
          <OptionIcon value={option.value} />
        </div>
        <h3 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">
          {option.label}
        </h3>
        {description ? <p className="mt-3 max-w-72 text-sm leading-6 text-slate-600">{description}</p> : null}
      </div>
    </button>
  )
}

function ProfileOnboarding({
  onComplete,
  isSaving,
  errorMessage,
  initialProfile,
  isEditing = false,
  onExit,
}) {
  const normalizedInitial = useMemo(() => normalizeProfile(initialProfile), [initialProfile])
  const [stepIndex, setStepIndex] = useState(0)
  const [expertiseLevel, setExpertiseLevel] = useState(normalizedInitial.expertiseLevel)
  const [skills, setSkills] = useState(normalizedInitial.skills)
  const [interests, setInterests] = useState(normalizedInitial.interests)
  const [stepError, setStepError] = useState('')

  const steps = [
    {
      sectionLabel: 'Section 1',
      title: 'What is your level of expertise?',
      options: EXPERTISE_OPTIONS,
      multiSelect: false,
      value: expertiseLevel,
      setValue: setExpertiseLevel,
      helperText: null,
    },
    {
      sectionLabel: 'Section 2',
      title: 'What skills would you like to explore?',
      options: SKILL_OPTIONS,
      multiSelect: true,
      value: skills,
      setValue: setSkills,
      helperText: 'Pick up to 3 skills.',
    },
    {
      sectionLabel: 'Section 3',
      title: 'What are your interests?',
      options: INTEREST_OPTIONS,
      multiSelect: true,
      value: interests,
      setValue: setInterests,
      helperText: 'Pick up to 3 interests.',
    },
  ]

  const currentStep = steps[stepIndex]

  const handleToggleOption = (value) => {
    setStepError('')

    if (!currentStep.multiSelect) {
      currentStep.setValue(value)
      return
    }

    currentStep.setValue((prev) => {
      if (prev.includes(value)) {
        return prev.filter((entry) => entry !== value)
      }

      if (prev.length >= 3) {
        setStepError('You can select up to 3 options for this section.')
        return prev
      }

      return [...prev, value]
    })
  }

  const submitProfile = async () => {
    await onComplete({
      expertiseLevel,
      skills,
      interests,
      completedAt: new Date().toISOString(),
    })
  }

  const handleContinue = async () => {
    setStepError('')

    if (stepIndex < steps.length - 1) {
      setStepIndex((prev) => prev + 1)
      return
    }

    await submitProfile()
  }

  const handleSkip = async () => {
    setStepError('')

    if (stepIndex < steps.length - 1) {
      setStepIndex((prev) => prev + 1)
      return
    }

    await submitProfile()
  }

  const handleBackStep = () => {
    setStepError('')

    if (stepIndex === 0) {
      return
    }

    setStepIndex((prev) => prev - 1)
  }

  const hasSelectedValues = Array.isArray(currentStep.value)
    ? currentStep.value.length > 0
    : Boolean(currentStep.value)

  const gridClassName =
    currentStep.options.length <= 4
      ? 'grid grid-cols-1 gap-4 min-[700px]:grid-cols-2 sm:gap-6'
      : 'grid grid-cols-1 gap-4 min-[700px]:grid-cols-2 lg:grid-cols-3 sm:gap-6'

  const primaryButtonClass =
    'inline-flex h-12 items-center justify-center rounded-xl border border-green-700 bg-green-600 px-5 text-sm font-semibold text-white transition hover:border-green-600 hover:bg-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-100 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-400'
  const secondaryButtonClass =
    'inline-flex h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-100 disabled:cursor-not-allowed disabled:opacity-60'
  const subtleButtonClass =
    'inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-100 disabled:cursor-not-allowed disabled:opacity-60'

  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8">
      <section className="mx-auto w-full max-w-6xl rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8 lg:p-10">
        <header className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Customisation Screen
          </h1>
          <p className="mt-2 text-base text-slate-600">let&apos;s configure your dojo.</p>
          {isEditing ? (
            <p className="mt-2 text-sm text-slate-600">Editing your mentor profile</p>
          ) : null}
        </header>

        <div className="mt-6 flex items-center justify-between gap-3">
          <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
            {currentStep.sectionLabel} of {STEP_COUNT}
          </span>
          {onExit ? (
            <button
              type="button"
              onClick={onExit}
              className={subtleButtonClass}
              disabled={isSaving}
            >
              Back to dashboard
            </button>
          ) : null}
        </div>

        <div className="mx-auto mt-6 max-w-4xl rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center sm:px-6 sm:py-5">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {currentStep.title}
          </h2>
          {currentStep.helperText ? (
            <p className="mt-2 text-sm text-slate-600">{currentStep.helperText}</p>
          ) : null}
        </div>

        <div className={`mt-6 ${gridClassName}`}>
          {currentStep.options.map((option) => {
            const isSelected = Array.isArray(currentStep.value)
              ? currentStep.value.includes(option.value)
              : currentStep.value === option.value

            return (
              <OptionCard
                key={option.value}
                option={option}
                selected={isSelected}
                onClick={handleToggleOption}
              />
            )
          })}
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-3">
              {stepIndex > 0 ? (
                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={isSaving}
                  onClick={handleBackStep}
                >
                  Back
                </button>
              ) : null}
              <button
                type="button"
                className={secondaryButtonClass}
                disabled={isSaving}
                onClick={handleSkip}
              >
                {stepIndex === steps.length - 1 ? 'Skip & Finish' : 'Skip'}
              </button>
            </div>

            {stepIndex > 0 ? (
              <span className="hidden sm:block" />
            ) : null}
            <button
              type="button"
              className={primaryButtonClass}
              disabled={isSaving}
              onClick={handleContinue}
            >
              {isSaving
                ? 'Saving profile...'
                : stepIndex === steps.length - 1
                  ? 'Continue & Finish'
                  : 'Continue'}
            </button>
          </div>

          {stepError ? <p className="text-sm text-red-600">{stepError}</p> : null}
          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
          {!hasSelectedValues ? (
            <p className="text-sm text-slate-600">
              You can continue with no selection and update this later.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  )
}

export default ProfileOnboarding
