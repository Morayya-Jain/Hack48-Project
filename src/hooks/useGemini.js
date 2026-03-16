import { useCallback } from 'react'
import { buildFollowUpPrompt, isLikelyCasualCheckIn } from '../lib/followUpMentor.js'
import { MENTOR_SNIPPET_MAX_LINES } from '../lib/mentorSnippetGuardrail.js'
import {
  INTEREST_OPTIONS,
  SKILL_OPTIONS,
  expertiseLabel,
  labelsForValues,
  normalizeProfile,
} from '../lib/profile.js'
import { sanitizeProjectTitle } from '../lib/projectTitle.js'
import { shouldAutoRepairRoadmapTasks } from '../lib/roadmapQuality.js'
import { sanitizeLanguage } from '../lib/runtimeUtils.js'

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const GEMINI_MODEL_FLASH = 'gemini-2.5-flash'
const GEMINI_MODEL_PRO = 'gemini-2.5-pro'
const TIMEOUT_MS = 15000
const GEMINI_API_KEY = import.meta.env?.VITE_GEMINI_API_KEY?.trim()
const DEFAULT_PROJECT_SKILL_LEVEL = 'intermediate'
const PROJECT_SKILL_LEVELS = new Set(['beginner', 'intermediate', 'advanced', 'master'])
const MIN_ROADMAP_TASKS = 4
const MAX_ROADMAP_TASKS = 10
const FOLLOW_UP_SUGGESTION_COUNT = 2
const CODE_CHECK_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    status: { type: 'STRING', enum: ['PASS', 'FAIL'] },
    feedback: { type: 'STRING' },
    outputMatch: { type: 'BOOLEAN' },
    outputReason: { type: 'STRING' },
  },
  required: ['status', 'feedback', 'outputMatch', 'outputReason'],
}
const ROADMAP_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    skillLevel: {
      type: 'STRING',
      enum: ['beginner', 'intermediate', 'advanced', 'master'],
    },
    tasks: {
      type: 'ARRAY',
      minItems: MIN_ROADMAP_TASKS,
      maxItems: MAX_ROADMAP_TASKS,
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          title: { type: 'STRING' },
          description: { type: 'STRING' },
          hint: { type: 'STRING' },
          exampleOutput: { type: 'STRING' },
          language: { type: 'STRING' },
        },
        required: ['title', 'description', 'hint', 'exampleOutput'],
      },
    },
  },
  required: ['skillLevel', 'tasks'],
}
const FOLLOW_UP_SUGGESTIONS_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    suggestions: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      minItems: FOLLOW_UP_SUGGESTION_COUNT,
      maxItems: FOLLOW_UP_SUGGESTION_COUNT,
    },
  },
  required: ['suggestions'],
}
const DEFAULT_CLARIFYING_ANSWERS = {
  skillLevelPreference: 'beginner',
  experience: 'Not specified.',
  scope: 'Start with a simple MVP.',
  time: 'Moderate pace.',
}
const LOW_QUALITY_FOLLOW_UP_REGEX =
  /\b(what you should do next is do that|do that|just do it|same as above|as mentioned above|keep doing that|that should do it)\b/i
const ACTIONABLE_FOLLOW_UP_VERB_REGEX =
  /\b(create|add|run|test|verify|check|open|write|update|rename|refactor|import|define|pass|return|log|trace|install|split|extract|replace|move|map|filter)\b/i
const ROADMAP_ATTEMPT_TIMEOUT_MS = 8000
const ROADMAP_FALLBACK_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'app',
  'application',
  'build',
  'for',
  'from',
  'in',
  'is',
  'it',
  'of',
  'on',
  'project',
  'simple',
  'the',
  'to',
  'with',
])

function truncateText(value, maxChars = 700) {
  const text = toText(value)
  if (!text) {
    return ''
  }

  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}...`
}

function cleanJsonString(text) {
  return text.replace(/```json/gi, '').replace(/```/g, '').trim()
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractLooseJsonFieldValues(source, key, nextKey = '') {
  const normalizedSource = toText(source)
  if (!normalizedSource) {
    return []
  }

  const escapedKey = escapeRegExp(key)
  const escapedNextKey = nextKey ? escapeRegExp(nextKey) : ''
  const pattern = nextKey
    ? new RegExp(
        `"${escapedKey}"\\s*:\\s*"([\\s\\S]*?)"\\s*,\\s*"${escapedNextKey}"\\s*:`,
        'gi',
      )
    : new RegExp(`"${escapedKey}"\\s*:\\s*"([\\s\\S]*?)"\\s*(?:,|\\})`, 'gi')

  const values = []
  let match = pattern.exec(normalizedSource)
  while (match) {
    values.push(normalizeLooseJsonString(match[1] || ''))
    match = pattern.exec(normalizedSource)
  }

  return values
}

function extractTaskFieldValues(source, key, nextKey = '') {
  const primaryValues = nextKey
    ? extractLooseJsonFieldValues(source, key, nextKey)
    : []
  if (primaryValues.length > 0) {
    return primaryValues
  }

  return extractLooseJsonFieldValues(source, key)
}

function parseJsonObjectCandidate(text) {
  const cleaned = cleanJsonString(text)
  const candidates = []

  if (cleaned) {
    candidates.push(cleaned)
    candidates.push(cleaned.replace(/,\s*([}\]])/g, '$1'))
  }

  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const sliced = cleaned.slice(firstBrace, lastBrace + 1)
    candidates.push(sliced)
    candidates.push(sliced.replace(/,\s*([}\]])/g, '$1'))
  }

  const uniqueCandidates = Array.from(
    new Set(candidates.map((entry) => entry.trim()).filter(Boolean)),
  )

  let lastError = null
  for (const candidate of uniqueCandidates) {
    try {
      const parsed = JSON.parse(candidate)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed
      }
    } catch (error) {
      lastError = error
    }
  }

  if (lastError) {
    throw lastError
  }

  throw new Error('No JSON object found.')
}

function normalizeLooseJsonString(value) {
  return toText(value)
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .trim()
}

function normalizeFollowUpSuggestion(value, maxChars = 96) {
  let text = toText(value)
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[-*]\s+/, '')
    .replace(/^\d+[.)]\s+/, '')
    .replace(/^(question|suggestion)\s*\d*\s*:\s*/i, '')
    .replace(/^["'`]+/, '')
    .replace(/["'`]+$/, '')
    .trim()

  text = text
    .replace(/\s+\?/g, '?')
    .replace(/\s+([,.;:!])/g, '$1')
    .trim()

  if (/no code was provided for evaluation/i.test(text)) {
    return 'What should I implement first so this task can be evaluated?'
  }

  if (!text || !/[a-z0-9]/i.test(text)) {
    return ''
  }

  if (text.length > maxChars) {
    const slice = text.slice(0, maxChars)
    const lastSpace = slice.lastIndexOf(' ')
    const shortened = (lastSpace > 40 ? slice.slice(0, lastSpace) : slice).trim()
    text = `${shortened}...`
  }

  if (!/[?]$/.test(text)) {
    text = `${text.replace(/[.!]+$/, '').trim()}?`
  }

  return text
}

function compactText(value, maxChars = 240) {
  const normalized = toText(value).replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return ''
  }

  if (normalized.length <= maxChars) {
    return normalized
  }

  return `${normalized.slice(0, maxChars).trim()}...`
}

function collapseText(value) {
  return toText(value).replace(/\s+/g, ' ').trim()
}

function firstSentence(value, fallback = '') {
  const normalized = collapseText(value)
  if (!normalized) {
    return fallback
  }

  const sentenceMatch = normalized.match(/^(.+?[.!?])(\s|$)/)
  if (sentenceMatch?.[1]) {
    return sentenceMatch[1].trim()
  }

  return normalized
}

function normalizeWords(value) {
  return collapseText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function hasActionableFollowUp(text) {
  if (ACTIONABLE_FOLLOW_UP_VERB_REGEX.test(text)) {
    return true
  }

  return /try this|next step|first step|\b1\./i.test(text)
}

export function isLowQualityMentorResponse(responseText, userQuestion = '') {
  const normalizedResponse = collapseText(responseText)
  if (!normalizedResponse) {
    return true
  }

  if (LOW_QUALITY_FOLLOW_UP_REGEX.test(normalizedResponse.toLowerCase())) {
    return true
  }

  if (normalizedResponse.length < 40) {
    return true
  }

  if (!hasActionableFollowUp(normalizedResponse.toLowerCase())) {
    return true
  }

  const responseWords = normalizeWords(normalizedResponse)
  const questionWords = normalizeWords(userQuestion)

  if (responseWords.length === 0 || questionWords.length === 0) {
    return false
  }

  const questionWordSet = new Set(questionWords)
  const overlapCount = responseWords.filter((word) => questionWordSet.has(word)).length
  const overlapRatio = overlapCount / Math.max(1, responseWords.length)
  const lengthsClose = Math.abs(responseWords.length - questionWords.length) <= 4

  if (overlapRatio > 0.72 && lengthsClose) {
    return true
  }

  return false
}

export function buildDeterministicFollowUpFallback(task, userQuestion = '', skillLevel = '') {
  const normalizedSkillLevel = normalizeModelSkillLevel(skillLevel)
  const beginnerMode = normalizedSkillLevel === 'beginner'
  const title = collapseText(task?.title) || 'Current task'
  const description =
    firstSentence(task?.description, '') || 'You are still implementing this task scope.'
  const hint =
    firstSentence(task?.hint, '') ||
    'Start with one tiny change you can validate immediately.'
  const example = firstSentence(task?.exampleOutput, '')
  const questionCue = collapseText(userQuestion)
    ? `Your question was: "${collapseText(userQuestion)}".`
    : ''

  if (beginnerMode) {
    return `What this means:
${description}
Why it matters:
This keeps "${title}" focused and testable without jumping ahead.
Try this tiny next step:
Pick one small action from the hint: ${hint} ${questionCue} Then run a quick manual check and note exactly what changed.`
  }

  return `Answer:
${description} ${questionCue}
Try this next step:
Apply this hint first: ${hint}${example ? ` Then verify against this expected outcome: ${example}` : ' Then verify with one concrete expected outcome and a manual check.'}`
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function isRetryableStatus(status) {
  return status === 429 || status >= 500
}

function isRetryableError(error) {
  if (!error) {
    return false
  }

  if (error.name === 'AbortError') {
    return true
  }

  const message = toText(error.message).toLowerCase()
  return /rate limit|429|timeout|temporar|unavailable|internal|try again/i.test(message)
}

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

export function getGeminiText(data) {
  const candidates = Array.isArray(data?.candidates) ? data.candidates : []
  if (candidates.length === 0) {
    return ''
  }

  const parsedCandidates = candidates.map((candidate) => {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : []
    const text = parts.map((part) => toText(part?.text)).join('').trim()
    const finishReason = toText(candidate?.finishReason).trim().toUpperCase()

    return {
      text,
      textLength: text.length,
      finishReason,
    }
  })

  const nonEmptyCandidates = parsedCandidates.filter((candidate) => candidate.textLength > 0)
  if (nonEmptyCandidates.length === 0) {
    return ''
  }

  const preferredCandidates = nonEmptyCandidates.filter((candidate) => {
    return (
      candidate.finishReason === 'STOP' ||
      candidate.finishReason === 'FINISH_REASON_UNSPECIFIED' ||
      !candidate.finishReason
    )
  })

  const candidatePool = preferredCandidates.length > 0 ? preferredCandidates : nonEmptyCandidates
  const selectedCandidate = candidatePool.reduce((best, candidate) => {
    if (!best || candidate.textLength > best.textLength) {
      return candidate
    }
    return best
  }, null)

  return selectedCandidate?.text || ''
}

function expertiseResponseStyle(expertiseLevel) {
  if (expertiseLevel === 'beginner') {
    return 'Explain from first principles in small steps, define basic terms, and avoid assumptions.'
  }

  if (expertiseLevel === 'intermediate') {
    return 'Use clear practical guidance with short explanations and one concrete next action.'
  }

  if (expertiseLevel === 'advanced') {
    return 'Be concise and technical, focus on tradeoffs, edge cases, and advanced execution detail.'
  }

  if (expertiseLevel === 'master') {
    return 'Be highly concise and technical. Prioritize architecture, performance, reliability, scalability, validation strategy, and explicit tradeoffs.'
  }

  return 'Use balanced coaching with clear, practical guidance.'
}

function buildProfilePromptBlock(profileContext) {
  const normalized = normalizeProfile(profileContext)
  const skillLabels = labelsForValues(normalized.skills, SKILL_OPTIONS)
  const interestLabels = labelsForValues(normalized.interests, INTEREST_OPTIONS)
  const styleGuide = expertiseResponseStyle(normalized.expertiseLevel)

  return `Learner profile:
- Expertise: ${expertiseLabel(normalized.expertiseLevel)}
- Skills to explore: ${skillLabels.length > 0 ? skillLabels.join(', ') : 'None specified'}
- Interests: ${interestLabels.length > 0 ? interestLabels.join(', ') : 'None specified'}

Personalization rules:
- ${styleGuide}
- If skills/interests are provided, bias examples and language toward those areas.
- If skills/interests are missing, keep examples generally relevant and beginner-safe.`
}

function parseCodeCheckResult(text) {
  const parsed = parseJsonObjectCandidate(text)

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Code check response is not a JSON object.')
  }

  const normalizedStatus = toText(parsed.status).trim().toUpperCase()
  if (normalizedStatus !== 'PASS' && normalizedStatus !== 'FAIL') {
    throw new Error('Code check response must include status PASS or FAIL.')
  }

  const feedback = toText(parsed.feedback).trim()
  if (!feedback) {
    throw new Error('Code check response must include non-empty feedback.')
  }

  const normalizedOutputMatch = toText(parsed.outputMatch).trim().toLowerCase()
  if (normalizedOutputMatch !== 'true' && normalizedOutputMatch !== 'false') {
    throw new Error('Code check response must include boolean outputMatch.')
  }

  const outputReason = toText(parsed.outputReason).trim()

  return {
    status: normalizedStatus,
    feedback,
    outputMatch: normalizedOutputMatch === 'true',
    outputReason,
  }
}

export function parseFollowUpSuggestionsResult(text) {
  const parsed = parseJsonObjectCandidate(text)

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Follow-up suggestions response is not a JSON object.')
  }

  if (!Array.isArray(parsed.suggestions)) {
    throw new Error('Follow-up suggestions response must include a suggestions array.')
  }

  if (parsed.suggestions.length !== FOLLOW_UP_SUGGESTION_COUNT) {
    throw new Error(
      `Follow-up suggestions response must include exactly ${FOLLOW_UP_SUGGESTION_COUNT} suggestions.`,
    )
  }

  const normalizedSuggestions = parsed.suggestions.map((entry) =>
    normalizeFollowUpSuggestion(entry),
  )
  if (normalizedSuggestions.some((entry) => entry.length === 0)) {
    throw new Error('Follow-up suggestions response must include non-empty strings.')
  }

  const uniqueCount = new Set(
    normalizedSuggestions.map((entry) => entry.toLowerCase()),
  ).size
  if (uniqueCount !== FOLLOW_UP_SUGGESTION_COUNT) {
    throw new Error('Follow-up suggestions response must include unique suggestions.')
  }

  return normalizedSuggestions
}

export function parseCodeCheckResultLenient(text) {
  const source = cleanJsonString(text)

  const statusMatch =
    source.match(/"status"\s*:\s*"(PASS|FAIL)"/i) ||
    source.match(/\b(PASS|FAIL)\b/i)
  const outputMatchMatch = source.match(/"outputMatch"\s*:\s*(true|false)/i)
  const feedbackMatch =
    source.match(/"feedback"\s*:\s*"([\s\S]*?)"\s*,\s*"outputMatch"/i) ||
    source.match(/"feedback"\s*:\s*"([\s\S]*?)"\s*(?:,|\})/i)
  const outputReasonMatch =
    source.match(/"outputReason"\s*:\s*"([\s\S]*?)"\s*(?:,|\})/i)

  const status = toText(statusMatch?.[1]).trim().toUpperCase()
  const feedback = normalizeLooseJsonString(feedbackMatch?.[1] || '')

  if ((status !== 'PASS' && status !== 'FAIL') || !feedback) {
    throw new Error('Code check response was malformed and could not be recovered.')
  }

  return {
    status,
    feedback,
    outputMatch: toText(outputMatchMatch?.[1]).trim().toLowerCase() === 'true',
    outputReason: normalizeLooseJsonString(outputReasonMatch?.[1] || ''),
  }
}

export function parseFollowUpSuggestionsResultLenient(text) {
  const source = cleanJsonString(text)
  const candidates = []

  for (const line of source.split('\n')) {
    const normalizedLine = line
      .trim()
      .replace(/^[-*]\s+/, '')
      .replace(/^\d+[.)]\s+/, '')
      .replace(/^["']/, '')
      .replace(/["']$/, '')
      .trim()

    if (!normalizedLine) {
      continue
    }

    candidates.push(normalizedLine)
  }

  const questionMatches = source.match(/[^?\n]{6,220}\?/g) || []
  candidates.push(...questionMatches)

  const normalized = []
  const seen = new Set()
  for (const entry of candidates) {
    const collapsed = normalizeFollowUpSuggestion(entry)
    if (collapsed.length < 8) {
      continue
    }
    const question = collapsed

    const key = question.toLowerCase()
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    normalized.push(question)
    if (normalized.length === FOLLOW_UP_SUGGESTION_COUNT) {
      break
    }
  }

  if (normalized.length !== FOLLOW_UP_SUGGESTION_COUNT) {
    throw new Error('Follow-up suggestions response was malformed and could not be recovered.')
  }

  return normalized
}

function buildFallbackFollowUpSuggestions(task, mentorFeedback) {
  const normalizedFeedback = toText(mentorFeedback).toLowerCase()
  const noCodeDetected = /no code was provided|empty submission|no submission|missing code/i.test(
    normalizedFeedback,
  )

  const baseSuggestions = noCodeDetected
    ? [
        'What should I implement first so this task can be evaluated?',
        'Can you give me a tiny first step to start this task?',
      ]
    : [
        'Which one fix should I make first?',
        'How can I quickly verify that fix before checking again?',
      ]

  return baseSuggestions.map((entry) => normalizeFollowUpSuggestion(entry))
}

function normalizeProjectSkillLevel(value) {
  const normalized = toText(value).trim().toLowerCase()
  if (PROJECT_SKILL_LEVELS.has(normalized)) {
    return normalized
  }

  return DEFAULT_PROJECT_SKILL_LEVEL
}

function normalizeModelSkillLevel(value) {
  const normalized = toText(value).trim().toLowerCase()

  if (normalized === 'hard') {
    return 'advanced'
  }

  if (PROJECT_SKILL_LEVELS.has(normalized)) {
    return normalized
  }

  return ''
}

export function selectGeminiModel(skillLevel) {
  const normalizedSkillLevel = normalizeModelSkillLevel(skillLevel)
  if (normalizedSkillLevel === 'advanced' || normalizedSkillLevel === 'master') {
    return GEMINI_MODEL_PRO
  }

  return GEMINI_MODEL_FLASH
}

function normalizeRoadmapField(value) {
  return toText(value).replace(/\s+/g, ' ').trim()
}

function buildRoadmapHintFallback(title, description) {
  const focus = firstSentence(description, title) || title
  return `Implement one small part of "${focus}" first, then run a quick manual check before moving to the next part.`
}

function buildRoadmapExampleFallback(title, description) {
  const focus = firstSentence(description, title) || title
  return `Expected result: a concrete behavior that shows "${focus}" works for at least one sample input/output case.`
}

function normalizeRoadmapTask(task, index) {
  const rawTitle = normalizeRoadmapField(task?.title)
  const rawDescription = normalizeRoadmapField(task?.description)
  const titleFromDescription = firstSentence(rawDescription, '')
    .replace(/[.!?]+$/, '')
    .trim()
  const title = rawTitle || titleFromDescription || `Task ${index + 1}`
  const description =
    rawDescription ||
    `Focus this step on "${title}" with one clear implementation goal and one validation check.`
  const rawHint = normalizeRoadmapField(task?.hint)
  const hint = rawHint || buildRoadmapHintFallback(title, description)
  const rawExampleOutput = normalizeRoadmapField(task?.exampleOutput)
  const exampleOutput =
    rawExampleOutput || buildRoadmapExampleFallback(title, description)
  const language = sanitizeLanguage(task?.language)

  return {
    id: toText(task?.id).trim() || `ai-task-${index + 1}`,
    title,
    description,
    hint,
    exampleOutput,
    language,
    completed: false,
    task_index: index,
  }
}

export function normalizeClarifyingAnswers(clarifyingAnswers) {
  const source =
    clarifyingAnswers && typeof clarifyingAnswers === 'object' ? clarifyingAnswers : {}
  const rawSkillLevelPreference = toText(source.skillLevelPreference).trim().toLowerCase()
  const skillLevelPreference = PROJECT_SKILL_LEVELS.has(rawSkillLevelPreference)
    ? rawSkillLevelPreference
    : DEFAULT_CLARIFYING_ANSWERS.skillLevelPreference

  return {
    skillLevelPreference,
    experience: toText(source.experience).trim() || DEFAULT_CLARIFYING_ANSWERS.experience,
    scope: toText(source.scope).trim() || DEFAULT_CLARIFYING_ANSWERS.scope,
    time: toText(source.time).trim() || DEFAULT_CLARIFYING_ANSWERS.time,
  }
}

function normalizeRoadmapGenerationPayload(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Roadmap response is not a JSON object.')
  }

  if (!Array.isArray(parsed.tasks)) {
    throw new Error('Roadmap response must include a tasks array.')
  }

  if (parsed.tasks.length < MIN_ROADMAP_TASKS) {
    throw new Error(`Roadmap must contain at least ${MIN_ROADMAP_TASKS} tasks.`)
  }

  const normalizedTaskSource = parsed.tasks.slice(0, MAX_ROADMAP_TASKS)
  const roadmapTasks = normalizedTaskSource.map((task, index) =>
    normalizeRoadmapTask(task, index),
  )

  return {
    skillLevel: normalizeProjectSkillLevel(parsed.skillLevel),
    tasks: roadmapTasks,
  }
}

function extractProjectFocusKeywords(projectDescription, maxKeywords = 3) {
  const words = toText(projectDescription)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !ROADMAP_FALLBACK_STOPWORDS.has(word))

  return Array.from(new Set(words)).slice(0, maxKeywords)
}

function buildLocalProjectSpecificRoadmap(projectDescription, clarifyingAnswers) {
  const normalizedAnswers = normalizeClarifyingAnswers(clarifyingAnswers)
  const resolvedSkillLevel = normalizeProjectSkillLevel(normalizedAnswers.skillLevelPreference)
  const projectLabel = firstSentence(projectDescription, 'your project')
  const keywords = extractProjectFocusKeywords(projectDescription)
  const keywordLabel = keywords.length > 0 ? keywords.join(' ') : 'core functionality'

  return normalizeRoadmapGenerationPayload({
    skillLevel: resolvedSkillLevel,
    tasks: [
      {
        id: 'ai-task-1',
        title: `Define ${projectLabel} MVP behavior`,
        description:
          `List the exact user flow and expected outcomes for "${projectLabel}", including one happy path and one edge case.`,
        hint: `Write 3-5 acceptance checks that prove the ${keywordLabel} flow works.`,
        exampleOutput: 'Expected result: clear success criteria for the first MVP slice.',
        language: '',
      },
      {
        id: 'ai-task-2',
        title: `Set up the initial ${projectLabel} structure`,
        description:
          `Create the minimal file/module structure needed to ship the first working version of "${projectLabel}".`,
        hint: `Keep setup lean and focused on enabling the first end-to-end flow.`,
        exampleOutput: 'Expected result: project runs with placeholder wiring for core flow.',
        language: '',
      },
      {
        id: 'ai-task-3',
        title: `Implement core ${keywordLabel} logic`,
        description:
          `Build the main logic layer for "${projectLabel}" so the primary user interaction produces the right result.`,
        hint: 'Implement one small behavior at a time and verify each with a quick manual check.',
        exampleOutput: 'Expected result: primary interaction works for at least one realistic input.',
        language: '',
      },
      {
        id: 'ai-task-4',
        title: `Connect interaction flow and state updates`,
        description:
          `Wire UI/input events to the underlying logic so "${projectLabel}" behaves consistently through the full MVP path.`,
        hint: 'Trace one complete user journey step-by-step and confirm each state transition.',
        exampleOutput: 'Expected result: user can complete the MVP flow without broken transitions.',
        language: '',
      },
      {
        id: 'ai-task-5',
        title: `Harden and verify ${projectLabel}`,
        description:
          `Add validation and error handling for key edge cases, then run a final end-to-end verification pass.`,
        hint: 'Test invalid/boundary input cases and confirm the app fails safely with clear feedback.',
        exampleOutput: 'Expected result: stable MVP behavior with basic edge-case coverage.',
        language: '',
      },
    ],
  })
}

function parseRoadmapGenerationResultStrict(text) {
  const parsed = parseJsonObjectCandidate(text)
  return normalizeRoadmapGenerationPayload(parsed)
}

export function parseRoadmapGenerationResultLenient(text) {
  const source = cleanJsonString(text)
  const titles = extractTaskFieldValues(source, 'title', 'description')
  const descriptions = extractTaskFieldValues(source, 'description', 'hint')
  const hints = extractTaskFieldValues(source, 'hint', 'exampleOutput')
  const exampleOutputs = extractTaskFieldValues(source, 'exampleOutput', 'language')
  const languages = extractTaskFieldValues(source, 'language')
  const ids = extractTaskFieldValues(source, 'id', 'title')

  const taskCount = Math.max(
    titles.length,
    descriptions.length,
    hints.length,
    exampleOutputs.length,
  )
  if (taskCount < MIN_ROADMAP_TASKS) {
    throw new Error('Roadmap response was malformed and could not be recovered.')
  }
  const normalizedTaskCount = Math.min(taskCount, MAX_ROADMAP_TASKS)

  const skillLevelMatch =
    source.match(/"skill[_-]?level"\s*:\s*"(beginner|intermediate|advanced|master|hard)"/i) ||
    source.match(/\b(beginner|intermediate|advanced|master|hard)\b/i)
  const rawSkillLevel = toText(skillLevelMatch?.[1]).trim().toLowerCase()
  const normalizedSkillLevel = normalizeModelSkillLevel(rawSkillLevel) || rawSkillLevel

  const recoveredTasks = Array.from({ length: normalizedTaskCount }, (_, index) => ({
    id: ids[index] || `ai-task-${index + 1}`,
    title: titles[index] || `Task ${index + 1}`,
    description: descriptions[index] || '',
    hint: hints[index] || '',
    exampleOutput: exampleOutputs[index] || '',
    language: languages[index] || '',
  }))

  return normalizeRoadmapGenerationPayload({
    skillLevel: normalizedSkillLevel,
    tasks: recoveredTasks,
  })
}

export function parseRoadmapGenerationResult(text) {
  try {
    return parseRoadmapGenerationResultStrict(text)
  } catch (strictError) {
    try {
      return parseRoadmapGenerationResultLenient(text)
    } catch {
      throw strictError
    }
  }
}

function extractRoadmapOutlineEntries(text) {
  const source = cleanJsonString(text)
  const lines = source.split('\n')
  const entries = []
  const seen = new Set()
  const bulletRegex = /^\s*(?:\d+\s*[).:-]|[-*•])\s+(.+)$/
  let current = ''

  const pushEntry = (value) => {
    const collapsed = collapseText(value)
    if (collapsed.length < 8) {
      return
    }

    const key = collapsed.toLowerCase()
    if (seen.has(key)) {
      return
    }

    seen.add(key)
    entries.push(collapsed)
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      continue
    }

    const bulletMatch = trimmed.match(bulletRegex)
    if (bulletMatch?.[1]) {
      if (current) {
        pushEntry(current)
      }
      current = bulletMatch[1]
      continue
    }

    if (
      current &&
      !trimmed.startsWith('{') &&
      !trimmed.startsWith('}') &&
      !trimmed.startsWith('[') &&
      !trimmed.startsWith(']') &&
      !trimmed.startsWith('"')
    ) {
      current = `${current} ${trimmed}`
    }
  }

  if (current) {
    pushEntry(current)
  }

  if (entries.length >= MIN_ROADMAP_TASKS) {
    return entries
  }

  const paragraphBlocks = source.split(/\n\s*\n/)
  for (const block of paragraphBlocks) {
    const collapsed = collapseText(block)
    if (collapsed.length < 24 || collapsed.length > 360) {
      continue
    }
    if (/[{}[\]]/.test(collapsed)) {
      continue
    }
    pushEntry(collapsed)
    if (entries.length >= MIN_ROADMAP_TASKS) {
      break
    }
  }

  return entries
}

function splitRoadmapOutlineEntry(entry, index) {
  const normalizedEntry = collapseText(entry).replace(/^task\s*\d+\s*[:.-]\s*/i, '')
  let title = ''
  let description = ''

  const separatorIndex = normalizedEntry.indexOf(':')
  if (separatorIndex > 1) {
    const before = normalizedEntry.slice(0, separatorIndex).trim()
    const after = normalizedEntry.slice(separatorIndex + 1).trim()
    if (before.split(/\s+/).length <= 12 && after.length > 0) {
      title = before
      description = after
    }
  }

  if (!title) {
    const sentenceTitle = firstSentence(normalizedEntry, '')
      .replace(/[.!?]+$/, '')
      .trim()
    if (sentenceTitle && sentenceTitle.split(/\s+/).length <= 14) {
      title = sentenceTitle
    }
  }

  if (!title) {
    title = normalizedEntry.split(/\s+/).filter(Boolean).slice(0, 10).join(' ')
  }

  if (!description) {
    description = normalizedEntry
  }

  return {
    id: `ai-task-${index + 1}`,
    title,
    description,
    hint: '',
    exampleOutput: '',
    language: '',
  }
}

export function parseRoadmapFromOutlineText(text, preferredSkillLevel = '') {
  const entries = extractRoadmapOutlineEntries(text)
  if (entries.length < MIN_ROADMAP_TASKS) {
    throw new Error('Roadmap outline recovery failed due to insufficient task entries.')
  }

  const source = cleanJsonString(text)
  const skillLevelMatch = source.match(/\b(beginner|intermediate|advanced|master|hard)\b/i)
  const rawMatchedSkillLevel = toText(skillLevelMatch?.[1]).trim().toLowerCase()
  const normalizedMatchedSkillLevel = normalizeModelSkillLevel(rawMatchedSkillLevel)
  const normalizedPreferredSkillLevel = normalizeModelSkillLevel(preferredSkillLevel)
  const resolvedSkillLevel =
    normalizedMatchedSkillLevel ||
    normalizedPreferredSkillLevel ||
    normalizeProjectSkillLevel(preferredSkillLevel)

  const tasks = entries
    .slice(0, MAX_ROADMAP_TASKS)
    .map((entry, index) => splitRoadmapOutlineEntry(entry, index))

  return normalizeRoadmapGenerationPayload({
    skillLevel: resolvedSkillLevel,
    tasks,
  })
}

async function callGemini(prompt, options = {}) {
  const {
    temperature = 0.5,
    maxOutputTokens = 256,
    model = GEMINI_MODEL_FLASH,
    responseMimeType = null,
    responseSchema = null,
    retryCount = 0,
    timeoutMs = TIMEOUT_MS,
  } = options

  if (!GEMINI_API_KEY) {
    return {
      data: null,
      error: new Error(
        'Missing required environment variable: VITE_GEMINI_API_KEY. Add it in Netlify Site configuration > Environment variables and redeploy.',
      ),
    }
  }

  const maxAttempts = Math.max(1, retryCount + 1)
  const generationConfig = {
    temperature,
    maxOutputTokens,
    ...(responseMimeType ? { responseMimeType } : {}),
    ...(responseSchema ? { responseSchema } : {}),
  }

  let lastError = null

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(
        `${GEMINI_BASE_URL}/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
            generationConfig,
          }),
          signal: controller.signal,
        },
      )

      if (!response.ok) {
        let message = `Gemini request failed (${response.status})`
        try {
          const errorData = await response.json()
          const apiMessage = errorData?.error?.message
          if (apiMessage) {
            message = apiMessage
          }
        } catch {
          // Ignore JSON parse issues for error body.
        }

        const responseError = new Error(message)
        if (attempt < maxAttempts - 1 && isRetryableStatus(response.status)) {
          await sleep(300 * (attempt + 1))
          continue
        }

        throw responseError
      }

      const data = await response.json()
      const text = getGeminiText(data)

      if (!text) {
        throw new Error('Gemini returned an empty response.')
      }

      return { data: text, error: null }
    } catch (error) {
      lastError = error

      if (attempt < maxAttempts - 1 && isRetryableError(error)) {
        await sleep(300 * (attempt + 1))
        continue
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  if (lastError?.name === 'AbortError') {
    return {
      data: null,
      error: new Error(
        `Request timed out after ${Math.max(1, Math.round(timeoutMs / 1000))} seconds. Please try again.`,
      ),
    }
  }

  return { data: null, error: lastError || new Error('Gemini request failed.') }
}

export function buildRoadmapPrompt(projectDescription, clarifyingAnswers, profileContext = null) {
  const normalizedAnswers = normalizeClarifyingAnswers(clarifyingAnswers)
  const profileBlock = buildProfilePromptBlock(profileContext)

  return `You are a coding mentor.
The user wants to build: ${projectDescription}.

Initial clarifying answers:
- Selected skill level preference: ${normalizedAnswers.skillLevelPreference}
- Prior experience: ${normalizedAnswers.experience}
- Smallest MVP scope: ${normalizedAnswers.scope}
- Weekly pace/time commitment: ${normalizedAnswers.time}

${profileBlock}

Infer the project skill level from the user project context.
Allowed skill levels: beginner, intermediate, advanced, master.
Use selected skill level preference as the target skillLevel unless it clearly conflicts with project scope.
Always tailor the roadmap tasks intelligently based on project complexity and clarifying context.

Generate a learning roadmap as 4 to 10 tasks.
Each task guides the user to implement one specific piece of the project themselves.
Never give complete code solutions in the description or hint fields.
Do not use generic phase-only titles such as Initialize, Define, Implement, Connect, Harden, or Verify.
Each task title/description/hint/exampleOutput must be specific to this project goal.

Return ONLY a valid raw JSON object. No markdown, no backticks, no explanation.
Schema:
{
  "skillLevel": "beginner|intermediate|advanced|master",
  "tasks": [{ "id", "title", "description", "hint", "exampleOutput", "language" }]
}
The language field must be one of: javascript, typescript, python, html, sql, java, csharp, go, rust, ruby, php, swift, kotlin.
Use language only as a task-level lock when clearly appropriate.
The exampleOutput field may contain code as it is shown only when explicitly requested.`
}

function buildRoadmapRepairPrompt(
  projectDescription,
  clarifyingAnswers,
  profileContext,
  previousOutput,
  failureReason,
) {
  const normalizedAnswers = normalizeClarifyingAnswers(clarifyingAnswers)
  const profileBlock = buildProfilePromptBlock(profileContext)

  return `You are fixing a failed roadmap response into strict JSON.

Project goal: ${toText(projectDescription)}
Selected skill level preference: ${normalizedAnswers.skillLevelPreference}
Prior experience: ${normalizedAnswers.experience}
MVP scope: ${normalizedAnswers.scope}
Weekly pace: ${normalizedAnswers.time}

${profileBlock}

Failure reason:
${truncateText(failureReason, 500)}

Previous output to repair:
${truncateText(previousOutput, 5000)}

Repair requirements:
- Return only one valid JSON object with keys: skillLevel and tasks.
- tasks must contain ${MIN_ROADMAP_TASKS} to ${MAX_ROADMAP_TASKS} items.
- Every task must include id, title, description, hint, exampleOutput, language.
- Make each task specific to this exact project goal and MVP scope.
- Never use generic phase titles like Initialize, Define, Implement, Connect, Harden, Verify.
- Never return full working code solutions.

Return ONLY JSON. No markdown.`
}

function buildRoadmapOutlinePrompt(projectDescription, clarifyingAnswers, profileContext) {
  const normalizedAnswers = normalizeClarifyingAnswers(clarifyingAnswers)
  const profileBlock = buildProfilePromptBlock(profileContext)

  return `You are a coding mentor.
Project goal: ${toText(projectDescription)}
Selected skill level preference: ${normalizedAnswers.skillLevelPreference}
Experience: ${normalizedAnswers.experience}
MVP scope: ${normalizedAnswers.scope}
Weekly pace: ${normalizedAnswers.time}

${profileBlock}

Return exactly 5 numbered lines.
Each line must be one project-specific task in this format:
1. Task title: one-sentence task description

Rules:
- Keep every line specific to this exact project.
- Do not use generic phase words like Initialize, Define, Implement, Connect, Harden, Verify.
- No markdown blocks. No JSON.
- Do not include full code solutions.`
}

export function buildProjectTitlePrompt(projectDescription) {
  return `You create concise titles for coding projects.

Project description:
${toText(projectDescription)}

Rules:
- Return a plain-text title only.
- Use 3 to 7 words.
- No markdown, no quotes, no numbering, no punctuation-only output.
- No code snippets.
- Keep it specific to the project goal.

Return ONLY the title text.`
}

export function buildCodeCheckPrompt(task, userCode, profileContext = null) {
  const exampleOutput = toText(task?.exampleOutput ?? '').trim()
  const profileBlock = buildProfilePromptBlock(profileContext)

  return `You are a strict coding mentor and code evaluator.
Evaluate whether the user's code satisfies the current task and expected output.

Task title: ${toText(task?.title)}
Task description: ${toText(task?.description)}
Expected example output (may be empty): ${exampleOutput || 'N/A'}
${profileBlock}

User code:
${userCode}

Rules:
- Never provide complete working code or a full-file answer.
- If you include code, keep each snippet at ${MENTOR_SNIPPET_MAX_LINES} lines max and only include minimal illustrative fragments.
- Be specific and concise.
- If expected example output is provided, check if behavior/output aligns with it.
- If expected example output is not provided, set outputMatch to true and explain that in outputReason.
- Return status PASS only when task requirements are satisfied.
- Return status FAIL if anything required is missing or incorrect.

Return ONLY raw JSON with this exact schema:
{"status":"PASS|FAIL","feedback":"string","outputMatch":true|false,"outputReason":"string"}
No markdown. No extra keys.`
}

export function buildFollowUpSuggestionsPrompt(
  task,
  userCode,
  mentorFeedback,
  profileContext = null,
) {
  const normalizedProfile = normalizeProfile(profileContext)
  const expertise = expertiseLabel(normalizedProfile.expertiseLevel)
  const taskTitle = compactText(task?.title, 120) || 'Current task'
  const taskDescription = compactText(task?.description, 280) || 'No description provided.'
  const feedbackSummary = compactText(mentorFeedback, 800)
  const codeExcerpt = compactText(userCode, 280)

  return `You are a coding mentor helping a learner ask strong follow-up questions.

Task title: ${taskTitle}
Task description: ${taskDescription}
Task language: ${toText(task?.language) || 'unspecified'}
Learner expertise: ${expertise}
Mentor feedback from the latest code check:
${feedbackSummary}

Current code excerpt (truncated):
${codeExcerpt || 'N/A'}

Rules:
- Generate exactly ${FOLLOW_UP_SUGGESTION_COUNT} concise follow-up questions.
- Keep each suggestion beginner-friendly and focused on the mentor feedback above.
- Each suggestion must be a single question the learner can ask next.
- Never provide complete working code or a full-file answer.
- Do not include explanations, numbering, or markdown.

Return ONLY raw JSON with this exact schema:
{"suggestions":["question 1","question 2"]}
No markdown. No extra keys.`
}

export function useGemini() {
  const generateRoadmap = useCallback(async (projectDescription, clarifyingAnswers, profileContext = null) => {
    const model = selectGeminiModel(clarifyingAnswers?.skillLevelPreference)
    const normalizedAnswers = normalizeClarifyingAnswers(clarifyingAnswers)

    const callRoadmapAttempt = async (prompt, options = {}) => {
      const useJsonSchema = options.useJsonSchema !== false

      const requestOptions = {
        temperature: options.temperature,
        maxOutputTokens: options.maxOutputTokens,
        model,
        retryCount: 0,
        timeoutMs: ROADMAP_ATTEMPT_TIMEOUT_MS,
      }

      if (useJsonSchema) {
        requestOptions.responseMimeType = 'application/json'
        requestOptions.responseSchema = ROADMAP_RESPONSE_SCHEMA
      }

      return callGemini(prompt, requestOptions)
    }

    try {
      const parseRoadmapCandidate = (responseText) => {
        let parseError = null

        try {
          const roadmap = parseRoadmapGenerationResult(responseText)
          if (shouldAutoRepairRoadmapTasks(roadmap?.tasks)) {
            throw new Error('Roadmap output was generic and needs project-specific task rewriting.')
          }
          return roadmap
        } catch (error) {
          parseError = error
        }

        try {
          const recoveredRoadmap = parseRoadmapFromOutlineText(
            responseText,
            normalizedAnswers.skillLevelPreference,
          )
          if (shouldAutoRepairRoadmapTasks(recoveredRoadmap?.tasks)) {
            throw new Error('Outline recovery produced a generic roadmap.')
          }
          return recoveredRoadmap
        } catch (outlineError) {
          throw new Error(
            `${parseError?.message || 'Roadmap parse failed.'} Outline recovery failed: ${outlineError?.message || 'Unknown issue.'}`,
          )
        }
      }

      const basePrompt = buildRoadmapPrompt(
        projectDescription,
        clarifyingAnswers,
        profileContext,
      )
      const firstAttempt = await callRoadmapAttempt(basePrompt, {
        temperature: 0.55,
        maxOutputTokens: 1200,
      })
      if (firstAttempt.error) {
        return {
          data: null,
          error: firstAttempt.error,
        }
      }

      try {
        const roadmap = parseRoadmapCandidate(firstAttempt.data)
        return { data: roadmap, error: null }
      } catch (firstParseError) {
        const retryPrompt = `${basePrompt}
You must return only raw JSON matching the schema exactly.
Do not use generic phase titles (Initialize, Define, Implement, Connect, Harden, Verify).
Every task must be specific to this project and MVP scope.`
        const secondAttempt = await callRoadmapAttempt(retryPrompt, {
          temperature: 0.35,
          maxOutputTokens: 1200,
        })

        if (secondAttempt.error) {
          return {
            data: null,
            error: secondAttempt.error,
          }
        }

        try {
          const roadmap = parseRoadmapCandidate(secondAttempt.data)
          return { data: roadmap, error: null }
        } catch (secondParseError) {
          const repairPrompt = buildRoadmapRepairPrompt(
            projectDescription,
            clarifyingAnswers,
            profileContext,
            secondAttempt.data || firstAttempt.data,
            secondParseError?.message || firstParseError?.message,
          )
          const repairAttempt = await callRoadmapAttempt(repairPrompt, {
            temperature: 0.25,
            maxOutputTokens: 1000,
          })

          if (repairAttempt.error) {
            return {
              data: null,
              error: repairAttempt.error,
            }
          }

          try {
            const roadmap = parseRoadmapCandidate(repairAttempt.data)
            return { data: roadmap, error: null }
          } catch {
            const outlinePrompt = buildRoadmapOutlinePrompt(
              projectDescription,
              clarifyingAnswers,
              profileContext,
            )
            const outlineAttempt = await callRoadmapAttempt(outlinePrompt, {
              temperature: 0.2,
              maxOutputTokens: 320,
              useJsonSchema: false,
            })

            if (!outlineAttempt.error) {
              try {
                const outlineRoadmap = parseRoadmapFromOutlineText(
                  outlineAttempt.data,
                  clarifyingAnswers?.skillLevelPreference,
                )
                if (shouldAutoRepairRoadmapTasks(outlineRoadmap?.tasks)) {
                  throw new Error('Outline fallback produced a generic roadmap.')
                }
                return { data: outlineRoadmap, error: null }
              } catch {
                // Continue to local fallback roadmap if outline parsing fails.
              }
            }

            const localFallback = buildLocalProjectSpecificRoadmap(
              projectDescription,
              clarifyingAnswers,
            )
            return {
              data: localFallback,
              error: null,
            }
          }
        }
      }
    } catch (error) {
      const message =
        toText(error?.message).trim() || 'Roadmap generation failed due to an unexpected issue.'
      return {
        data: null,
        error: new Error(message),
      }
    }
  }, [])

  const generateProjectTitle = useCallback(async (projectDescription, skillLevel = '') => {
    const prompt = buildProjectTitlePrompt(projectDescription)
    const model = selectGeminiModel(skillLevel)

    const result = await callGemini(prompt, {
      temperature: 0.3,
      maxOutputTokens: 48,
      model,
    })

    if (result.error) {
      return { data: null, error: result.error }
    }

    return {
      data: sanitizeProjectTitle(result.data, projectDescription),
      error: null,
    }
  }, [])

  const checkUserCode = useCallback(
    async (task, userCode, profileContext = null, skillLevel = '') => {
      const model = selectGeminiModel(skillLevel)
      const prompt = buildCodeCheckPrompt(task, userCode, profileContext)

      const firstAttempt = await callGemini(prompt, {
        temperature: 0.2,
        maxOutputTokens: 260,
        model,
        responseMimeType: 'application/json',
        responseSchema: CODE_CHECK_RESPONSE_SCHEMA,
        retryCount: 1,
      })
      if (firstAttempt.error) {
        return { data: null, error: firstAttempt.error }
      }

      try {
        const parsed = parseCodeCheckResult(firstAttempt.data)
        return { data: parsed, error: null }
      } catch {
        try {
          const parsed = parseCodeCheckResultLenient(firstAttempt.data)
          return { data: parsed, error: null }
        } catch {
          // Continue to strict retry before failing.
        }

        const retryPrompt = `${prompt}\nYou must return only raw JSON matching the schema exactly.`
        const secondAttempt = await callGemini(retryPrompt, {
          temperature: 0.2,
          maxOutputTokens: 260,
          model,
          responseMimeType: 'application/json',
          responseSchema: CODE_CHECK_RESPONSE_SCHEMA,
          retryCount: 1,
        })

        if (secondAttempt.error) {
          return { data: null, error: secondAttempt.error }
        }

        try {
          const parsed = parseCodeCheckResult(secondAttempt.data)
          return { data: parsed, error: null }
        } catch (error) {
          try {
            const parsed = parseCodeCheckResultLenient(secondAttempt.data)
            return { data: parsed, error: null }
          } catch {
            return {
              data: null,
              error: new Error(
                `Could not parse code check JSON after retry: ${error.message}`,
              ),
            }
          }
        }
      }
    },
    [],
  )

  const askFollowUp = useCallback(
    async (
      task,
      userCode,
      userQuestion,
      feedbackHistory,
      skillLevel,
      profileContext = null,
    ) => {
      const prompt = buildFollowUpPrompt({
        task,
        userCode,
        userQuestion,
        feedbackHistory,
        skillLevel,
        profileContext,
      })
      const model = selectGeminiModel(skillLevel)
      const casualCheckIn = isLikelyCasualCheckIn(userQuestion)

      const result = await callGemini(prompt, {
        temperature: 0.4,
        maxOutputTokens: 320,
        model,
      })
      if (result.error) {
        return { data: null, error: result.error }
      }

      const firstResponse = toText(result.data).trim()
      if (!firstResponse) {
        return {
          data: buildDeterministicFollowUpFallback(task, userQuestion, skillLevel),
          error: null,
        }
      }

      if (casualCheckIn || !isLowQualityMentorResponse(firstResponse, userQuestion)) {
        return { data: firstResponse, error: null }
      }

      const strictRetryPrompt = `${prompt}
Additional mandatory quality checks:
- Provide one concrete next action the learner can do immediately.
- Tie that action to the current task title/description or current code context.
- Never answer with tautologies like "do that" or "keep doing this".
- Keep guidance specific, practical, and testable.`

      const retryResult = await callGemini(strictRetryPrompt, {
        temperature: 0.2,
        maxOutputTokens: 360,
        model,
      })

      if (!retryResult.error) {
        const retryResponse = toText(retryResult.data).trim()
        if (retryResponse && !isLowQualityMentorResponse(retryResponse, userQuestion)) {
          return { data: retryResponse, error: null }
        }
      }

      return {
        data: buildDeterministicFollowUpFallback(task, userQuestion, skillLevel),
        error: null,
      }
    },
    [],
  )

  const suggestFollowUpQuestions = useCallback(
    async (
      task,
      userCode,
      mentorFeedback,
      skillLevel,
      profileContext = null,
    ) => {
      const prompt = buildFollowUpSuggestionsPrompt(
        task,
        userCode,
        mentorFeedback,
        profileContext,
      )
      const model = selectGeminiModel(skillLevel)
      const fallbackSuggestions = buildFallbackFollowUpSuggestions(task, mentorFeedback)

      const firstAttempt = await callGemini(prompt, {
        temperature: 0.2,
        maxOutputTokens: 140,
        model,
        responseMimeType: 'application/json',
        responseSchema: FOLLOW_UP_SUGGESTIONS_RESPONSE_SCHEMA,
        retryCount: 2,
      })
      if (firstAttempt.error) {
        return { data: fallbackSuggestions, error: null }
      }

      try {
        const parsed = parseFollowUpSuggestionsResult(firstAttempt.data)
        return { data: parsed, error: null }
      } catch {
        try {
          const parsed = parseFollowUpSuggestionsResultLenient(firstAttempt.data)
          return { data: parsed, error: null }
        } catch {
          // Continue to strict retry before failing.
        }

        const retryPrompt = `${prompt}\nYou must return only raw JSON matching the schema exactly.`
        const secondAttempt = await callGemini(retryPrompt, {
          temperature: 0.2,
          maxOutputTokens: 140,
          model,
          responseMimeType: 'application/json',
          responseSchema: FOLLOW_UP_SUGGESTIONS_RESPONSE_SCHEMA,
          retryCount: 2,
        })

        if (secondAttempt.error) {
          return { data: fallbackSuggestions, error: null }
        }

        try {
          const parsed = parseFollowUpSuggestionsResult(secondAttempt.data)
          return { data: parsed, error: null }
        } catch (error) {
          try {
            const parsed = parseFollowUpSuggestionsResultLenient(secondAttempt.data)
            return { data: parsed, error: null }
          } catch {
            console.error(
              'Could not parse follow-up suggestions after retry, using fallback suggestions.',
              error,
            )
            return { data: fallbackSuggestions, error: null }
          }
        }
      }
    },
    [],
  )

  return {
    generateRoadmap,
    generateProjectTitle,
    checkUserCode,
    askFollowUp,
    suggestFollowUpQuestions,
  }
}
