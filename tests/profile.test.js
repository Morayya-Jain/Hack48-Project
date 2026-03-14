import test from 'node:test'
import assert from 'node:assert/strict'
import {
  expertiseLabel,
  normalizeExpertiseLevel,
  normalizeProfile,
} from '../src/lib/profile.js'

test('normalizeExpertiseLevel keeps canonical values', () => {
  assert.equal(normalizeExpertiseLevel('beginner'), 'beginner')
  assert.equal(normalizeExpertiseLevel('intermediate'), 'intermediate')
  assert.equal(normalizeExpertiseLevel('advanced'), 'advanced')
})

test('normalizeExpertiseLevel maps legacy values', () => {
  assert.equal(normalizeExpertiseLevel('exploring'), 'intermediate')
  assert.equal(normalizeExpertiseLevel('student'), 'intermediate')
  assert.equal(normalizeExpertiseLevel('master'), 'advanced')
})

test('normalizeProfile maps legacy expertise field to canonical values', () => {
  assert.equal(normalizeProfile({ expertise_level: 'student' }).expertiseLevel, 'intermediate')
  assert.equal(normalizeProfile({ expertiseLevel: 'master' }).expertiseLevel, 'advanced')
})

test('expertiseLabel returns canonical labels', () => {
  assert.equal(expertiseLabel('beginner'), 'Beginner')
  assert.equal(expertiseLabel('intermediate'), 'Intermediate')
  assert.equal(expertiseLabel('advanced'), 'Advanced')
})
