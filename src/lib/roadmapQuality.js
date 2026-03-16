function toText(value) {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return ''
}

export const KNOWN_GENERIC_ROADMAP_TITLES = Object.freeze([
  'Set up the project foundation',
  'Define core data and flow',
  'Implement the first MVP feature',
  'Add the second key capability',
  'Handle errors and edge cases',
  'Finalize and verify',
])

export const DETERMINISTIC_PHASE_PREFIXES = Object.freeze([
  'initialize',
  'define',
  'implement',
  'connect',
  'harden',
  'verify',
])

const ROADMAP_REPAIR_ATTEMPT_PREFIX = 'roadmap-auto-repair-attempt:v2:'

export function normalizeRoadmapTitle(value) {
  return toText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function isKnownGenericRoadmapTasks(tasks) {
  if (!Array.isArray(tasks) || tasks.length !== KNOWN_GENERIC_ROADMAP_TITLES.length) {
    return false
  }

  return KNOWN_GENERIC_ROADMAP_TITLES.every(
    (title, index) => normalizeRoadmapTitle(tasks[index]?.title) === normalizeRoadmapTitle(title),
  )
}

export function isDeterministicRoadmapPattern(tasks) {
  if (!Array.isArray(tasks) || tasks.length !== DETERMINISTIC_PHASE_PREFIXES.length) {
    return false
  }

  return DETERMINISTIC_PHASE_PREFIXES.every((prefix, index) =>
    normalizeRoadmapTitle(tasks[index]?.title).startsWith(prefix),
  )
}

const GENERIC_VERBS = new Set([
  'set up', 'implement', 'define', 'create', 'build', 'add', 'handle',
  'connect', 'finalize', 'harden', 'verify', 'initialize', 'configure',
  'integrate', 'establish', 'prepare', 'complete', 'develop', 'design',
])

const GENERIC_VOCABULARY = new Set([
  'core', 'logic', 'structure', 'foundation', 'flow', 'state', 'data',
  'mvp', 'feature', 'capability', 'errors', 'edge', 'cases', 'setup',
  'project', 'interactions', 'updates', 'functionality', 'module',
  'component', 'system', 'basic', 'main', 'primary', 'key', 'second',
  'first', 'final', 'initial', 'app', 'application', 'the', 'and',
  'for', 'with', 'of', 'a', 'an', 'to', 'in', 'on', 'is', 'it',
])

function isGenericTitle(title) {
  const normalized = normalizeRoadmapTitle(title)
  if (!normalized) return true

  let remaining = normalized
  for (const verb of GENERIC_VERBS) {
    if (remaining.startsWith(verb)) {
      remaining = remaining.slice(verb.length).trim()
      break
    }
  }

  const words = remaining.split(/\s+/).filter((w) => w.length > 0)
  if (words.length === 0) return true

  return words.every((word) => GENERIC_VOCABULARY.has(word))
}

export function isLikelyGenericRoadmap(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return false

  const genericCount = tasks.filter((t) => isGenericTitle(t?.title)).length
  return genericCount / tasks.length > 0.5
}

export function shouldAutoRepairRoadmapTasks(tasks) {
  return (
    isKnownGenericRoadmapTasks(tasks) ||
    isDeterministicRoadmapPattern(tasks) ||
    isLikelyGenericRoadmap(tasks)
  )
}

export function getRoadmapRepairAttemptStorageKey(projectId) {
  const normalizedProjectId = toText(projectId).trim()
  if (!normalizedProjectId) {
    return ''
  }

  return `${ROADMAP_REPAIR_ATTEMPT_PREFIX}${normalizedProjectId}`
}

export function hasRoadmapRepairAttempted(storage, projectId) {
  const key = getRoadmapRepairAttemptStorageKey(projectId)
  if (!storage || !key) {
    return false
  }

  try {
    return storage.getItem(key) === '1'
  } catch {
    return false
  }
}

export function markRoadmapRepairAttempted(storage, projectId) {
  const key = getRoadmapRepairAttemptStorageKey(projectId)
  if (!storage || !key) {
    return
  }

  try {
    storage.setItem(key, '1')
  } catch {
    // Ignore storage write issues so roadmap loading can continue.
  }
}
