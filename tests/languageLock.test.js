import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isFileAllowedByLanguageLock,
  getAllowedExtensions,
} from '../src/lib/projectFiles.js'

test('isFileAllowedByLanguageLock allows everything when languages is null', () => {
  assert.equal(isFileAllowedByLanguageLock('main.js', null), true)
  assert.equal(isFileAllowedByLanguageLock('main.py', null), true)
  assert.equal(isFileAllowedByLanguageLock('style.css', null), true)
})

test('isFileAllowedByLanguageLock allows everything when languages is empty array', () => {
  assert.equal(isFileAllowedByLanguageLock('main.js', []), true)
  assert.equal(isFileAllowedByLanguageLock('main.py', []), true)
})

test('isFileAllowedByLanguageLock blocks disallowed extensions for python lock', () => {
  assert.equal(isFileAllowedByLanguageLock('main.py', ['python']), true)
  assert.equal(isFileAllowedByLanguageLock('main.js', ['python']), false)
  assert.equal(isFileAllowedByLanguageLock('index.html', ['python']), false)
  assert.equal(isFileAllowedByLanguageLock('Main.java', ['python']), false)
})

test('isFileAllowedByLanguageLock allows config files regardless of lock', () => {
  assert.equal(isFileAllowedByLanguageLock('package.json', ['python']), true)
  assert.equal(isFileAllowedByLanguageLock('README.md', ['python']), true)
  assert.equal(isFileAllowedByLanguageLock('notes.txt', ['python']), true)
  assert.equal(isFileAllowedByLanguageLock('.env', ['python']), true)
  assert.equal(isFileAllowedByLanguageLock('.gitignore', ['python']), true)
  assert.equal(isFileAllowedByLanguageLock('config.yml', ['python']), true)
  assert.equal(isFileAllowedByLanguageLock('config.yaml', ['python']), true)
  assert.equal(isFileAllowedByLanguageLock('config.toml', ['python']), true)
})

test('isFileAllowedByLanguageLock allows html + css + js when html is locked', () => {
  const locked = ['html']
  assert.equal(isFileAllowedByLanguageLock('index.html', locked), true)
  assert.equal(isFileAllowedByLanguageLock('style.css', locked), true)
  assert.equal(isFileAllowedByLanguageLock('script.js', locked), true)
  assert.equal(isFileAllowedByLanguageLock('app.jsx', locked), true)
  assert.equal(isFileAllowedByLanguageLock('main.py', locked), false)
})

test('isFileAllowedByLanguageLock works with multiple locked languages', () => {
  const locked = ['javascript', 'typescript']
  assert.equal(isFileAllowedByLanguageLock('main.js', locked), true)
  assert.equal(isFileAllowedByLanguageLock('app.jsx', locked), true)
  assert.equal(isFileAllowedByLanguageLock('main.ts', locked), true)
  assert.equal(isFileAllowedByLanguageLock('main.tsx', locked), true)
  assert.equal(isFileAllowedByLanguageLock('main.py', locked), false)
  assert.equal(isFileAllowedByLanguageLock('Main.java', locked), false)
})

test('isFileAllowedByLanguageLock allows files without extensions', () => {
  assert.equal(isFileAllowedByLanguageLock('Makefile', ['python']), true)
  assert.equal(isFileAllowedByLanguageLock('Dockerfile', ['javascript']), true)
})

test('getAllowedExtensions returns correct set for python', () => {
  const extensions = getAllowedExtensions(['python'])
  assert.ok(extensions.includes('.py'))
  assert.ok(!extensions.includes('.js'))
})

test('getAllowedExtensions returns correct set for html (with implicit companions)', () => {
  const extensions = getAllowedExtensions(['html'])
  assert.ok(extensions.includes('.html'))
  assert.ok(extensions.includes('.htm'))
  assert.ok(extensions.includes('.css'))
  assert.ok(extensions.includes('.js'))
  assert.ok(extensions.includes('.jsx'))
  assert.ok(!extensions.includes('.py'))
})

test('getAllowedExtensions returns empty for null/empty', () => {
  assert.deepEqual(getAllowedExtensions(null), [])
  assert.deepEqual(getAllowedExtensions([]), [])
})

test('getAllowedExtensions combines multiple languages', () => {
  const extensions = getAllowedExtensions(['python', 'javascript'])
  assert.ok(extensions.includes('.py'))
  assert.ok(extensions.includes('.js'))
  assert.ok(extensions.includes('.jsx'))
  assert.ok(!extensions.includes('.ts'))
})
