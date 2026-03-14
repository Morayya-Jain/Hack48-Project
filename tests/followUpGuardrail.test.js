import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FOLLOW_UP_REPLY_LIMIT,
  nextFollowUpReplyCount,
  shouldResetFollowUpThread,
} from '../src/lib/followUpGuardrail.js'

test('shouldResetFollowUpThread only resets once limit is reached', () => {
  assert.equal(shouldResetFollowUpThread(FOLLOW_UP_REPLY_LIMIT - 1), false)
  assert.equal(shouldResetFollowUpThread(FOLLOW_UP_REPLY_LIMIT), true)
  assert.equal(shouldResetFollowUpThread(FOLLOW_UP_REPLY_LIMIT + 3), true)
})

test('nextFollowUpReplyCount increments only on successful mentor replies', () => {
  assert.equal(nextFollowUpReplyCount(0, true), 1)
  assert.equal(nextFollowUpReplyCount(3, true), 4)
  assert.equal(nextFollowUpReplyCount(3, false), 3)
})

test('guardrail flow resets at 5 and restarts from zero on next send', () => {
  const reachedLimit = 5
  assert.equal(shouldResetFollowUpThread(reachedLimit), true)

  const countAfterResetBeforeSend = 0
  const countAfterFreshSuccessfulReply = nextFollowUpReplyCount(
    countAfterResetBeforeSend,
    true,
  )

  assert.equal(countAfterFreshSuccessfulReply, 1)
})

test('guardrail helpers normalize invalid values safely', () => {
  assert.equal(shouldResetFollowUpThread(-4), false)
  assert.equal(shouldResetFollowUpThread('5'), true)
  assert.equal(nextFollowUpReplyCount('not-a-number', true), 1)
})
