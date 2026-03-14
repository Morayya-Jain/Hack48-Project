const FOLLOW_UP_REPLY_LIMIT = 5

function toNonNegativeInt(value) {
  const asNumber = Number(value)
  if (!Number.isFinite(asNumber) || asNumber < 0) {
    return 0
  }

  return Math.floor(asNumber)
}

function shouldResetFollowUpThread(replyCount, limit = FOLLOW_UP_REPLY_LIMIT) {
  const safeLimit = Math.max(1, toNonNegativeInt(limit))
  const safeCount = toNonNegativeInt(replyCount)
  return safeCount >= safeLimit
}

function nextFollowUpReplyCount(replyCount, didSucceed) {
  const safeCount = toNonNegativeInt(replyCount)
  if (!didSucceed) {
    return safeCount
  }

  return safeCount + 1
}

export {
  FOLLOW_UP_REPLY_LIMIT,
  nextFollowUpReplyCount,
  shouldResetFollowUpThread,
}
