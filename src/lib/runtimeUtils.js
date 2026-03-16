// Maps each language to a paradigm family. Languages in the same family are
// compatible; languages across conflicting families cannot coexist in one project.
const LANGUAGE_FAMILY = {
  javascript: 'web',
  typescript: 'web',
  html: 'web',
  python: 'scripting',
  ruby: 'scripting',
  php: 'scripting',
  java: 'jvm',
  kotlin: 'jvm',
  go: 'systems',
  rust: 'systems',
  csharp: 'dotnet',
  swift: 'apple',
  sql: 'data',
}

// Sorted pairs of families that cannot coexist (e.g. 'data|web' means sql conflicts with html/js/ts).
const CONFLICTING_FAMILY_PAIRS = new Set([
  'apple|dotnet',
  'apple|jvm',
  'apple|scripting',
  'apple|systems',
  'apple|web',
  'data|web',
  'dotnet|jvm',
  'dotnet|scripting',
  'dotnet|systems',
  'dotnet|web',
  'jvm|scripting',
  'jvm|systems',
  'jvm|web',
  'scripting|systems',
  'scripting|web',
  'systems|web',
])

// Returns true if language a and b cannot be selected together.
function languagesConflict(a, b) {
  const fa = LANGUAGE_FAMILY[a]
  const fb = LANGUAGE_FAMILY[b]
  if (!fa || !fb || fa === fb) return false
  return CONFLICTING_FAMILY_PAIRS.has([fa, fb].sort().join('|'))
}

// Returns a filtered LANGUAGE_CHOICES list restricted to the project's languages.
// Always includes 'auto'. Falls back to the full list when projectLanguages is not set.
function getProjectLanguageChoices(projectLanguages) {
  if (!Array.isArray(projectLanguages) || projectLanguages.length === 0) {
    return LANGUAGE_CHOICES
  }
  const locked = new Set(projectLanguages)
  return LANGUAGE_CHOICES.filter((c) => c.value === 'auto' || locked.has(c.value))
}

const LANGUAGE_LABELS = {
  auto: 'Auto',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  sql: 'SQL',
  html: 'HTML/CSS',
  java: 'Java',
  csharp: 'C#',
  go: 'Go',
  rust: 'Rust',
  ruby: 'Ruby',
  php: 'PHP',
  swift: 'Swift',
  kotlin: 'Kotlin',
}

const LANGUAGE_CHOICES = [
  { value: 'auto', label: 'Auto (Detected)' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'sql', label: 'SQL' },
  { value: 'html', label: 'HTML/CSS Preview' },
]

const KNOWN_LANGUAGES = Object.keys(LANGUAGE_LABELS).filter(
  (language) => language !== 'auto',
)

function sanitizeLanguage(value) {
  const normalized = (value || '').toLowerCase().trim()

  if (!normalized) {
    return ''
  }

  return KNOWN_LANGUAGES.includes(normalized) ? normalized : ''
}

function prettyLanguageName(language) {
  return LANGUAGE_LABELS[language] || `Unknown (${language || 'n/a'})`
}

function resolveRuntimeLanguage({ detectedLanguage, selectedLanguage, lockedLanguage }) {
  const locked = sanitizeLanguage(lockedLanguage)
  if (locked) {
    return locked
  }

  const selected = (selectedLanguage || 'auto').toLowerCase().trim()
  if (selected === 'auto') {
    return sanitizeLanguage(detectedLanguage) || 'javascript'
  }

  return sanitizeLanguage(selected) || sanitizeLanguage(detectedLanguage) || 'javascript'
}

function canRunInConsole(language) {
  return ['javascript', 'typescript', 'python', 'sql'].includes(language)
}

function isPreviewLanguage(language) {
  return language === 'html'
}

function normalizeRunnableCode(code, language) {
  const raw = code || ''
  const trimmed = raw.trim()

  if (!trimmed) {
    return {
      ok: false,
      message: 'No code to run yet. Add some code first.',
    }
  }

  if (trimmed === '// Start coding here') {
    return {
      ok: false,
      message: 'Starter text is not runnable code. Replace it with your solution first.',
    }
  }

  if (language === 'python' && trimmed.startsWith('//')) {
    return {
      ok: false,
      message: 'This looks like JavaScript comment syntax. Use Python syntax before running.',
    }
  }

  return {
    ok: true,
    code: raw,
  }
}

export {
  LANGUAGE_CHOICES,
  LANGUAGE_LABELS,
  canRunInConsole,
  getProjectLanguageChoices,
  isPreviewLanguage,
  languagesConflict,
  normalizeRunnableCode,
  prettyLanguageName,
  resolveRuntimeLanguage,
  sanitizeLanguage,
}
