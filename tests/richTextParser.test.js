import test from 'node:test'
import assert from 'node:assert/strict'
import { parseRichTextSegments } from '../src/lib/richTextParser.js'

test('parseRichTextSegments extracts fenced code with language', () => {
  const input = 'Try this:\n```javascript\nconst total = 1 + 2;\nconsole.log(total)\n```\nDone.'
  const segments = parseRichTextSegments(input)

  assert.equal(segments.length, 3)
  assert.deepEqual(segments[0], { type: 'text', content: 'Try this:\n' })
  assert.deepEqual(segments[1], {
    type: 'code',
    language: 'javascript',
    content: 'const total = 1 + 2;\nconsole.log(total)',
  })
  assert.deepEqual(segments[2], { type: 'text', content: '\nDone.' })
})

test('parseRichTextSegments preserves mixed prose and fenced code ordering', () => {
  const input =
    'Step 1: set state.\n\n```ts\nconst [count, setCount] = useState(0)\n```\n\nStep 2: render value.'
  const segments = parseRichTextSegments(input)

  assert.deepEqual(
    segments.map((segment) => segment.type),
    ['text', 'code', 'text'],
  )
  assert.equal(segments[1].language, 'ts')
  assert.match(segments[1].content, /useState/)
})

test('parseRichTextSegments detects unfenced multiline code blocks conservatively', () => {
  const input =
    'Update the loop:\n\nfor (let i = 0; i < 3; i++) {\n  console.log(i)\n}\n\nThen rerun your check.'
  const segments = parseRichTextSegments(input)

  assert.deepEqual(
    segments.map((segment) => segment.type),
    ['text', 'code', 'text'],
  )
  assert.equal(segments[1].content, 'for (let i = 0; i < 3; i++) {\n  console.log(i)\n}')
})

test('parseRichTextSegments keeps single-line code-like text as prose', () => {
  const input = 'Try using const count = 0; before your loop.'
  const segments = parseRichTextSegments(input)

  assert.equal(segments.length, 1)
  assert.deepEqual(segments[0], { type: 'text', content: input })
})

test('parseRichTextSegments passes plain text through unchanged', () => {
  const input = 'No code here. Focus on naming variables more clearly.'
  const segments = parseRichTextSegments(input)

  assert.equal(segments.length, 1)
  assert.deepEqual(segments[0], { type: 'text', content: input })
})

test('parseRichTextSegments does not wrap prose with inline code mentions', () => {
  const input =
    "Try this tiny next step:\nFirst, focus on getting input from the user. Since the language is unspecified, I'll give a general example. Many languages use a function like input() or Scanner to read user input from the console."
  const segments = parseRichTextSegments(input)

  assert.equal(segments.length, 1)
  assert.deepEqual(segments[0], { type: 'text', content: input })
})
