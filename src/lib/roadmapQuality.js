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

export function shouldAutoRepairRoadmapTasks(tasks) {
  return isKnownGenericRoadmapTasks(tasks) || isDeterministicRoadmapPattern(tasks)
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
