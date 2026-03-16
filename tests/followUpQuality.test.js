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

test('isLowQualityMentorResponse accepts longer response without actionable verbs', () => {
  const response =
    'The reason your loop is not working is that you are iterating past the array bounds. The array has five elements so valid indices are zero through four.'
  assert.equal(isLowQualityMentorResponse(response, 'Why is my loop broken?'), false)
})

test('isLowQualityMentorResponse rejects very short responses', () => {
  const response = 'Looks good so far'
  assert.equal(isLowQualityMentorResponse(response, 'How is my code?'), true)
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
