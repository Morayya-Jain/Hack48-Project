function toText(value) {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (value == null) {
    return ''
  }

  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

export const EXPERTISE_OPTIONS = [
  {
    value: 'beginner',
    label: 'Beginner',
    description: "You're completely new to building and want to learn from the ground up.",
  },
  {
    value: 'exploring',
    label: 'Exploring',
    description:
      "You've started experimenting and want clearer guidance while building projects.",
  },
  {
    value: 'student',
    label: 'Student',
    description: 'You actively learn technical skills and want structured practice.',
  },
  {
    value: 'master',
    label: 'Master',
    description: 'You are experienced and want concise, high-level technical coaching.',
  },
]

export const SKILL_OPTIONS = [
  { value: 'frontend', label: 'Frontend' },
  { value: 'backend', label: 'Backend' },
  { value: 'full-stack', label: 'Full Stack' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'data', label: 'Data' },
  { value: 'ai-ml', label: 'AI/ML' },
]

export const INTEREST_OPTIONS = [
  { value: 'deeptech', label: 'DeepTech' },
  { value: 'agtech', label: 'AgTech' },
  { value: 'data-analysis', label: 'Data Analysis' },
  { value: 'stem', label: 'STEM' },
  { value: 'education', label: 'Education' },
  { value: 'healthtech', label: 'HealthTech' },
]

const EXPERTISE_VALUE_SET = new Set(EXPERTISE_OPTIONS.map((option) => option.value))
const SKILL_VALUE_SET = new Set(SKILL_OPTIONS.map((option) => option.value))
const INTEREST_VALUE_SET = new Set(INTEREST_OPTIONS.map((option) => option.value))

function toStringArray(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => toText(entry).trim())
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return []
    }

    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed
          .map((entry) => toText(entry).trim())
          .filter(Boolean)
      }
    } catch {
      // Ignore parse errors and fall back to comma-separated parsing.
    }

    return trimmed
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  }

  return []
}

function dedupe(values) {
  return Array.from(new Set(values))
}

export function normalizeExpertiseLevel(value) {
  const normalized = toText(value).trim().toLowerCase()
  if (EXPERTISE_VALUE_SET.has(normalized)) {
    return normalized
  }

  return ''
}

export function normalizeSelection(values, allowedSet, maxCount = 3) {
  const normalized = dedupe(
    toStringArray(values)
      .map((entry) => entry.toLowerCase())
      .filter((entry) => allowedSet.has(entry)),
  )

  return normalized.slice(0, maxCount)
}

export function normalizeProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    return {
      expertiseLevel: '',
      skills: [],
      interests: [],
      completedAt: null,
      createdAt: null,
      updatedAt: null,
    }
  }

  return {
    expertiseLevel: normalizeExpertiseLevel(profile.expertiseLevel ?? profile.expertise_level),
    skills: normalizeSelection(profile.skills, SKILL_VALUE_SET, 3),
    interests: normalizeSelection(profile.interests, INTEREST_VALUE_SET, 3),
    completedAt: profile.completedAt ?? profile.completed_at ?? null,
    createdAt: profile.createdAt ?? profile.created_at ?? null,
    updatedAt: profile.updatedAt ?? profile.updated_at ?? null,
  }
}

export function toProfilePayload(profile) {
  const normalized = normalizeProfile(profile)

  return {
    expertise_level: normalized.expertiseLevel || null,
    skills: normalized.skills,
    interests: normalized.interests,
    completed_at: normalized.completedAt || null,
  }
}

export function isProfileComplete(profile) {
  const normalized = normalizeProfile(profile)
  return Boolean(normalized.completedAt)
}

export function profileToPromptContext(profile) {
  const normalized = normalizeProfile(profile)
  return {
    expertiseLevel: normalized.expertiseLevel,
    skills: normalized.skills,
    interests: normalized.interests,
  }
}

export function expertiseLabel(value) {
  const normalized = normalizeExpertiseLevel(value)
  return (
    EXPERTISE_OPTIONS.find((option) => option.value === normalized)?.label ||
    'Unspecified'
  )
}

export function labelsForValues(values, options) {
  const byValue = new Map(options.map((option) => [option.value, option.label]))
  return normalizeSelection(
    values,
    new Set(options.map((option) => option.value)),
    99,
  ).map((value) => byValue.get(value) || value)
}

export const PROFILE_OPTION_SETS = {
  expertise: EXPERTISE_VALUE_SET,
  skills: SKILL_VALUE_SET,
  interests: INTEREST_VALUE_SET,
}
