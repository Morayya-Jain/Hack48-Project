const unsupportedHints = [
  { key: 'java', value: 'java' },
  { key: 'c#', value: 'csharp' },
  { key: 'csharp', value: 'csharp' },
  { key: 'golang', value: 'go' },
  { key: ' go ', value: 'go' },
  { key: 'rust', value: 'rust' },
  { key: 'ruby', value: 'ruby' },
  { key: 'php', value: 'php' },
  { key: 'swift', value: 'swift' },
  { key: 'kotlin', value: 'kotlin' },
]

function matchUnsupported(text) {
  for (const hint of unsupportedHints) {
    if (text.includes(hint.key)) {
      return hint.value
    }
  }

  return ''
}

function detectLanguage(description, code = '') {
  const text = ` ${(description || '').toLowerCase()} `
  const source = (code || '').trim()
  const lowerSource = source.toLowerCase()

  if (text.includes('python')) {
    return 'python'
  }

  if (text.includes('sql') || text.includes('database') || text.includes('query')) {
    return 'sql'
  }

  if (text.includes('html') || text.includes('css')) {
    return 'html'
  }

  if (text.includes('typescript')) {
    return 'typescript'
  }

  if (
    text.includes('javascript') ||
    text.includes('react') ||
    text.includes('jsx') ||
    text.includes('node')
  ) {
    return 'javascript'
  }

  const unsupportedFromDescription = matchUnsupported(text)
  if (unsupportedFromDescription) {
    return unsupportedFromDescription
  }

  if (
    lowerSource.startsWith('<!doctype html') ||
    /^<\/?(html|head|body|main|section|article|div|span|p|h[1-6]|form|button)\b/i.test(source) ||
    lowerSource.includes('<style') ||
    lowerSource.includes('</')
  ) {
    return 'html'
  }

  if (
    /(^|\n)\s*def\s+\w+\s*\(/.test(source) ||
    /(^|\n)\s*class\s+\w+\s*[:(]/.test(source) ||
    /(^|\n)\s*from\s+\w+\s+import\s+/.test(source) ||
    /(^|\n)\s*import\s+\w+/.test(source) ||
    /(^|\n)\s*print\s*\(/.test(source)
  ) {
    return 'python'
  }

  if (
    /(^|\n)\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)\b/i.test(source) ||
    /(^|\n)\s*--/.test(source)
  ) {
    return 'sql'
  }

  if (
    /(^|\n)\s*interface\s+\w+/.test(source) ||
    /(^|\n)\s*type\s+\w+\s*=/.test(source) ||
    /(^|\n)\s*(const|let|var)\s+\w+\s*:\s*[^\n=;]+/.test(source) ||
    /(^|\n)\s*function\s+\w+\s*\([^)]*:\s*[^\n,)]+/.test(source)
  ) {
    return 'typescript'
  }

  return 'javascript'
}

export { detectLanguage }
