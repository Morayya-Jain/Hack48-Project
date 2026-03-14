import {
  INTEREST_OPTIONS,
  SKILL_OPTIONS,
  expertiseLabel,
  labelsForValues,
  normalizeProfile,
} from './profile.js'

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
const TECHNICAL_SIGNAL_REGEX =
  /[`{}()[\];]|=>|==|===|\b(code|bug|error|fix|function|class|loop|array|object|variable|api|query|database|sql|react|component|javascript|typescript|python|java|html|css|node|console|output|task|step|implement|build|debug|refactor|optimize|algorithm|syntax|compile|runtime|test)\b/i
const CASUAL_WORDS = new Set([
  'hi',
  'hello',
  'hey',
  'yo',
  'sup',
  'thanks',
  'thank',
  'thx',
  'ok',
  'okay',
  'cool',
  'nice',
  'great',
  'awesome',
])
const CASUAL_TRAILING_WORDS = new Set(['there', 'mentor', 'team', 'mate', 'friend'])
const CASUAL_PHRASE_REGEX =
  /^(good\s+(morning|afternoon|evening)|how are you|what'?s up|all good)$/i

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

function normalizeWordToken(token) {
  return token.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '').toLowerCase()
}

export function isLikelyCasualCheckIn(userQuestion) {
  const normalizedQuestion = toText(userQuestion).trim()
  if (!normalizedQuestion) {
    return false
  }

  if (TECHNICAL_SIGNAL_REGEX.test(normalizedQuestion)) {
    return false
  }

  const collapsed = normalizedQuestion.replace(/\s+/g, ' ').trim().toLowerCase()
  if (CASUAL_PHRASE_REGEX.test(collapsed)) {
    return true
  }

  const words = collapsed
    .split(' ')
    .map(normalizeWordToken)
    .filter(Boolean)
  if (words.length === 0 || words.length > 3) {
    return false
  }

  if (CASUAL_WORDS.has(words[0])) {
    const trailingWords = words.slice(1)
    if (trailingWords.every((word) => CASUAL_WORDS.has(word) || CASUAL_TRAILING_WORDS.has(word))) {
      return true
    }
  }

  return words.every((word) => CASUAL_WORDS.has(word))
}

function expertiseResponseStyle(expertiseLevel) {
  if (expertiseLevel === 'beginner') {
    return 'Explain from first principles and keep the next step very small.'
  }

  if (expertiseLevel === 'exploring') {
    return 'Keep explanations practical and concise, then suggest one focused next action.'
  }

  if (expertiseLevel === 'student') {
    return 'Use structured explanation with reasoning and one implementation checkpoint.'
  }

  if (expertiseLevel === 'master') {
    return 'Respond concisely with technical precision and highlight tradeoffs or edge cases.'
  }

  return 'Use practical coaching language and keep guidance actionable.'
}

export function shouldUseFoundationFirst(
  skillLevel,
  userQuestion,
  feedbackHistory = [],
  profileContext = null,
) {
  const normalizedProfile = normalizeProfile(profileContext)

  if (normalizedProfile.expertiseLevel === 'beginner') {
    return true
  }

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
  profileContext,
}) {
  const normalizedHistory = normalizeConversationHistory(feedbackHistory).slice(-8)
  const normalizedProfile = normalizeProfile(profileContext)
  const skillLabels = labelsForValues(normalizedProfile.skills, SKILL_OPTIONS)
  const interestLabels = labelsForValues(normalizedProfile.interests, INTEREST_OPTIONS)
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
    normalizedProfile,
  )
  const useCasualCheckInMode = isLikelyCasualCheckIn(userQuestion)

  const structureRule = useCasualCheckInMode
    ? `Use this exact structure with labels:
Reply:
Clarifying question:
Keep it warm, short, and conversational.
Do not infer missing code or invent requirements from a casual message.`
    : useFoundationFirst
      ? `Use this exact structure with labels:
What this means:
Why it matters:
Try this tiny next step:
Define jargon in plain language before using it.`
      : `Use this structure:
Answer:
Try this next step:
Keep it practical and direct.`
  const targetWordRule = useCasualCheckInMode ? 'Target 30-80 words.' : 'Target 120-180 words.'
  const openingRule = useCasualCheckInMode
    ? 'A short greeting is allowed when it matches the user tone.'
    : 'Start directly with the answer. No greeting or filler.'
  const foundationModeLabel = useCasualCheckInMode
    ? 'PAUSED (waiting for a specific coding question)'
    : useFoundationFirst
      ? 'ON'
      : 'OFF'

  return `You are a coding mentor in an ongoing conversation.
Current task title: ${toText(task?.title)}
Current task description: ${toText(task?.description)}
Current task language: ${toText(task?.language) || 'unspecified'}
User skill level from onboarding: ${toText(skillLevel) || 'unknown'}
Profile expertise level: ${expertiseLabel(normalizedProfile.expertiseLevel)}
Profile skills to explore: ${skillLabels.length > 0 ? skillLabels.join(', ') : 'None specified'}
Profile interests: ${interestLabels.length > 0 ? interestLabels.join(', ') : 'None specified'}
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
- ${expertiseResponseStyle(normalizedProfile.expertiseLevel)}
- If profile skills/interests are available, use relevant examples.
- Casual check-in mode is ${useCasualCheckInMode ? 'ON' : 'OFF'}.
- Foundation-first mode is ${foundationModeLabel}.
- ${structureRule}
- ${targetWordRule}
- ${openingRule}`
}
