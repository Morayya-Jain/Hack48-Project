import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeClarifyingAnswers,
  parseRoadmapGenerationResult,
} from '../src/hooks/useGemini.js'

function buildTask(index) {
  return {
    id: `task-${index + 1}`,
    title: `Task ${index + 1}`,
    description: `Description ${index + 1}`,
    hint: `Hint ${index + 1}`,
    exampleOutput: `Example ${index + 1}`,
    language: 'javascript',
  }
}

test('normalizeClarifyingAnswers applies defaults when values are missing', () => {
  assert.deepEqual(normalizeClarifyingAnswers({}), {
    skillLevelPreference: 'none',
    experience: 'Not specified.',
    scope: 'Start with a simple MVP.',
    time: 'Moderate pace.',
  })
})

test('normalizeClarifyingAnswers keeps valid skill preference and normalizes invalid to none', () => {
  assert.equal(
    normalizeClarifyingAnswers({ skillLevelPreference: 'Advanced' }).skillLevelPreference,
    'advanced',
  )
  assert.equal(
    normalizeClarifyingAnswers({ skillLevelPreference: 'guru' }).skillLevelPreference,
    'none',
  )
})

test('parseRoadmapGenerationResult parses a valid roadmap payload', () => {
  const input = JSON.stringify({
    skillLevel: 'advanced',
    tasks: Array.from({ length: 6 }, (_, index) => buildTask(index)),
  })

  const parsed = parseRoadmapGenerationResult(input)
  assert.equal(parsed.skillLevel, 'advanced')
  assert.equal(parsed.tasks.length, 6)
  assert.equal(parsed.tasks[0].task_index, 0)
})

test('parseRoadmapGenerationResult falls back to intermediate for invalid skill level', () => {
  const input = JSON.stringify({
    skillLevel: 'expert-plus',
    tasks: Array.from({ length: 6 }, (_, index) => buildTask(index)),
  })

  const parsed = parseRoadmapGenerationResult(input)
  assert.equal(parsed.skillLevel, 'intermediate')
})

test('parseRoadmapGenerationResult throws when task count is not exactly 6', () => {
  const input = JSON.stringify({
    skillLevel: 'beginner',
    tasks: [buildTask(0)],
  })

  assert.throws(() => parseRoadmapGenerationResult(input), /exactly 6 tasks/i)
})
