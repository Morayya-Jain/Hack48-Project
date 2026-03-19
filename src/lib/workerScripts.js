const PYODIDE_BASE_URL = import.meta.env.VITE_PYODIDE_BASE_URL?.trim() || ''

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
let currentRunId = null
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
  if (pyodideReadyPromise) {
    const result = await pyodideReadyPromise.catch(() => null)
    if (result) {
      return result
    }
    pyodideReadyPromise = null
  }

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
          batched: (text) => emit(currentRunId, 'log', text),
        })

        pyodide.setStderr({
          batched: (text) => emit(currentRunId, 'stderr', text),
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

  return pyodideReadyPromise
}

self.onmessage = async (event) => {
  const { command, code, runId } = event.data || {}
  if (command !== 'run') {
    return
  }

  currentRunId = runId

  try {
    const pyodide = await getPyodideInstance(runId)

    // Re-bind stdout/stderr to use this run's ID (captured by value via local const)
    const activeRunId = runId
    pyodide.setStdout({
      batched: (text) => emit(activeRunId, 'log', text),
    })
    pyodide.setStderr({
      batched: (text) => emit(activeRunId, 'stderr', text),
    })

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

export { createJavascriptWorkerScript, createPythonWorkerScript, PYODIDE_BASE_URL }
