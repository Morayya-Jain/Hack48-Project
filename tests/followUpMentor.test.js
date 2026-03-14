import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFollowUpPrompt, shouldUseFoundationFirst } from '../src/lib/followUpMentor.js'

test('shouldUseFoundationFirst enables mode for beginner skill level', () => {
  assert.equal(
    shouldUseFoundationFirst('beginner', 'Can you help me with this loop?', []),
    true,
  )
})

test('shouldUseFoundationFirst enables mode from explicit user signal', () => {
  assert.equal(
    shouldUseFoundationFirst(
      'intermediate',
      "I don't know anything about this language. Please teach me the basics.",
      [],
    ),
    true,
  )
})

test('shouldUseFoundationFirst stays off without beginner signals', () => {
  assert.equal(
    shouldUseFoundationFirst('advanced', 'How can I optimize this function?', []),
    false,
  )
})

test('buildFollowUpPrompt includes foundation-first structure and guardrails', () => {
  const prompt = buildFollowUpPrompt({
    task: {
      title: 'Render a list',
      description: 'Show todos with map() and a key',
      language: 'javascript',
    },
    userCode: 'const todos = []',
    userQuestion: 'I am new to this. Explain what map does.',
    feedbackHistory: [{ role: 'user', message: 'My code does not render.' }],
    skillLevel: 'intermediate',
  })

  assert.match(prompt, /Foundation-first mode is ON/)
  assert.match(prompt, /What this means:/)
  assert.match(prompt, /Why it matters:/)
  assert.match(prompt, /Try this tiny next step:/)
  assert.match(prompt, /Never provide complete working code/)
  assert.match(prompt, /Target 120-180 words/)
})

test('buildFollowUpPrompt can keep foundation-first mode off for advanced context', () => {
  const prompt = buildFollowUpPrompt({
    task: {
      title: 'Optimize API calls',
      description: 'Reduce duplicate network requests',
      language: 'typescript',
    },
    userCode: 'const cache = new Map()',
    userQuestion: 'How should I reduce repeated calls here?',
    feedbackHistory: [{ role: 'ai', message: 'Nice work so far.' }],
    skillLevel: 'advanced',
  })

  assert.match(prompt, /Foundation-first mode is OFF/)
  assert.match(prompt, /Use this structure:\nAnswer:\nTry this next step:/)
})
