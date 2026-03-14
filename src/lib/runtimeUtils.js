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
  isPreviewLanguage,
  normalizeRunnableCode,
  prettyLanguageName,
  resolveRuntimeLanguage,
  sanitizeLanguage,
}
