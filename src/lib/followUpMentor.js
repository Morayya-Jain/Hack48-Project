function toText(value) {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (value == null) {
    return ''
  }

  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

const BEGINNER_SKILL_LEVELS = new Set(['beginner', 'newbie', 'novice'])
const BEGINNER_SIGNAL_REGEX =
  /\b(i\s*(do not|don't|dont)\s*know|new to|from scratch|basics?|explain (this|that|it)|what does .* mean|no experience|never used)\b/i

function normalizeConversationHistory(feedbackHistory) {
  if (!Array.isArray(feedbackHistory)) {
    return []
  }

  return feedbackHistory
    .map((entry) => {
      const role = entry?.role === 'user' ? 'user' : 'ai'
      const message = toText(entry?.message).trim()
      return { role, message }
    })
    .filter((entry) => entry.message.length > 0)
}

export function shouldUseFoundationFirst(skillLevel, userQuestion, feedbackHistory = []) {
  const normalizedSkillLevel = toText(skillLevel).trim().toLowerCase()
  if (BEGINNER_SKILL_LEVELS.has(normalizedSkillLevel)) {
    return true
  }

  const combinedSignals = [
    toText(userQuestion),
    ...normalizeConversationHistory(feedbackHistory)
      .slice(-4)
      .map((entry) => entry.message),
  ].join('\n')

  return BEGINNER_SIGNAL_REGEX.test(combinedSignals)
}

export function buildFollowUpPrompt({
  task,
  userCode,
  userQuestion,
  feedbackHistory,
  skillLevel,
}) {
  const normalizedHistory = normalizeConversationHistory(feedbackHistory).slice(-8)
  const historyText =
    normalizedHistory.length === 0
      ? 'No prior messages.'
      : normalizedHistory
          .map(
            (entry, index) =>
              `${index + 1}. ${entry.role === 'user' ? 'User' : 'Mentor'}: ${entry.message}`,
          )
          .join('\n')

  const useFoundationFirst = shouldUseFoundationFirst(
    skillLevel,
    userQuestion,
    normalizedHistory,
  )

  const structureRule = useFoundationFirst
    ? `Use this exact structure with labels:
What this means:
Why it matters:
Try this tiny next step:
Define jargon in plain language before using it.`
    : `Use this structure:
Answer:
Try this next step:
Keep it practical and direct.`

  return `You are a coding mentor in an ongoing conversation.
Current task title: ${toText(task?.title)}
Current task description: ${toText(task?.description)}
Current task language: ${toText(task?.language) || 'unspecified'}
User skill level from onboarding: ${toText(skillLevel) || 'unknown'}
User's current code:
${toText(userCode)}
Recent conversation:
${historyText}
User's new question:
${toText(userQuestion)}

Rules:
- Never provide complete working code or a full-file answer.
- If you include code, use fenced triple backticks with language and keep snippets at 6 lines max.
- Tailor your response to the user's current question and code context.
- Foundation-first mode is ${useFoundationFirst ? 'ON' : 'OFF'}.
- ${structureRule}
- Target 120-180 words.
- Start directly with the answer. No greeting or filler.`
}
