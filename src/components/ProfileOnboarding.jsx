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

function OptionIcon({ value, className = 'h-9 w-9 text-green-700' }) {
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

  if (value === 'intermediate') {
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

  if (value === 'advanced') {
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

function OptionCard({ option, selected, onClick, compact = false }) {
  const description = option.description || OPTION_DESCRIPTIONS[option.value] || ''

  return (
    <button
      type="button"
      onClick={() => onClick(option.value)}
      className={`flex w-full flex-col items-center justify-start rounded-2xl border bg-white px-4 py-6 text-center transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-100 ${
        selected
          ? 'border-green-500 bg-green-50/70 text-slate-900 shadow-sm'
          : 'border-slate-200 text-slate-900 hover:border-green-300 hover:bg-green-50/30'
      }`}
      aria-pressed={selected}
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-xl border ${
          selected
            ? 'border-green-200 bg-green-100 text-green-700'
            : 'border-green-100 bg-green-50 text-green-700'
        }`}
      >
        <OptionIcon value={option.value} />
      </div>

      <div className={`mt-4 flex flex-col items-center ${compact ? 'gap-2' : 'gap-3'}`}>
        <h3 className={`${compact ? 'text-lg' : 'text-xl'} font-semibold tracking-tight text-slate-900`}>
          {option.label}
        </h3>
        {description ? (
          <p className={`${compact ? 'max-w-64 text-xs leading-5' : 'max-w-72 text-sm leading-6'} text-slate-600`}>
            {description}
          </p>
        ) : null}
      </div>
    </button>
  )
}

function StepPill({ index, isActive, label }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide ${
        isActive
          ? 'border-green-300 bg-green-50 text-green-800'
          : 'border-slate-200 bg-white text-slate-500'
      }`}
      aria-current={isActive ? 'step' : undefined}
    >
      <p>{`Step ${index + 1}`}</p>
      <p className="mt-1 normal-case tracking-normal">{label}</p>
    </div>
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

  const isCompactStep = currentStep.options.length > 4
  const gridClassName = isCompactStep
    ? 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'
    : 'grid grid-cols-1 gap-4 md:grid-cols-2'

  const primaryButtonClass =
    'inline-flex h-12 items-center justify-center rounded-xl border border-green-700 bg-green-600 px-5 text-sm font-semibold text-white transition hover:border-green-600 hover:bg-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-100 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-400'
  const secondaryButtonClass =
    'inline-flex h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-900 transition hover:border-green-300 hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-100 disabled:cursor-not-allowed disabled:opacity-60'
  const subtleButtonClass =
    'inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 transition hover:border-green-300 hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-100 disabled:cursor-not-allowed disabled:opacity-60'

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-5xl">
        <header className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Customisation Screen
          </h1>
          <p className="mt-2 text-base text-slate-600">let&apos;s configure your dojo.</p>
          {isEditing ? (
            <p className="mt-2 text-sm text-slate-600">Editing your mentor profile</p>
          ) : null}
        </header>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <span className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
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

        <div className="mt-4 grid grid-cols-3 gap-2">
          {steps.map((step, index) => (
            <StepPill
              key={step.sectionLabel}
              index={index}
              isActive={index === stepIndex}
              label={step.sectionLabel}
            />
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center sm:px-6 sm:py-5">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {currentStep.title}
          </h2>
          {currentStep.helperText ? (
            <p className="mt-2 text-sm text-slate-600">{currentStep.helperText}</p>
          ) : null}
        </div>

        <div className={`mt-4 ${gridClassName}`}>
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
                compact={isCompactStep}
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
