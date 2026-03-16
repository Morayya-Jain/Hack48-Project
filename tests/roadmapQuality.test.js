import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getRoadmapRepairAttemptStorageKey,
  hasRoadmapRepairAttempted,
  isDeterministicRoadmapPattern,
  isKnownGenericRoadmapTasks,
  markRoadmapRepairAttempted,
  normalizeRoadmapTitle,
  shouldAutoRepairRoadmapTasks,
} from '../src/lib/roadmapQuality.js'

function buildGenericTasks() {
  return [
    { title: 'Set up the project foundation' },
    { title: 'Define core data and flow' },
    { title: 'Implement the first MVP feature' },
    { title: 'Add the second key capability' },
    { title: 'Handle errors and edge cases' },
    { title: 'Finalize and verify' },
  ]
}

function buildDeterministicTasks() {
  return [
    { title: 'Initialize calculator project setup' },
    { title: 'Define calculator MVP flow' },
    { title: 'Implement core calculator logic' },
    { title: 'Connect interactions and state' },
    { title: 'Harden calculator edge cases' },
    { title: 'Verify and polish calculator MVP' },
  ]
}

function createMemoryStorage() {
  const values = new Map()
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null
    },
    setItem(key, value) {
      values.set(key, String(value))
    },
  }
}

test('isKnownGenericRoadmapTasks detects the exact legacy generic fallback signature', () => {
  assert.equal(isKnownGenericRoadmapTasks(buildGenericTasks()), true)
})

test('isDeterministicRoadmapPattern detects deterministic phase sequence titles', () => {
  assert.equal(isDeterministicRoadmapPattern(buildDeterministicTasks()), true)
})

test('shouldAutoRepairRoadmapTasks repairs both legacy and deterministic patterns only', () => {
  assert.equal(shouldAutoRepairRoadmapTasks(buildGenericTasks()), true)
  assert.equal(shouldAutoRepairRoadmapTasks(buildDeterministicTasks()), true)
  assert.equal(
    shouldAutoRepairRoadmapTasks([
      { title: 'Design calculator state model' },
      { title: 'Implement parser for arithmetic expressions' },
      { title: 'Handle operator precedence' },
      { title: 'Render calculator UI interactions' },
      { title: 'Add error handling for invalid expressions' },
    ]),
    false,
  )
})

test('normalizeRoadmapTitle normalizes punctuation and casing', () => {
  assert.equal(
    normalizeRoadmapTitle('  Set Up The Project Foundation!  '),
    'set up the project foundation',
  )
})

test('roadmap repair attempt storage helpers only mark once per project key', () => {
  const storage = createMemoryStorage()
  const projectId = 'project-123'

  assert.equal(
    getRoadmapRepairAttemptStorageKey(projectId),
    'roadmap-auto-repair-attempt:v2:project-123',
  )
  assert.equal(hasRoadmapRepairAttempted(storage, projectId), false)
  markRoadmapRepairAttempted(storage, projectId)
  assert.equal(hasRoadmapRepairAttempted(storage, projectId), true)
})
