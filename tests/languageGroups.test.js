import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeLanguageGroups } from '../src/hooks/useGemini.js'

test('normalizeLanguageGroups preserves valid groups', () => {
  const input = [['javascript', 'html'], ['python'], ['java']]
  const result = normalizeLanguageGroups(input)
  assert.deepEqual(result, [['javascript', 'html'], ['python'], ['java']])
})

test('normalizeLanguageGroups returns minimal fallback for empty input', () => {
  const result = normalizeLanguageGroups([])
  assert.deepEqual(result, [['javascript'], ['python']])
})

test('normalizeLanguageGroups returns minimal fallback for null input', () => {
  const result = normalizeLanguageGroups(null)
  assert.deepEqual(result, [['javascript'], ['python']])
})

test('normalizeLanguageGroups returns minimal fallback for non-array input', () => {
  const result = normalizeLanguageGroups('javascript')
  assert.deepEqual(result, [['javascript'], ['python']])
})

test('normalizeLanguageGroups strips invalid language IDs', () => {
  const input = [['javascript', 'fakeLang'], ['python']]
  const result = normalizeLanguageGroups(input)
  assert.deepEqual(result, [['javascript'], ['python']])
})

test('normalizeLanguageGroups removes empty groups after sanitization', () => {
  const input = [['fakeLang1', 'fakeLang2'], ['python']]
  const result = normalizeLanguageGroups(input)
  assert.deepEqual(result, [['python']])
})

test('normalizeLanguageGroups deduplicates identical groups', () => {
  const input = [['javascript', 'html'], ['javascript', 'html'], ['python']]
  const result = normalizeLanguageGroups(input)
  assert.deepEqual(result, [['javascript', 'html'], ['python']])
})

test('normalizeLanguageGroups deduplicates groups regardless of order', () => {
  const input = [['html', 'javascript'], ['javascript', 'html']]
  const result = normalizeLanguageGroups(input)
  assert.equal(result.length, 1)
})

test('normalizeLanguageGroups skips non-array group entries', () => {
  const input = ['javascript', ['python'], null, ['java']]
  const result = normalizeLanguageGroups(input)
  assert.deepEqual(result, [['python'], ['java']])
})

test('normalizeLanguageGroups returns minimal fallback when all groups become empty', () => {
  const input = [['fakeLang'], ['anotherFake']]
  const result = normalizeLanguageGroups(input)
  assert.deepEqual(result, [['javascript'], ['python']])
})
