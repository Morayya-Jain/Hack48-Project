import { detectLanguage } from './detectLanguage.js'
import { sanitizeLanguage } from './runtimeUtils.js'

const FILE_NAME_REGEX = /^[a-zA-Z0-9._-]+$/
const PATH_LANGUAGE_RULES = [
  { language: 'python', extensions: ['.py'] },
  { language: 'sql', extensions: ['.sql'] },
  { language: 'typescript', extensions: ['.ts', '.tsx'] },
  { language: 'html', extensions: ['.html', '.htm', '.css'] },
  { language: 'javascript', extensions: ['.js', '.jsx', '.mjs', '.cjs'] },
  { language: 'java', extensions: ['.java'] },
  { language: 'csharp', extensions: ['.cs'] },
  { language: 'go', extensions: ['.go'] },
  { language: 'rust', extensions: ['.rs'] },
  { language: 'ruby', extensions: ['.rb'] },
  { language: 'php', extensions: ['.php'] },
  { language: 'swift', extensions: ['.swift'] },
  { language: 'kotlin', extensions: ['.kt', '.kts'] },
]

function createLocalId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `local-${crypto.randomUUID()}`
  }

  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function sanitizeFilePath(input) {
  const normalized = (input || '').trim().replaceAll('\\', '/').replace(/^\/+/, '')

  if (!normalized) {
    return ''
  }

  const segments = normalized.split('/')
  const isValid = segments.every(
    (segment) => segment && segment !== '.' && segment !== '..' && FILE_NAME_REGEX.test(segment),
  )

  return isValid ? segments.join('/') : ''
}

function fileNameFromPath(path) {
  const safePath = sanitizeFilePath(path)
  if (!safePath) {
    return ''
  }

  const segments = safePath.split('/')
  return segments[segments.length - 1] || ''
}

function runtimeLanguageFromPath(path) {
  const safePath = sanitizeFilePath(path).toLowerCase()

  for (const rule of PATH_LANGUAGE_RULES) {
    if (rule.extensions.some((extension) => safePath.endsWith(extension))) {
      return rule.language
    }
  }

  return ''
}

function editorLanguageFromFile(file, fallback = 'javascript') {
  const path = sanitizeFilePath(file?.path || '')
  const lowerPath = path.toLowerCase()

  if (lowerPath.endsWith('.css')) {
    return 'css'
  }
  if (lowerPath.endsWith('.html') || lowerPath.endsWith('.htm')) {
    return 'html'
  }
  if (lowerPath.endsWith('.ts') || lowerPath.endsWith('.tsx')) {
    return 'typescript'
  }
  if (lowerPath.endsWith('.py')) {
    return 'python'
  }
  if (lowerPath.endsWith('.sql')) {
    return 'sql'
  }
  if (lowerPath.endsWith('.js') || lowerPath.endsWith('.jsx')) {
    return 'javascript'
  }

  const runtimeLanguage = sanitizeLanguage(file?.language || '')
  if (runtimeLanguage) {
    return runtimeLanguage
  }

  return fallback
}

function normalizeProjectFiles(rows = []) {
  return rows
    .map((row, index) => {
      const safePath = sanitizeFilePath(row.path || row.name || '')
      const runtimeLanguage = sanitizeLanguage(row.language) || runtimeLanguageFromPath(safePath)

      return {
        id: row.id || createLocalId(),
        project_id: row.project_id || null,
        user_id: row.user_id || null,
        path: safePath,
        name: fileNameFromPath(safePath),
        language: runtimeLanguage || 'javascript',
        content: typeof row.content === 'string' ? row.content : '',
        sort_index:
          typeof row.sort_index === 'number'
            ? row.sort_index
            : typeof row.sortIndex === 'number'
              ? row.sortIndex
              : index,
      }
    })
    .filter((file) => Boolean(file.path) && Boolean(file.name))
    .sort((a, b) => a.sort_index - b.sort_index || a.path.localeCompare(b.path))
}

function toPersistedFiles(files = [], projectId, userId) {
  return normalizeProjectFiles(files).map((file, index) => ({
    id: file.id?.startsWith('local-') ? undefined : file.id,
    project_id: projectId,
    user_id: userId,
    path: file.path,
    name: file.name,
    language: sanitizeLanguage(file.language) || runtimeLanguageFromPath(file.path) || 'javascript',
    content: typeof file.content === 'string' ? file.content : '',
    sort_index: typeof file.sort_index === 'number' ? file.sort_index : index,
  }))
}

function createFile(path, content = '', sortIndex = 0) {
  const safePath = sanitizeFilePath(path)
  const runtimeLanguage = runtimeLanguageFromPath(safePath) || 'javascript'

  return {
    id: createLocalId(),
    path: safePath,
    name: fileNameFromPath(safePath),
    language: runtimeLanguage,
    content,
    sort_index: sortIndex,
  }
}

function createDefaultProjectFiles(projectDescription, userCode = '') {
  const inferred = detectLanguage(projectDescription, userCode)
  const startLanguage = sanitizeLanguage(inferred) || 'javascript'

  if (startLanguage === 'html') {
    const defaultHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Project Preview</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <h1>Build your feature here</h1>
    <script src="./script.js"></script>
  </body>
</html>`

    return normalizeProjectFiles([
      createFile('index.html', userCode || defaultHtml, 0),
      createFile('style.css', userCode ? '' : 'body {\n  font-family: sans-serif;\n}\n', 1),
      createFile('script.js', userCode ? '' : '// Add your JavaScript here\n', 2),
    ])
  }

  if (startLanguage === 'python') {
    return normalizeProjectFiles([createFile('main.py', userCode || '# Start coding here\n', 0)])
  }

  if (startLanguage === 'sql') {
    return normalizeProjectFiles([
      createFile('query.sql', userCode || '-- Write SQL statements here\n', 0),
    ])
  }

  if (startLanguage === 'typescript') {
    return normalizeProjectFiles([
      createFile('main.ts', userCode || '// Start coding here\n', 0),
    ])
  }

  return normalizeProjectFiles([createFile('main.js', userCode || '// Start coding here\n', 0)])
}

function escapeInlineScriptContent(value) {
  return value.replace(/<\/script>/gi, '<\\/script>')
}

function buildPreviewSrcDoc(files = []) {
  const normalized = normalizeProjectFiles(files)
  const htmlFile =
    normalized.find((file) => file.path.toLowerCase() === 'index.html') ||
    normalized.find((file) => file.path.toLowerCase().endsWith('.html'))

  let html = htmlFile?.content?.trim()
  if (!html) {
    html = '<!doctype html><html><body><p>No HTML file found. Add index.html to preview.</p></body></html>'
  }

  const cssContent = normalized
    .filter((file) => file.path.toLowerCase().endsWith('.css'))
    .map((file) => file.content)
    .join('\n')
    .trim()

  const jsContent = normalized
    .filter(
      (file) =>
        file.path.toLowerCase().endsWith('.js') || file.path.toLowerCase().endsWith('.ts'),
    )
    .map((file) => file.content)
    .join('\n')
    .trim()

  if (cssContent) {
    const styleTag = `\n<style data-source="injected-preview">\n${cssContent}\n</style>\n`
    html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${styleTag}</head>`) : `${styleTag}${html}`
  }

  if (jsContent) {
    const scriptTag = `\n<script data-source="injected-preview">\n${escapeInlineScriptContent(jsContent)}\n</script>\n`
    html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${scriptTag}</body>`) : `${html}${scriptTag}`
  }

  return html
}

function buildExportPackage({ projectId, projectDescription, skillLevel, tasks = [], files = [] }) {
  return {
    version: 1,
    project: {
      id: projectId || null,
      description: projectDescription || '',
      skillLevel: skillLevel || 'beginner',
    },
    files: normalizeProjectFiles(files).map((file, index) => ({
      path: file.path,
      name: file.name,
      language: sanitizeLanguage(file.language) || runtimeLanguageFromPath(file.path) || 'javascript',
      content: file.content || '',
      sortIndex: typeof file.sort_index === 'number' ? file.sort_index : index,
    })),
    tasks: Array.isArray(tasks)
      ? tasks.map((task) => ({
          title: task.title || '',
          description: task.description || '',
          language: sanitizeLanguage(task.language),
        }))
      : [],
  }
}

function parseImportPackage(rawText) {
  try {
    const parsed = JSON.parse(rawText)

    if (!parsed || typeof parsed !== 'object') {
      return { data: null, error: new Error('Import file must be a JSON object.') }
    }

    if (parsed.version !== 1) {
      return { data: null, error: new Error('Unsupported import version.') }
    }

    if (!Array.isArray(parsed.files) || parsed.files.length === 0) {
      return { data: null, error: new Error('Import file has no files.') }
    }

    const normalizedFiles = normalizeProjectFiles(
      parsed.files.map((file, index) => ({
        path: file?.path || file?.name || '',
        name: file?.name || '',
        language: file?.language || runtimeLanguageFromPath(file?.path || ''),
        content: typeof file?.content === 'string' ? file.content : '',
        sort_index:
          typeof file?.sortIndex === 'number'
            ? file.sortIndex
            : typeof file?.sort_index === 'number'
              ? file.sort_index
              : index,
      })),
    )

    if (normalizedFiles.length === 0) {
      return { data: null, error: new Error('Import file paths are invalid.') }
    }

    return {
      data: {
        files: normalizedFiles,
      },
      error: null,
    }
  } catch (error) {
    return { data: null, error: new Error(error.message || 'Invalid import file.') }
  }
}

export {
  buildExportPackage,
  buildPreviewSrcDoc,
  createDefaultProjectFiles,
  createFile,
  editorLanguageFromFile,
  fileNameFromPath,
  normalizeProjectFiles,
  parseImportPackage,
  runtimeLanguageFromPath,
  sanitizeFilePath,
  toPersistedFiles,
}
