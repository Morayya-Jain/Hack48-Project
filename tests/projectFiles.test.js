import test from 'node:test'
import assert from 'node:assert/strict'
import { runtimeLanguageFromPath } from '../src/lib/projectFiles.js'

test('runtimeLanguageFromPath maps core runnable extensions', () => {
  assert.equal(runtimeLanguageFromPath('main.py'), 'python')
  assert.equal(runtimeLanguageFromPath('db/query.sql'), 'sql')
  assert.equal(runtimeLanguageFromPath('src/app.ts'), 'typescript')
  assert.equal(runtimeLanguageFromPath('src/app.tsx'), 'typescript')
  assert.equal(runtimeLanguageFromPath('index.html'), 'html')
  assert.equal(runtimeLanguageFromPath('styles/site.css'), 'html')
  assert.equal(runtimeLanguageFromPath('main.js'), 'javascript')
  assert.equal(runtimeLanguageFromPath('main.mjs'), 'javascript')
})

test('runtimeLanguageFromPath maps additional extensions for syntax/runtime hints', () => {
  assert.equal(runtimeLanguageFromPath('Program.java'), 'java')
  assert.equal(runtimeLanguageFromPath('server/main.go'), 'go')
  assert.equal(runtimeLanguageFromPath('src/lib.rs'), 'rust')
  assert.equal(runtimeLanguageFromPath('script.rb'), 'ruby')
  assert.equal(runtimeLanguageFromPath('index.php'), 'php')
  assert.equal(runtimeLanguageFromPath('Source.swift'), 'swift')
  assert.equal(runtimeLanguageFromPath('build.gradle.kts'), 'kotlin')
  assert.equal(runtimeLanguageFromPath('Program.CS'), 'csharp')
})

test('runtimeLanguageFromPath returns empty for unknown or invalid paths', () => {
  assert.equal(runtimeLanguageFromPath('README'), '')
  assert.equal(runtimeLanguageFromPath('notes.txt'), '')
  assert.equal(runtimeLanguageFromPath('../unsafe.py'), '')
})
