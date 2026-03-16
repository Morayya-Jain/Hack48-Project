import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildFollowUpSuggestionsPrompt,
  parseCodeCheckResultLenient,
  parseFollowUpSuggestionsResult,
  parseFollowUpSuggestionsResultLenient,
} from '../src/hooks/useGemini.js'

test('parseFollowUpSuggestionsResult accepts valid two-item suggestions payload', () => {
  const input = JSON.stringify({
    suggestions: [
      'Can you explain which requirement I am missing first?',
      'What is the smallest next fix I should make right now?',
    ],
  })

  const parsed = parseFollowUpSuggestionsResult(input)
  assert.equal(parsed.length, 2)
  assert.equal(parsed[0], 'Can you explain which requirement I am missing first?')
})

test('parseFollowUpSuggestionsResult rejects payload when suggestion count is not exactly two', () => {
  const input = JSON.stringify({
    suggestions: ['Only one question'],
  })

  assert.throws(
    () => parseFollowUpSuggestionsResult(input),
    /exactly 2 suggestions/i,
  )
})

test('parseFollowUpSuggestionsResult rejects empty suggestions', () => {
  const input = JSON.stringify({
    suggestions: ['Valid question?', '   '],
  })

  assert.throws(
    () => parseFollowUpSuggestionsResult(input),
    /non-empty strings/i,
  )
})

test('parseFollowUpSuggestionsResult normalizes no-code wording into concise suggestion', () => {
  const input = JSON.stringify({
    suggestions: [
      'What is the smallest change I should make first to address No code was provided for evaluation in Basic Arithmetic Functions?',
      'How can I quickly verify the fix works before I run Check My Code again?',
    ],
  })

  const parsed = parseFollowUpSuggestionsResult(input)
  assert.equal(parsed[0], 'What should I implement first so this task can be evaluated?')
  assert.match(parsed[1], /how can i quickly verify/i)
})

test('buildFollowUpSuggestionsPrompt includes no-solution guardrail and strict schema', () => {
  const prompt = buildFollowUpSuggestionsPrompt(
    {
      title: 'Set up User Authentication',
      description: 'Create sign-up and login forms with validation.',
      language: 'javascript',
    },
    '<input type="text" name="username" />',
    'You need both sign-up and login forms before this task can pass.',
    null,
  )

  assert.match(prompt, /Never provide complete working code or a full-file answer/i)
  assert.match(prompt, /"suggestions":\["question 1","question 2"\]/i)
  assert.match(prompt, /Generate exactly 2 concise follow-up questions/i)
})

test('parseCodeCheckResultLenient recovers malformed JSON with unescaped quotes in feedback', () => {
  const input =
    '{"status":"FAIL","feedback":"You still need a \\"username\\" and "password" field.","outputMatch":false,"outputReason":"Missing required fields."}'

  const parsed = parseCodeCheckResultLenient(input)
  assert.equal(parsed.status, 'FAIL')
  assert.equal(parsed.outputMatch, false)
  assert.match(parsed.feedback, /username/i)
})

test('parseFollowUpSuggestionsResultLenient recovers plain-text numbered questions', () => {
  const input = `1. What is the smallest change I should make first?
2. Why does this logic fail when the input is empty?`

  const parsed = parseFollowUpSuggestionsResultLenient(input)
  assert.equal(parsed.length, 2)
  assert.equal(parsed[0], 'What is the smallest change I should make first?')
  assert.equal(parsed[1], 'Why does this logic fail when the input is empty?')
})

test('parseFollowUpSuggestionsResultLenient recovers non-question lines by normalizing to questions', () => {
  const input = `1. Explain which requirement is still missing
2. Show me how to verify this step with a quick check`

  const parsed = parseFollowUpSuggestionsResultLenient(input)
  assert.equal(parsed.length, 2)
  assert.equal(parsed[0], 'Explain which requirement is still missing?')
  assert.equal(parsed[1], 'Show me how to verify this step with a quick check?')
})

test('parseCodeCheckResultLenient recovers truncated JSON with no closing quote or brace', () => {
  const input = '{"status":"FAIL","feedback":"Your code is missing the required loop structure that iterates over'

  const parsed = parseCodeCheckResultLenient(input)
  assert.equal(parsed.status, 'FAIL')
  assert.match(parsed.feedback, /missing the required loop/i)
  assert.equal(parsed.outputMatch, false)
})
