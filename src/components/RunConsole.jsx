import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buttonDanger, buttonPrimary, buttonSecondary, sizeSm } from '../lib/buttonStyles'
import {
  LANGUAGE_CHOICES,
  canRunInConsole,
  isPreviewLanguage,
  normalizeRunnableCode,
  prettyLanguageName,
  resolveRuntimeLanguage,
  sanitizeLanguage,
} from '../lib/runtimeUtils'

const PYODIDE_BASE_URL = import.meta.env.VITE_PYODIDE_BASE_URL?.trim() || ''

let sqlRuntimePromise = null

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
  const { command, code, runId } = event.data || {}
  if (command !== 'run') {
    return
  }

  const emit = (type, text) => self.postMessage({ runId, type, text })
  const proxyConsole = {
    log: (...args) => emit('log', args.map(formatValue).join(' ')),
    info: (...args) => emit('info', args.map(formatValue).join(' ')),
    warn: (...args) => emit('warn', args.map(formatValue).join(' ')),
    error: (...args) => emit('stderr', args.map(formatValue).join(' ')),
  }

  const originalConsole = self.console
  self.console = proxyConsole

  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
    const runUserCode = new AsyncFunction(code || '')
    const result = await runUserCode()

    if (typeof result !== 'undefined') {
      emit('result', formatValue(result))
    }

    emit('done', 'Execution finished.')
  } catch (error) {
    emit('runtime_error', error?.stack || error?.message || String(error))
  } finally {
    self.console = originalConsole
  }
}
`
}

function createPythonWorkerScript(preferredBaseUrl) {
  return `
let pyodideReadyPromise = null
const preferredBaseUrl = ${JSON.stringify(preferredBaseUrl || '')}

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

const emit = (runId, type, text) => self.postMessage({ runId, type, text })

function normalizeBase(url) {
  if (!url) {
    return ''
  }

  return url.endsWith('/') ? url : url + '/'
}

async function getPyodideInstance(runId) {
  if (!pyodideReadyPromise) {
    pyodideReadyPromise = (async () => {
      const candidates = [
        normalizeBase(preferredBaseUrl),
        normalizeBase(self.location.origin + '/pyodide/'),
        'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/',
        'https://unpkg.com/pyodide@0.27.7/',
      ].filter(Boolean)

      const uniqueCandidates = []
      candidates.forEach((candidate) => {
        if (!uniqueCandidates.includes(candidate)) {
          uniqueCandidates.push(candidate)
        }
      })

      let lastError = null

      for (const base of uniqueCandidates) {
        try {
          emit(runId, 'info', 'Preparing Python runtime...')
          importScripts(base + 'pyodide.js')
          const pyodide = await loadPyodide({ indexURL: base })

          pyodide.setStdout({
            batched: (text) => emit(runId, 'log', text),
          })

          pyodide.setStderr({
            batched: (text) => emit(runId, 'stderr', text),
          })

          emit(runId, 'info', 'Python runtime ready.')
          return pyodide
        } catch (error) {
          lastError = error
        }
      }

      throw new Error(
        lastError?.message ||
          'Could not load Python runtime from local or CDN sources.',
      )
    })()
  }

  return pyodideReadyPromise
}

self.onmessage = async (event) => {
  const { command, code, runId } = event.data || {}
  if (command !== 'run') {
    return
  }

  try {
    const pyodide = await getPyodideInstance(runId)
    const result = await pyodide.runPythonAsync(code || '')

    if (typeof result !== 'undefined' && result !== null) {
      emit(
        runId,
        'result',
        formatValue(result.toString ? result.toString() : result),
      )
    }

    emit(runId, 'done', 'Execution finished.')
  } catch (error) {
    emit(runId, 'runtime_error', error?.message || String(error))
  }
}
`
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

function RunConsole({ code, detectedLanguage, lockedLanguage = '', onRunPreview }) {
  const [selectedLanguage, setSelectedLanguage] = useState('auto')
  const [outputLines, setOutputLines] = useState([])
  const [isRunning, setIsRunning] = useState(false)
  const [isPreparingRuntime, setIsPreparingRuntime] = useState(false)

  const isMountedRef = useRef(true)
  const workersRef = useRef({ javascript: null, python: null })
  const pendingWorkerRunRef = useRef(null)
  const sqlCancelTokenRef = useRef(null)
  const runCounterRef = useRef(0)

  const normalizedLockedLanguage = sanitizeLanguage(lockedLanguage)
  const resolvedLanguage = resolveRuntimeLanguage({
    detectedLanguage,
    selectedLanguage,
    lockedLanguage: normalizedLockedLanguage,
  })

  const isJavascript = resolvedLanguage === 'javascript'
  const isTypescript = resolvedLanguage === 'typescript'
  const isPython = resolvedLanguage === 'python'
  const isSql = resolvedLanguage === 'sql'
  const isHtml = isPreviewLanguage(resolvedLanguage)
  const isConsoleRunnable = canRunInConsole(resolvedLanguage)
  const canTriggerPreview = isHtml && typeof onRunPreview === 'function'

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

  const terminateWorker = useCallback((kind) => {
    const worker = workersRef.current[kind]
    if (!worker) {
      return
    }

    worker.terminate()
    workersRef.current[kind] = null
  }, [])

  const finishWorkerRun = useCallback((kind, runId) => {
    const pending = pendingWorkerRunRef.current

    if (!pending || pending.kind !== kind || pending.runId !== runId) {
      return
    }

    clearTimeout(pending.timeoutId)
    pendingWorkerRunRef.current = null

    if (!isMountedRef.current) {
      return
    }

    setIsRunning(false)
    setIsPreparingRuntime(false)
  }, [])

  const createWorker = useCallback(
    (kind) => {
      const script =
        kind === 'python'
          ? createPythonWorkerScript(PYODIDE_BASE_URL)
          : createJavascriptWorkerScript()

      const workerBlob = new Blob([script], {
        type: 'application/javascript',
      })

      const workerUrl = URL.createObjectURL(workerBlob)
      const worker = new Worker(workerUrl)
      URL.revokeObjectURL(workerUrl)

      worker.onmessage = (event) => {
        const { runId, type, text } = event.data || {}
        const pending = pendingWorkerRunRef.current

        if (!pending || pending.kind !== kind || pending.runId !== runId) {
          return
        }

        const normalizedText = toText(text)
        appendLine(type || 'log', normalizedText)

        const lowerText = normalizedText.toLowerCase()
        if (type === 'info' && lowerText.includes('preparing')) {
          setIsPreparingRuntime(true)
        }

        if (type === 'info' && lowerText.includes('ready')) {
          setIsPreparingRuntime(false)
        }

        if (type === 'done' || type === 'runtime_error') {
          finishWorkerRun(kind, runId)
        }
      }

      worker.onerror = (event) => {
        const pending = pendingWorkerRunRef.current

        if (!pending || pending.kind !== kind) {
          return
        }

        appendLine('runtime_error', event.message || 'Worker runtime error.')
        terminateWorker(kind)
        finishWorkerRun(kind, pending.runId)
      }

      workersRef.current[kind] = worker
      return worker
    },
    [appendLine, finishWorkerRun, terminateWorker],
  )

  const getWorker = useCallback(
    (kind) => {
      const existing = workersRef.current[kind]
      if (existing) {
        return existing
      }

      return createWorker(kind)
    },
    [createWorker],
  )

  const runInWorker = useCallback(
    async ({ kind, sourceCode, timeoutMs }) => {
      if (pendingWorkerRunRef.current) {
        return
      }

      try {
        setIsRunning(true)
        setIsPreparingRuntime(kind === 'python')
        setOutputLines([])

        const worker = getWorker(kind)
        const runId = runCounterRef.current + 1
        runCounterRef.current = runId

        const timeoutId = window.setTimeout(() => {
          const pending = pendingWorkerRunRef.current

          if (!pending || pending.kind !== kind || pending.runId !== runId) {
            return
          }

          appendLine(
            'runtime_error',
            `Execution timed out after ${timeoutMs / 1000} seconds.`,
          )
          terminateWorker(kind)
          finishWorkerRun(kind, runId)
        }, timeoutMs)

        pendingWorkerRunRef.current = {
          kind,
          runId,
          timeoutId,
        }

        worker.postMessage({
          command: 'run',
          runId,
          code: sourceCode || '',
        })
      } catch (error) {
        appendLine('runtime_error', error.message || 'Could not start runtime worker.')
        setIsRunning(false)
        setIsPreparingRuntime(false)
      }
    },
    [appendLine, finishWorkerRun, getWorker, terminateWorker],
  )

  const runSqlCode = useCallback(
    async (sourceCode) => {
      if (sqlCancelTokenRef.current && !sqlCancelTokenRef.current.cancelled) {
        return
      }

      const token = {
        id: runCounterRef.current + 1,
        cancelled: false,
      }
      runCounterRef.current = token.id
      sqlCancelTokenRef.current = token

      setIsRunning(true)
      setIsPreparingRuntime(true)
      setOutputLines([])

      let db = null

      try {
        appendLine('info', 'Preparing SQL runtime...')
        const SQL = await getSqlRuntime()

        if (token.cancelled) {
          appendLine('warn', 'SQL execution stopped.')
          return
        }

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

        for (let index = 0; index < statements.length; index += 1) {
          if (token.cancelled) {
            appendLine('warn', 'SQL execution stopped.')
            break
          }

          const statement = statements[index]

          try {
            const sql = `${statement};`
            const resultSets = db.exec(sql)

            if (resultSets.length === 0) {
              appendLine('info', `Statement ${index + 1} executed successfully.`)
              continue
            }

            resultSets.forEach((resultSet, resultIndex) => {
              appendLine(
                'result',
                `Statement ${index + 1}, Result ${resultIndex + 1}:\n${formatSqlResultSet(resultSet)}`,
              )
            })
          } catch (error) {
            appendLine(
              'runtime_error',
              `Statement ${index + 1} failed: ${error.message || 'Unknown SQL error.'}`,
            )
          }
        }
      } catch (error) {
        appendLine('runtime_error', error.message || 'Could not run SQL code.')
      } finally {
        if (db) {
          db.close()
        }

        if (sqlCancelTokenRef.current?.id === token.id) {
          sqlCancelTokenRef.current = null
        }

        if (isMountedRef.current) {
          setIsRunning(false)
          setIsPreparingRuntime(false)
        }
      }
    },
    [appendLine],
  )

  const handleStopExecution = useCallback(() => {
    let didStop = false

    const pending = pendingWorkerRunRef.current
    if (pending) {
      clearTimeout(pending.timeoutId)
      pendingWorkerRunRef.current = null
      terminateWorker(pending.kind)
      didStop = true
    }

    if (sqlCancelTokenRef.current && !sqlCancelTokenRef.current.cancelled) {
      sqlCancelTokenRef.current.cancelled = true
      didStop = true
    }

    if (didStop) {
      appendLine('warn', 'Execution stopped by user.')
      setIsRunning(false)
      setIsPreparingRuntime(false)
    }
  }, [appendLine, terminateWorker])

  const handleRunCode = useCallback(async () => {
    try {
      if (canTriggerPreview) {
        await onRunPreview()
        setOutputLines([
          {
            type: 'info',
            message: 'Preview refreshed.',
          },
        ])
        return
      }

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
          kind: 'javascript',
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
          setOutputLines(diagnostics.map((message) => ({ type: 'runtime_error', message })))
          return
        }

        await runInWorker({
          kind: 'javascript',
          sourceCode: transpileResult.outputText,
          timeoutMs: 5000,
        })
        return
      }

      if (isPython) {
        await runInWorker({
          kind: 'python',
          sourceCode: normalized.code,
          timeoutMs: 20000,
        })
        return
      }

      if (isSql) {
        await runSqlCode(normalized.code)
      }
    } catch (error) {
      setOutputLines([
        {
          type: 'runtime_error',
          message: error.message || 'Could not run code.',
        },
      ])
      setIsRunning(false)
      setIsPreparingRuntime(false)
    }
  }, [
    code,
    isJavascript,
    canTriggerPreview,
    isPython,
    isSql,
    isTypescript,
    resolvedLanguage,
    onRunPreview,
    runInWorker,
    runSqlCode,
  ])

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false

      const pending = pendingWorkerRunRef.current
      if (pending) {
        clearTimeout(pending.timeoutId)
      }

      pendingWorkerRunRef.current = null

      if (sqlCancelTokenRef.current) {
        sqlCancelTokenRef.current.cancelled = true
      }

      terminateWorker('javascript')
      terminateWorker('python')
    }
  }, [terminateWorker])

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

      if (canTriggerPreview) {
        return 'Refresh Preview'
      }

      return 'Run Code'
    }

    if (isPreparingRuntime) {
      return 'Preparing runtime...'
    }

    return 'Running...'
  }, [canTriggerPreview, isPreparingRuntime, isPython, isRunning, isSql, isTypescript])

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
            disabled={isRunning || Boolean(normalizedLockedLanguage)}
          >
            {LANGUAGE_CHOICES.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-sm text-slate-700">
        Detected: {prettyLanguageName(detectedLanguage)}. Active: {prettyLanguageName(resolvedLanguage)}.
      </p>

      {normalizedLockedLanguage ? (
        <p className="text-sm text-slate-700">
          This task is language-locked to {prettyLanguageName(normalizedLockedLanguage)}.
        </p>
      ) : null}

      <div className="flex gap-2">
        {isConsoleRunnable || canTriggerPreview ? (
          <button
            type="button"
            className={`${buttonPrimary} ${sizeSm}`}
            onClick={handleRunCode}
            disabled={isRunning}
          >
            {runButtonText}
          </button>
        ) : null}

        {isRunning ? (
          <button
            type="button"
            className={`${buttonDanger} ${sizeSm}`}
            onClick={handleStopExecution}
          >
            Stop
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

      {isConsoleRunnable ? (
        <div className="border bg-slate-950 text-slate-100 p-2 min-h-32 max-h-60 overflow-auto text-sm font-mono whitespace-pre-wrap">
          {outputLines.length === 0 ? (
            <p className="text-slate-300">Run your code to see output.</p>
          ) : (
            outputLines.map((line, index) => (
              <p
                key={`${line.type}-${index}`}
                className={
                  line.type === 'runtime_error' || line.type === 'stderr'
                    ? 'text-red-300'
                    : line.type === 'warn'
                      ? 'text-amber-300'
                      : line.type === 'result'
                        ? 'text-emerald-300'
                        : 'text-slate-100'
                }
              >
                <strong>{line.type}:</strong> {line.message}
              </p>
            ))
          )}
        </div>
      ) : null}
    </section>
  )
}

export default RunConsole
