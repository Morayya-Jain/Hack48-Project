import { useMemo, useState } from 'react'
import {
  buttonPrimary,
  buttonSecondary,
  sizeLg,
  sizeSm,
} from '../lib/buttonStyles'
import {
  EXPERTISE_OPTIONS,
  INTEREST_OPTIONS,
  SKILL_OPTIONS,
  normalizeProfile,
} from '../lib/profile'

function OptionIcon({ index }) {
  const iconClass = 'w-11 h-11 text-slate-500'

  if (index % 4 === 0) {
    return (
      <svg viewBox="0 0 48 48" fill="none" className={iconClass} aria-hidden="true">
        <circle cx="24" cy="24" r="14" stroke="currentColor" strokeWidth="2" />
      </svg>
    )
  }

  if (index % 4 === 1) {
    return (
      <svg viewBox="0 0 48 48" fill="none" className={iconClass} aria-hidden="true">
        <path d="M10 34 22 14l10 20H10Z" stroke="currentColor" strokeWidth="2" />
        <path d="M20 34 32 14l10 20H20Z" stroke="currentColor" strokeWidth="2" />
      </svg>
    )
  }

  if (index % 4 === 2) {
    return (
      <svg viewBox="0 0 48 48" fill="none" className={iconClass} aria-hidden="true">
        <rect x="7" y="10" width="34" height="24" rx="9" stroke="currentColor" strokeWidth="2" />
        <path d="m18 34-1.5 7L26 34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 48 48" fill="none" className={iconClass} aria-hidden="true">
      <path
        d="m24 6 5.3 10.8 11.9 1.7-8.6 8.4 2 11.8L24 33.2l-10.6 5.5 2-11.8-8.6-8.4 11.9-1.7L24 6Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function OptionCard({ option, index, selected, onClick, helperText }) {
  return (
    <button
      type="button"
      onClick={() => onClick(option.value)}
      className={`rounded-4xl border px-6 py-6 min-h-60 flex flex-col items-center justify-start text-center transition-colors ${
        selected
          ? 'border-sky-600 bg-sky-50 text-slate-950'
          : 'border-slate-400 bg-white text-slate-900 hover:border-slate-500'
      }`}
    >
      <OptionIcon index={index} />
      <h3 className="mt-3 text-[38px]/[1.15] max-[720px]:text-[32px]/[1.15] font-semibold tracking-tight">
        {option.label}
      </h3>
      {helperText ? <p className="mt-3 text-base/[1.5] text-slate-700">{helperText}</p> : null}
      {option.description ? (
        <p className="mt-3 text-sm/[1.5] text-slate-700 max-w-52">{option.description}</p>
      ) : null}
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

  const hasSelectedValues = Array.isArray(currentStep.value)
    ? currentStep.value.length > 0
    : Boolean(currentStep.value)

  const gridClassName =
    currentStep.options.length <= 4
      ? 'grid grid-cols-1 min-[640px]:grid-cols-2 gap-5'
      : 'grid grid-cols-1 min-[640px]:grid-cols-2 min-[960px]:grid-cols-3 gap-5'

  return (
    <main className="min-h-screen bg-[radial-gradient(circle,_#d7dce2_1px,_transparent_1.5px)] [background-size:22px_22px] p-4 sm:p-6">
      <section className="mx-auto w-full max-w-6xl rounded-2xl border border-slate-300 bg-slate-50 p-4 sm:p-6 lg:p-8">
        <div className="flex items-start justify-between gap-3 mb-6">
          <span className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-3xl/[1.1] max-[720px]:text-2xl/[1.1] font-semibold text-slate-900">
            {currentStep.sectionLabel}
          </span>
          {onExit ? (
            <button
              type="button"
              onClick={onExit}
              className={`${buttonSecondary} ${sizeSm}`}
              disabled={isSaving}
            >
              Back to dashboard
            </button>
          ) : null}
        </div>

        <div className="mx-auto mb-7 max-w-4xl rounded-[2rem] border border-slate-400 bg-white px-6 py-5 text-center">
          <h1 className="text-5xl/[1.2] max-[720px]:text-[38px]/[1.2] font-semibold tracking-tight text-slate-900">
            {currentStep.title}
          </h1>
          {isEditing ? (
            <p className="mt-2 text-sm text-slate-600">Editing your mentor profile</p>
          ) : null}
        </div>

        <div className={gridClassName}>
          {currentStep.options.map((option, index) => {
            const isSelected = Array.isArray(currentStep.value)
              ? currentStep.value.includes(option.value)
              : currentStep.value === option.value

            return (
              <OptionCard
                key={option.value}
                option={option}
                index={index}
                selected={isSelected}
                onClick={handleToggleOption}
                helperText={currentStep.helperText}
              />
            )
          })}
        </div>

        <div className="mt-8 flex flex-col items-end gap-3">
          <div className="flex gap-3">
            <button
              type="button"
              className={`${buttonSecondary} ${sizeLg}`}
              disabled={isSaving}
              onClick={handleSkip}
            >
              {stepIndex === steps.length - 1 ? 'Skip & Finish' : 'Skip'}
            </button>
            <button
              type="button"
              className={`${buttonPrimary} ${sizeLg}`}
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
