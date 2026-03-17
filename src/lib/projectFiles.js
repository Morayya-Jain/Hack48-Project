import { detectLanguage } from './detectLanguage.js'
import { sanitizeLanguage } from './runtimeUtils.js'

const FILE_NAME_REGEX = /^[a-zA-Z0-9._-]+$/
const ZIP_IMPORT_LIMITS = Object.freeze({
  maxArchiveBytes: 5 * 1024 * 1024,
  maxFileCount: 200,
  maxFileBytes: 512 * 1024,
  maxTotalBytes: 5 * 1024 * 1024,
})
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

const ALWAYS_ALLOWED_EXTENSIONS = new Set([
  '.json', '.md', '.txt', '.env', '.gitignore',
  '.yml', '.yaml', '.toml', '.cfg', '.ini', '.lock',
])

const LANGUAGE_IMPLICIT_COMPANIONS = {
  html: ['javascript'],
}

function getExtension(filePath) {
  const dotIndex = filePath.lastIndexOf('.')
  return dotIndex > 0 ? filePath.slice(dotIndex).toLowerCase() : ''
}

function getAllowedExtensions(lockedLanguages) {
  if (!Array.isArray(lockedLanguages) || lockedLanguages.length === 0) {
    return []
  }

  const effectiveLanguages = new Set(lockedLanguages)
  for (const language of lockedLanguages) {
    const companions = LANGUAGE_IMPLICIT_COMPANIONS[language]
    if (companions) {
      for (const companion of companions) {
        effectiveLanguages.add(companion)
      }
    }
  }

  const extensions = new Set()
  for (const rule of PATH_LANGUAGE_RULES) {
    if (effectiveLanguages.has(rule.language)) {
      for (const ext of rule.extensions) {
        extensions.add(ext)
      }
    }
  }

  return [...extensions]
}

function isFileAllowedByLanguageLock(filePath, lockedLanguages) {
  if (!Array.isArray(lockedLanguages) || lockedLanguages.length === 0) {
    return true
  }

  const ext = getExtension(filePath)
  if (!ext) {
    return true
  }

  if (ALWAYS_ALLOWED_EXTENSIONS.has(ext)) {
    return true
  }

  const allowed = getAllowedExtensions(lockedLanguages)
  return allowed.includes(ext)
}

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

function runtimeLanguageFromFile(file) {
  if (!file || typeof file !== 'object') {
    return ''
  }

  return runtimeLanguageFromPath(file.path || file.name || '') || sanitizeLanguage(file.language)
}

function buildUniqueFilePath(basePath, existingFiles = []) {
  const safeBasePath = sanitizeFilePath(basePath)
  if (!safeBasePath) {
    return ''
  }

  const normalizedExistingPaths = new Set(
    (existingFiles || [])
      .map((file) => sanitizeFilePath(file?.path || file?.name || '').toLowerCase())
      .filter(Boolean),
  )

  if (!normalizedExistingPaths.has(safeBasePath.toLowerCase())) {
    return safeBasePath
  }

  const segments = safeBasePath.split('/')
  const fileName = segments.pop() || ''
  const dotIndex = fileName.lastIndexOf('.')
  const stem = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName
  const extension = dotIndex > 0 ? fileName.slice(dotIndex) : ''

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidateName = `${stem}-${suffix}${extension}`
    const candidatePath = [...segments, candidateName].join('/')
    if (!normalizedExistingPaths.has(candidatePath.toLowerCase())) {
      return candidatePath
    }
  }

  return ''
}

function createStarterFileForLanguage(language, existingFiles = []) {
  const normalizedLanguage = sanitizeLanguage(language)
  if (!normalizedLanguage) {
    return null
  }

  const starterByLanguage = {
    javascript: {
      path: 'main.js',
      content: '// Start coding here\n',
    },
    typescript: {
      path: 'main.ts',
      content: '// Start coding here\n',
    },
    python: {
      path: 'main.py',
      content: '# Start coding here\n',
    },
    sql: {
      path: 'query.sql',
      content: '-- Write SQL statements here\n',
    },
    html: {
      path: 'index.html',
      content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Project Preview</title>
  </head>
  <body>
    <h1>Build your feature here</h1>
  </body>
</html>`,
    },
    java: {
      path: 'Main.java',
      content: '// Start coding here\n',
    },
    csharp: {
      path: 'Program.cs',
      content: '// Start coding here\n',
    },
    go: {
      path: 'main.go',
      content: '// Start coding here\n',
    },
    rust: {
      path: 'main.rs',
      content: '// Start coding here\n',
    },
    ruby: {
      path: 'main.rb',
      content: '# Start coding here\n',
    },
    php: {
      path: 'index.php',
      content: '<?php\n// Start coding here\n',
    },
    swift: {
      path: 'main.swift',
      content: '// Start coding here\n',
    },
    kotlin: {
      path: 'Main.kt',
      content: "// Start coding here\n",
    },
  }

  const starter = starterByLanguage[normalizedLanguage]
  if (!starter) {
    return null
  }

  const uniquePath = buildUniqueFilePath(starter.path, existingFiles)
  if (!uniquePath) {
    return null
  }

  return createFile(uniquePath, starter.content, existingFiles.length)
}

function findFirstFileByLanguage(files = [], language) {
  const normalizedLanguage = sanitizeLanguage(language)
  if (!normalizedLanguage) {
    return null
  }

  const normalizedFiles = normalizeProjectFiles(files)
  return (
    normalizedFiles.find((file) => runtimeLanguageFromFile(file) === normalizedLanguage) || null
  )
}

function createDefaultProjectFiles(
  projectDescription,
  userCode = '',
  preferredRuntimeLanguage = '',
  languages = null,
) {
  if (Array.isArray(languages) && languages.length > 0) {
    const files = []
    let sortIndex = 0

    for (const lang of languages) {
      const normalized = sanitizeLanguage(lang)
      if (!normalized) {
        continue
      }

      if (normalized === 'html') {
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
        files.push(createFile('index.html', defaultHtml, sortIndex++))
        files.push(createFile('style.css', 'body {\n  font-family: sans-serif;\n}\n', sortIndex++))
        if (!languages.includes('javascript')) {
          files.push(createFile('script.js', '// Add your JavaScript here\n', sortIndex++))
        }
      } else {
        const starter = createStarterFileForLanguage(normalized, files)
        if (starter) {
          files.push({ ...starter, sort_index: sortIndex++ })
        }
      }
    }

    if (files.length > 0) {
      return normalizeProjectFiles(files)
    }
  }

  const preferredLanguage = sanitizeLanguage(preferredRuntimeLanguage)
  const inferred = detectLanguage(projectDescription, userCode)
  const startLanguage = preferredLanguage || sanitizeLanguage(inferred) || 'javascript'

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

  const starterFile = createStarterFileForLanguage(startLanguage, [])
  if (starterFile) {
    return normalizeProjectFiles([
      {
        ...starterFile,
        content: userCode || starterFile.content,
        sort_index: 0,
      },
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
    .filter((file) => {
      const lowerPath = file.path.toLowerCase()
      return (
        lowerPath.endsWith('.js') ||
        lowerPath.endsWith('.mjs') ||
        lowerPath.endsWith('.cjs')
      )
    })
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

function toPositiveInteger(value, fallback) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback
  }

  return Math.floor(parsed)
}

function formatSizeLabel(bytes) {
  const safeBytes = Math.max(0, Number(bytes) || 0)
  const mb = safeBytes / (1024 * 1024)

  if (mb >= 1) {
    return `${mb.toFixed(1)} MB`
  }

  return `${Math.round(safeBytes / 1024)} KB`
}

function normalizeZipImportLimits(overrides = {}) {
  return {
    maxArchiveBytes: toPositiveInteger(
      overrides.maxArchiveBytes,
      ZIP_IMPORT_LIMITS.maxArchiveBytes,
    ),
    maxFileCount: toPositiveInteger(overrides.maxFileCount, ZIP_IMPORT_LIMITS.maxFileCount),
    maxFileBytes: toPositiveInteger(overrides.maxFileBytes, ZIP_IMPORT_LIMITS.maxFileBytes),
    maxTotalBytes: toPositiveInteger(overrides.maxTotalBytes, ZIP_IMPORT_LIMITS.maxTotalBytes),
  }
}

function validateZipImportFileDescriptors(fileDescriptors = [], overrides = {}) {
  const limits = normalizeZipImportLimits(overrides)
  const descriptors = Array.isArray(fileDescriptors) ? fileDescriptors : []

  if (descriptors.length === 0) {
    return {
      data: null,
      error: new Error('Import file has no project files.'),
    }
  }

  if (descriptors.length > limits.maxFileCount) {
    return {
      data: null,
      error: new Error(
        `Import contains too many files (${descriptors.length}). Limit is ${limits.maxFileCount}.`,
      ),
    }
  }

  let estimatedTotalBytes = 0

  for (const descriptor of descriptors) {
    const path = sanitizeFilePath(descriptor?.path || descriptor?.name || '') || 'unknown file'
    const sizeBytes = Number(descriptor?.sizeBytes)

    if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
      continue
    }

    if (sizeBytes > limits.maxFileBytes) {
      return {
        data: null,
        error: new Error(
          `File "${path}" is too large (${formatSizeLabel(sizeBytes)}). Limit per file is ${formatSizeLabel(limits.maxFileBytes)}.`,
        ),
      }
    }

    estimatedTotalBytes += sizeBytes

    if (estimatedTotalBytes > limits.maxTotalBytes) {
      return {
        data: null,
        error: new Error(
          `Imported file content is too large (${formatSizeLabel(estimatedTotalBytes)}). Total limit is ${formatSizeLabel(limits.maxTotalBytes)}.`,
        ),
      }
    }
  }

  return {
    data: {
      estimatedTotalBytes,
      limits,
    },
    error: null,
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
  ZIP_IMPORT_LIMITS,
  buildExportPackage,
  buildPreviewSrcDoc,
  createStarterFileForLanguage,
  createDefaultProjectFiles,
  createFile,
  editorLanguageFromFile,
  fileNameFromPath,
  findFirstFileByLanguage,
  getAllowedExtensions,
  isFileAllowedByLanguageLock,
  normalizeProjectFiles,
  parseImportPackage,
  runtimeLanguageFromFile,
  runtimeLanguageFromPath,
  sanitizeFilePath,
  toPersistedFiles,
  validateZipImportFileDescriptors,
}
