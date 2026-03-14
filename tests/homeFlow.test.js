import test from 'node:test'
import assert from 'node:assert/strict'
import {
  deriveSkillBadge,
  deriveWelcomeName,
  getStarterTemplate,
  STARTER_PROMPT_CARDS,
} from '../src/lib/homeFlow.js'

test('getStarterTemplate returns templates for all configured cards', () => {
  for (const card of STARTER_PROMPT_CARDS) {
    const template = getStarterTemplate(card.id)
    assert.equal(typeof template, 'string')
    assert.equal(template.length > 0, true)
  }
})

test('getStarterTemplate returns empty string for unknown card id', () => {
  assert.equal(getStarterTemplate('missing-card'), '')
})

test('deriveWelcomeName prefers full_name metadata then email prefix then Builder', () => {
  assert.equal(
    deriveWelcomeName({ user_metadata: { full_name: 'Morayya Jain' }, email: 'user@example.com' }),
    'Morayya Jain',
  )
  assert.equal(
    deriveWelcomeName({ user_metadata: { name: 'Google User' }, email: 'user@example.com' }),
    'Google User',
  )
  assert.equal(
    deriveWelcomeName({ user_metadata: { username: 'LegacyName' }, email: 'user@example.com' }),
    'LegacyName',
  )
  assert.equal(
    deriveWelcomeName({ user_metadata: {}, email: 'builder@example.com' }),
    'builder',
  )
  assert.equal(deriveWelcomeName({ user_metadata: {}, email: '' }), 'Builder')
  assert.equal(deriveWelcomeName(null), 'Builder')
})

test('deriveSkillBadge maps expertise levels to badge labels', () => {
  assert.equal(deriveSkillBadge({ expertiseLevel: 'beginner' }), 'Beginner')
  assert.equal(deriveSkillBadge({ expertiseLevel: 'intermediate' }), 'Intermediate')
  assert.equal(deriveSkillBadge({ expertiseLevel: 'advanced' }), 'Advanced')
  assert.equal(deriveSkillBadge({ expertise_level: 'exploring' }), 'Intermediate')
  assert.equal(deriveSkillBadge({ expertiseLevel: 'student' }), 'Intermediate')
  assert.equal(deriveSkillBadge({ expertiseLevel: 'master' }), 'Advanced')
  assert.equal(deriveSkillBadge({ expertiseLevel: 'unknown' }), 'Beginner')
  assert.equal(deriveSkillBadge(null), 'Beginner')
})
