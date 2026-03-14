import { useCallback } from 'react'
import { buildFollowUpPrompt } from '../lib/followUpMentor.js'
import {
  INTEREST_OPTIONS,
  SKILL_OPTIONS,
  expertiseLabel,
  labelsForValues,
  normalizeProfile,
} from '../lib/profile.js'
import { sanitizeLanguage } from '../lib/runtimeUtils.js'

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const GEMINI_MODEL_FLASH = 'gemini-2.5-flash'
const GEMINI_MODEL_PRO = 'gemini-2.5-pro'
const TIMEOUT_MS = 15000
const GEMINI_API_KEY = import.meta.env?.VITE_GEMINI_API_KEY?.trim()
const DEFAULT_PROJECT_SKILL_LEVEL = 'intermediate'
const PROJECT_SKILL_LEVELS = new Set(['beginner', 'intermediate', 'advanced'])
const DEFAULT_CLARIFYING_ANSWERS = {
  skillLevelPreference: 'beginner',
  experience: 'Not specified.',
  scope: 'Start with a simple MVP.',
  time: 'Moderate pace.',
}
const STARTER_CONTEXT_KEYWORDS =
  /(command|terminal|run|create|init|install|folder|file|structure|scaffold|entry|index|main|setup|starter|start|first step)/i
const STAGE_ONE_STARTER_FALLBACKS = {
  javascript: {
    description:
      'Start by setting up a small project skeleton and confirming your entry file runs. Create your initial files and verify a basic script can execute before adding features.',
    hint:
      'In your terminal, initialize the project and create the first files (for example, package config and a main entry file). Run a simple starter command to confirm your setup works.',
  },
  typescript: {
    description:
      'Start by creating a basic TypeScript project structure with a clear entry point. Confirm your compiler/tooling can run before implementing feature logic.',
    hint:
      'Set up TypeScript config and an entry file first, then run a compile or dev command to verify the environment is ready.',
  },
  python: {
    description:
      'Start with a clean Python project layout and an entry script. Verify your environment can execute the starter file before building any task-specific behavior.',
    hint:
      'Create a virtual environment, add a starter script, and run it once from the terminal to confirm your setup.',
  },
  html: {
    description:
      'Start by creating the base page structure and identifying where each main section of your UI will live. Keep the first pass minimal so you can build incrementally.',
    hint:
      'Create an `index.html` with basic document structure and placeholder sections, then open it in the browser to validate your starting layout.',
  },
  sql: {
    description:
      'Start by defining the core table structure and relationships needed for the smallest working version. Validate schema creation before writing complex queries.',
    hint:
      'Write and run your initial `CREATE TABLE` statements for the key entities first, then verify the schema exists before adding inserts or joins.',
  },
  default: {
    description:
      'Start with a minimal project scaffold and verify your environment works before building features. Focus on the first executable step and basic file structure.',
    hint:
      'Use one concrete startup action first (create core files or run initial setup command), then confirm it runs so you can iterate safely.',
  },
}

function cleanJsonString(text) {
  return text.replace(/```json/gi, '').replace(/```/g, '').trim()
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

function getGeminiText(data) {
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
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
  const cleaned = cleanJsonString(text)
  const parsed = JSON.parse(cleaned)

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

function normalizeProjectSkillLevel(value) {
  const normalized = toText(value).trim().toLowerCase()
  if (PROJECT_SKILL_LEVELS.has(normalized)) {
    return normalized
  }

  return DEFAULT_PROJECT_SKILL_LEVEL
}

function normalizeModelSkillLevel(value) {
  const normalized = toText(value).trim().toLowerCase()

  if (normalized === 'hard' || normalized === 'master') {
    return 'advanced'
  }

  if (PROJECT_SKILL_LEVELS.has(normalized)) {
    return normalized
  }

  return ''
}

function selectGeminiModel(skillLevel) {
  const normalizedSkillLevel = normalizeModelSkillLevel(skillLevel)
  if (normalizedSkillLevel === 'advanced') {
    return GEMINI_MODEL_PRO
  }

  return GEMINI_MODEL_FLASH
}

function isMissingStarterContext(text) {
  const normalized = toText(text).trim()
  if (!normalized) {
    return true
  }

  if (normalized.length < 60) {
    return true
  }

  return !STARTER_CONTEXT_KEYWORDS.test(normalized)
}

function getStageOneStarterFallback(language) {
  const normalizedLanguage = sanitizeLanguage(language)
  if (normalizedLanguage && STAGE_ONE_STARTER_FALLBACKS[normalizedLanguage]) {
    return STAGE_ONE_STARTER_FALLBACKS[normalizedLanguage]
  }

  return STAGE_ONE_STARTER_FALLBACKS.default
}

function normalizeTaskWithStarterFallback(task, index) {
  const title = toText(task.title) || `Task ${index + 1}`
  const description = toText(task.description)
  const hint = toText(task.hint)
  const exampleOutput = toText(task.exampleOutput)
  const lockedLanguage = sanitizeLanguage(task.language)

  if (index !== 0) {
    return {
      id: task.id || `ai-task-${index + 1}`,
      title,
      description,
      hint,
      exampleOutput,
      language: lockedLanguage,
      completed: false,
      task_index: index,
    }
  }

  const fallback = getStageOneStarterFallback(lockedLanguage)

  return {
    id: task.id || `ai-task-${index + 1}`,
    title,
    description: isMissingStarterContext(description)
      ? fallback.description
      : description,
    hint: isMissingStarterContext(hint) ? fallback.hint : hint,
    exampleOutput,
    language: lockedLanguage,
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

export function parseRoadmapGenerationResult(text) {
  const cleaned = cleanJsonString(text)
  const parsed = JSON.parse(cleaned)

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Roadmap response is not a JSON object.')
  }

  if (!Array.isArray(parsed.tasks)) {
    throw new Error('Roadmap response must include a tasks array.')
  }

  if (parsed.tasks.length !== 6) {
    throw new Error('Roadmap must contain exactly 6 tasks.')
  }

  return {
    skillLevel: normalizeProjectSkillLevel(parsed.skillLevel),
    tasks: parsed.tasks.map((task, index) => normalizeTaskWithStarterFallback(task, index)),
  }
}

async function callGemini(prompt, options = {}) {
  const {
    temperature = 0.5,
    maxOutputTokens = 256,
    model = GEMINI_MODEL_FLASH,
  } = options

  if (!GEMINI_API_KEY) {
    return {
      data: null,
      error: new Error(
        'Missing required environment variable: VITE_GEMINI_API_KEY. Add it in Netlify Site configuration > Environment variables and redeploy.',
      ),
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

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
          generationConfig: {
            temperature,
            maxOutputTokens,
          },
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
      throw new Error(message)
    }

    const data = await response.json()
    const text = getGeminiText(data)

    if (!text) {
      throw new Error('Gemini returned an empty response.')
    }

    return { data: text, error: null }
  } catch (error) {
    if (error.name === 'AbortError') {
      return {
        data: null,
        error: new Error('Request timed out after 15 seconds. Please try again.'),
      }
    }

    return { data: null, error }
  } finally {
    clearTimeout(timeout)
  }
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
Allowed skill levels: beginner, intermediate, advanced.
Use selected skill level preference as the target skillLevel unless it clearly conflicts with project scope.
Always tailor the roadmap tasks intelligently based on project complexity and clarifying context.

Generate a learning roadmap as exactly 6 tasks.
Each task guides the user to implement one specific piece of the project themselves.
Never give complete code solutions in the description or hint fields.
Special Stage 1 requirement:
- Task 1 must explain how to start from zero.
- Task 1 must include at least one practical starter cue: command(s), file/folder structure, or first entry point setup.
- Task 1 should name the first concrete action the learner can execute immediately.
- Keep Stage 1 guidance instructional and partial, never full solution code.

Return ONLY a valid raw JSON object. No markdown, no backticks, no explanation.
Schema:
{
  "skillLevel": "beginner|intermediate|advanced",
  "tasks": [{ "id", "title", "description", "hint", "exampleOutput", "language" }]
}
The language field must be one of: javascript, typescript, python, html, sql, java, csharp, go, rust, ruby, php, swift, kotlin.
Use language only as a task-level lock when clearly appropriate.
The exampleOutput field may contain code as it is shown only when explicitly requested.`
}

export function useGemini() {
  const generateRoadmap = useCallback(async (projectDescription, clarifyingAnswers, profileContext = null) => {
    const basePrompt = buildRoadmapPrompt(
      projectDescription,
      clarifyingAnswers,
      profileContext,
    )
    const model = selectGeminiModel(clarifyingAnswers?.skillLevelPreference)

    const firstAttempt = await callGemini(basePrompt, {
      temperature: 0.7,
      maxOutputTokens: 1024,
      model,
    })
    if (firstAttempt.error) {
      return { data: null, error: firstAttempt.error }
    }

    try {
      const roadmap = parseRoadmapGenerationResult(firstAttempt.data)
      return { data: roadmap, error: null }
    } catch {
      const retryPrompt = `${basePrompt}\nYou must return only raw JSON matching the schema exactly.`
      const secondAttempt = await callGemini(retryPrompt, {
        temperature: 0.7,
        maxOutputTokens: 1024,
        model,
      })

      if (secondAttempt.error) {
        return { data: null, error: secondAttempt.error }
      }

      try {
        const roadmap = parseRoadmapGenerationResult(secondAttempt.data)
        return { data: roadmap, error: null }
      } catch (error) {
        return {
          data: null,
          error: new Error(
            `Could not parse roadmap JSON after retry: ${error.message}`,
          ),
        }
      }
    }
  }, [])

  const checkUserCode = useCallback(
    async (task, userCode, profileContext = null, skillLevel = '') => {
      const exampleOutput = toText(task?.exampleOutput ?? '').trim()
      const profileBlock = buildProfilePromptBlock(profileContext)
      const model = selectGeminiModel(skillLevel)
      const prompt = `You are a strict coding mentor and code evaluator.
Evaluate whether the user's code satisfies the current task and expected output.

Task title: ${toText(task?.title)}
Task description: ${toText(task?.description)}
Expected example output (may be empty): ${exampleOutput || 'N/A'}
${profileBlock}

User code:
${userCode}

Rules:
- Never provide complete working code.
- Be specific and concise.
- If expected example output is provided, check if behavior/output aligns with it.
- If expected example output is not provided, set outputMatch to true and explain that in outputReason.
- Return status PASS only when task requirements are satisfied.
- Return status FAIL if anything required is missing or incorrect.

Return ONLY raw JSON with this exact schema:
{"status":"PASS|FAIL","feedback":"string","outputMatch":true|false,"outputReason":"string"}
No markdown. No extra keys.`

      const firstAttempt = await callGemini(prompt, {
        temperature: 0.2,
        maxOutputTokens: 260,
        model,
      })
      if (firstAttempt.error) {
        return { data: null, error: firstAttempt.error }
      }

      try {
        const parsed = parseCodeCheckResult(firstAttempt.data)
        return { data: parsed, error: null }
      } catch {
        const retryPrompt = `${prompt}\nYou must return only raw JSON matching the schema exactly.`
        const secondAttempt = await callGemini(retryPrompt, {
          temperature: 0.2,
          maxOutputTokens: 260,
          model,
        })

        if (secondAttempt.error) {
          return { data: null, error: secondAttempt.error }
        }

        try {
          const parsed = parseCodeCheckResult(secondAttempt.data)
          return { data: parsed, error: null }
        } catch (error) {
          return {
            data: null,
            error: new Error(
              `Could not parse code check JSON after retry: ${error.message}`,
            ),
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

      const result = await callGemini(prompt, {
        temperature: 0.4,
        maxOutputTokens: 320,
        model,
      })
      if (result.error) {
        return { data: null, error: result.error }
      }

      return { data: result.data, error: null }
    },
    [],
  )

  return {
    generateRoadmap,
    checkUserCode,
    askFollowUp,
  }
}
