import test from 'node:test'
import assert from 'node:assert/strict'
import { detectLanguage } from '../src/lib/detectLanguage.js'
import {
  canRunInConsole,
  isPreviewLanguage,
  normalizeRunnableCode,
  resolveRuntimeLanguage,
  sanitizeLanguage,
} from '../src/lib/runtimeUtils.js'

test('detectLanguage routes common snippets correctly', () => {
  assert.equal(detectLanguage('', 'print("hello")'), 'python')
  assert.equal(detectLanguage('', 'SELECT * FROM users;'), 'sql')
  assert.equal(detectLanguage('', 'const x: number = 1'), 'typescript')
  assert.equal(detectLanguage('', '<div>Hello</div>'), 'html')
  assert.equal(detectLanguage('build a react app', 'const x = 1'), 'javascript')
  assert.equal(detectLanguage('build in rust', ''), 'rust')
})

test('resolveRuntimeLanguage honors task lock first', () => {
  assert.equal(
    resolveRuntimeLanguage({
      detectedLanguage: 'javascript',
      selectedLanguage: 'python',
      lockedLanguage: 'sql',
    }),
    'sql',
  )
})

test('resolveRuntimeLanguage supports manual override when unlocked', () => {
  assert.equal(
    resolveRuntimeLanguage({
      detectedLanguage: 'javascript',
      selectedLanguage: 'python',
      lockedLanguage: '',
    }),
    'python',
  )
})

test('sanitizeLanguage rejects unknown values', () => {
  assert.equal(sanitizeLanguage('Python'), 'python')
  assert.equal(sanitizeLanguage('unknown-language'), '')
})

test('normalizeRunnableCode blocks empty and invalid starter values', () => {
  assert.deepEqual(normalizeRunnableCode('', 'python').ok, false)
  assert.deepEqual(normalizeRunnableCode('// Start coding here', 'javascript').ok, false)
  assert.deepEqual(normalizeRunnableCode('// comment', 'python').ok, false)
  assert.deepEqual(normalizeRunnableCode('print("ok")', 'python').ok, true)
})

test('runtime support matrix is explicit', () => {
  assert.equal(canRunInConsole('javascript'), true)
  assert.equal(canRunInConsole('python'), true)
  assert.equal(canRunInConsole('sql'), true)
  assert.equal(canRunInConsole('html'), false)
  assert.equal(isPreviewLanguage('html'), true)
  assert.equal(isPreviewLanguage('python'), false)
})
