import { useCallback, useMemo, useState } from 'react'
import { buttonPrimary, buttonSecondary, sizeSm } from '../lib/buttonStyles'

let sqlRuntimePromise = null

const languageLabels = {
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

const languageChoices = [
  { value: 'auto', label: 'Auto (Detected)' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'sql', label: 'SQL' },
  { value: 'html', label: 'HTML/CSS Preview' },
]

function toText(value) {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (value == null) {
    return 'undefined'
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function prettyLanguageName(language) {
  return languageLabels[language] || `Unknown (${language || 'n/a'})`
}

function createJavascriptWorkerScript() {
  return `
const formatValue = (value) => {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value == null) return 'undefined'

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

self.onmessage = async (event) => {
  const { code } = event.data
  const emit = (type, text) => self.postMessage({ type, text })
  const proxyConsole = {
    log: (...args) => emit('log', args.map(formatValue).join(' ')),
    info: (...args) => emit('info', args.map(formatValue).join(' ')),
    warn: (...args) => emit('warn', args.map(formatValue).join(' ')),
    error: (...args) => emit('error', args.map(formatValue).join(' ')),
  }

  const originalConsole = self.console
  self.console = proxyConsole

  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
    const runUserCode = new AsyncFunction(code)
    const result = await runUserCode()

    if (typeof result !== 'undefined') {
      emit('result', formatValue(result))
    }

    emit('done', 'Execution finished.')
  } catch (error) {
    emit('error', error?.stack || error?.message || String(error))
  } finally {
    self.console = originalConsole
  }
}
`
}

function createPythonWorkerScript() {
  return `
let pyodideReadyPromise = null

const formatValue = (value) => {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value == null) return 'undefined'

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const emit = (type, text) => self.postMessage({ type, text })

async function getPyodideInstance() {
  if (!pyodideReadyPromise) {
    pyodideReadyPromise = (async () => {
      importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js')
      const pyodide = await loadPyodide()

      pyodide.setStdout({
        batched: (text) => emit('log', text),
      })

      pyodide.setStderr({
        batched: (text) => emit('error', text),
      })

      return pyodide
    })()
  }

  return pyodideReadyPromise
}

self.onmessage = async (event) => {
  const { code } = event.data

  try {
    emit('info', 'Preparing Python runtime...')
    const pyodide = await getPyodideInstance()
    emit('info', 'Python runtime ready.')

    const result = await pyodide.runPythonAsync(code || '')

    if (typeof result !== 'undefined' && result !== null) {
      emit('result', formatValue(result.toString ? result.toString() : result))
    }

    emit('done', 'Execution finished.')
  } catch (error) {
    emit('error', error?.message || String(error))
  }
}
`
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

function extractTypeScriptDiagnostics(tsApi, diagnostics = []) {
  const errors = diagnostics.filter(
    (diagnostic) => diagnostic.category === tsApi.DiagnosticCategory.Error,
  )

  return errors.map((diagnostic) => {
    const message = tsApi.flattenDiagnosticMessageText(diagnostic.messageText, '\n')

    if (!diagnostic.file || typeof diagnostic.start !== 'number') {
      return message
    }

    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
      diagnostic.start,
    )

    return `Line ${line + 1}, Col ${character + 1}: ${message}`
  })
}

async function getSqlRuntime() {
  if (!sqlRuntimePromise) {
    sqlRuntimePromise = (async () => {
      const [{ default: initSqlJs }, { default: sqlWasmUrl }] = await Promise.all([
        import('sql.js'),
        import('sql.js/dist/sql-wasm.wasm?url'),
      ])

      return initSqlJs({ locateFile: () => sqlWasmUrl })
    })()
  }

  return sqlRuntimePromise
}

function formatSqlResultSet(resultSet) {
  const columns = resultSet.columns || []
  const values = resultSet.values || []

  if (columns.length === 0) {
    return 'No rows returned.'
  }

  const lines = []
  lines.push(columns.join(' | '))
  lines.push(columns.map(() => '---').join(' | '))

  const maxRows = 20
  values.slice(0, maxRows).forEach((row) => {
    lines.push(row.map((value) => toText(value)).join(' | '))
  })

  if (values.length > maxRows) {
    lines.push(`... ${values.length - maxRows} more row(s)`)
  }

  return lines.join('\n')
}

function RunConsole({ code, language }) {
  const [selectedLanguage, setSelectedLanguage] = useState('auto')
  const [outputLines, setOutputLines] = useState([])
  const [isRunning, setIsRunning] = useState(false)
  const [isPreparingRuntime, setIsPreparingRuntime] = useState(false)

  const resolvedLanguage = selectedLanguage === 'auto' ? language : selectedLanguage
  const isJavascript = resolvedLanguage === 'javascript'
  const isTypescript = resolvedLanguage === 'typescript'
  const isPython = resolvedLanguage === 'python'
  const isSql = resolvedLanguage === 'sql'
  const isHtml = resolvedLanguage === 'html'
  const canRunInConsole = isJavascript || isTypescript || isPython || isSql

  const previewSrcDoc = useMemo(() => {
    if (!isHtml) {
      return ''
    }

    return code || '<p>No HTML yet.</p>'
  }, [code, isHtml])

  const appendLine = useCallback((type, message) => {
    setOutputLines((prev) => [
      ...prev,
      {
        type,
        message,
      },
    ])
  }, [])

  const clearOutput = useCallback(() => {
    setOutputLines([])
  }, [])

  const runInWorker = useCallback(
    async ({ workerScript, sourceCode, timeoutMs }) => {
      setIsRunning(true)
      setIsPreparingRuntime(false)
      setOutputLines([])

      try {
        const workerBlob = new Blob([workerScript], {
          type: 'application/javascript',
        })
        const workerUrl = URL.createObjectURL(workerBlob)
        const worker = new Worker(workerUrl)

        let didFinish = false
        const timeoutId = window.setTimeout(() => {
          if (didFinish) {
            return
          }

          didFinish = true
          worker.terminate()
          URL.revokeObjectURL(workerUrl)
          appendLine('error', `Execution timed out after ${timeoutMs / 1000} seconds.`)
          setIsRunning(false)
          setIsPreparingRuntime(false)
        }, timeoutMs)

        worker.onmessage = (event) => {
          const { type, text } = event.data ?? {}
          const normalizedText = toText(text)
          appendLine(type || 'log', normalizedText)

          const lowerText = normalizedText.toLowerCase()
          if (type === 'info' && lowerText.includes('preparing')) {
            setIsPreparingRuntime(true)
          }

          if (type === 'info' && lowerText.includes('ready')) {
            setIsPreparingRuntime(false)
          }

          if (type === 'done' || type === 'error') {
            if (didFinish) {
              return
            }

            didFinish = true
            clearTimeout(timeoutId)
            worker.terminate()
            URL.revokeObjectURL(workerUrl)
            setIsRunning(false)
            setIsPreparingRuntime(false)
          }
        }

        worker.onerror = (event) => {
          if (didFinish) {
            return
          }

          didFinish = true
          clearTimeout(timeoutId)
          appendLine('error', event.message || 'Runtime error')
          worker.terminate()
          URL.revokeObjectURL(workerUrl)
          setIsRunning(false)
          setIsPreparingRuntime(false)
        }

        worker.postMessage({ code: sourceCode || '' })
      } catch (error) {
        appendLine('error', error.message || 'Could not run code.')
        setIsRunning(false)
        setIsPreparingRuntime(false)
      }
    },
    [appendLine],
  )

  const runSqlCode = useCallback(
    async (sourceCode) => {
      setIsRunning(true)
      setIsPreparingRuntime(true)
      setOutputLines([])

      let db = null

      try {
        appendLine('info', 'Preparing SQL runtime...')
        const SQL = await getSqlRuntime()
        setIsPreparingRuntime(false)
        appendLine('info', 'SQL runtime ready.')

        db = new SQL.Database()
        const statements = sourceCode
          .split(';')
          .map((statement) => statement.trim())
          .filter(Boolean)

        if (statements.length === 0) {
          appendLine('warn', 'No SQL statements found.')
          return
        }

        statements.forEach((statement, index) => {
          try {
            const sql = `${statement};`
            const resultSets = db.exec(sql)

            if (resultSets.length === 0) {
              appendLine('info', `Statement ${index + 1} executed successfully.`)
              return
            }

            resultSets.forEach((resultSet, resultIndex) => {
              appendLine(
                'result',
                `Statement ${index + 1}, Result ${resultIndex + 1}:\n${formatSqlResultSet(resultSet)}`,
              )
            })
          } catch (error) {
            appendLine(
              'error',
              `Statement ${index + 1} failed: ${error.message || 'Unknown SQL error.'}`,
            )
          }
        })
      } catch (error) {
        appendLine('error', error.message || 'Could not run SQL code.')
      } finally {
        if (db) {
          db.close()
        }

        setIsRunning(false)
        setIsPreparingRuntime(false)
      }
    },
    [appendLine],
  )

  const handleRunCode = useCallback(async () => {
    const normalized = normalizeRunnableCode(code, resolvedLanguage)

    if (!normalized.ok) {
      setOutputLines([
        {
          type: 'warn',
          message: normalized.message,
        },
      ])
      return
    }

    if (isJavascript) {
      await runInWorker({
        workerScript: createJavascriptWorkerScript(),
        sourceCode: normalized.code,
        timeoutMs: 5000,
      })
      return
    }

    if (isTypescript) {
      const tsModule = await import('typescript')
      const tsApi = tsModule.default || tsModule

      const transpileResult = tsApi.transpileModule(normalized.code, {
        reportDiagnostics: true,
        compilerOptions: {
          module: tsApi.ModuleKind.ESNext,
          target: tsApi.ScriptTarget.ES2020,
        },
      })

      const diagnostics = extractTypeScriptDiagnostics(
        tsApi,
        transpileResult.diagnostics,
      )

      if (diagnostics.length > 0) {
        setOutputLines(diagnostics.map((message) => ({ type: 'error', message })))
        return
      }

      await runInWorker({
        workerScript: createJavascriptWorkerScript(),
        sourceCode: transpileResult.outputText,
        timeoutMs: 5000,
      })
      return
    }

    if (isPython) {
      await runInWorker({
        workerScript: createPythonWorkerScript(),
        sourceCode: normalized.code,
        timeoutMs: 20000,
      })
      return
    }

    if (isSql) {
      await runSqlCode(normalized.code)
    }
  }, [
    code,
    isJavascript,
    isPython,
    isSql,
    isTypescript,
    resolvedLanguage,
    runInWorker,
    runSqlCode,
  ])

  const runButtonText = useMemo(() => {
    if (!isRunning) {
      if (isPython) {
        return 'Run Python'
      }

      if (isSql) {
        return 'Run SQL'
      }

      if (isTypescript) {
        return 'Run TypeScript'
      }

      return 'Run Code'
    }

    if (isPreparingRuntime) {
      return 'Preparing runtime...'
    }

    return 'Running...'
  }, [isPreparingRuntime, isPython, isRunning, isSql, isTypescript])

  const helperText = useMemo(() => {
    if (isJavascript) {
      return 'JavaScript mode: console output is shown below.'
    }

    if (isTypescript) {
      return 'TypeScript mode: code is transpiled, then run as JavaScript.'
    }

    if (isPython) {
      return 'Python mode: print() output and Python errors are shown below.'
    }

    if (isSql) {
      return 'SQL mode: queries run against an in-memory database for this run only.'
    }

    if (isHtml) {
      return 'HTML mode: your code is rendered in the preview below.'
    }

    return `Runtime is not available for ${prettyLanguageName(resolvedLanguage)} in this frontend-only app.`
  }, [isHtml, isJavascript, isPython, isSql, isTypescript, resolvedLanguage])

  return (
    <section className="border p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold">Run & Output</h2>

        <div className="flex items-center gap-2">
          <label htmlFor="runtime-language" className="text-sm text-slate-700">
            Language
          </label>
          <select
            id="runtime-language"
            className="border p-1.5 text-sm"
            value={selectedLanguage}
            onChange={(event) => setSelectedLanguage(event.target.value)}
            disabled={isRunning}
          >
            {languageChoices.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-sm text-slate-700">
        Detected: {prettyLanguageName(language)}. Active: {prettyLanguageName(resolvedLanguage)}.
      </p>

      <div className="flex gap-2">
        {canRunInConsole ? (
          <button
            type="button"
            className={`${buttonPrimary} ${sizeSm}`}
            onClick={handleRunCode}
            disabled={isRunning}
          >
            {runButtonText}
          </button>
        ) : null}

        <button
          type="button"
          className={`${buttonSecondary} ${sizeSm}`}
          onClick={clearOutput}
          disabled={outputLines.length === 0}
        >
          Clear Output
        </button>
      </div>

      <p className="text-sm text-slate-700">{helperText}</p>

      {canRunInConsole ? (
        <div className="border bg-slate-950 text-slate-100 p-2 min-h-32 max-h-60 overflow-auto text-sm font-mono whitespace-pre-wrap">
          {outputLines.length === 0 ? (
            <p className="text-slate-300">Run your code to see output.</p>
          ) : (
            outputLines.map((line, index) => (
              <p
                key={`${line.type}-${index}`}
                className={
                  line.type === 'error'
                    ? 'text-red-300'
                    : line.type === 'warn'
                      ? 'text-amber-300'
                      : line.type === 'result'
                        ? 'text-sky-300'
                        : 'text-slate-100'
                }
              >
                <strong>{line.type}:</strong> {line.message}
              </p>
            ))
          )}
        </div>
      ) : null}

      {isHtml ? (
        <iframe
          title="HTML preview"
          srcDoc={previewSrcDoc}
          sandbox="allow-scripts"
          className="w-full h-52 border"
        />
      ) : null}
    </section>
  )
}

export default RunConsole
