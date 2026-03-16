import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDeterministicFollowUpFallback,
  isLowQualityMentorResponse,
} from '../src/hooks/useGemini.js'

test('isLowQualityMentorResponse flags tautological replies', () => {
  const response = 'What you should do next is do that.'
  assert.equal(isLowQualityMentorResponse(response, 'What should I do next?'), true)
})

test('isLowQualityMentorResponse accepts concrete actionable coaching', () => {
  const response = `Answer:
You still need to wire the equals button to evaluate the current expression.
Try this next step:
Add one click handler for "=" that computes the expression string, updates the display state, and then verify with 12+7 => 19.`

  assert.equal(isLowQualityMentorResponse(response, 'What should I do next?'), false)
})

test('buildDeterministicFollowUpFallback provides concrete task-aware guidance', () => {
  const fallback = buildDeterministicFollowUpFallback(
    {
      title: 'Implement calculator operations',
      description: 'Support +, -, *, and / using current display values.',
      hint: 'Add one operator handler and test each operator with two numbers.',
      exampleOutput: 'Expected result: 8 * 3 shows 24.',
    },
    'What should I do next?',
    'beginner',
  )

  assert.match(fallback, /Try this tiny next step:/i)
  assert.match(fallback, /operator handler|test each operator|manual check/i)
})
