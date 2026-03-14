import { useCallback } from 'react'
import { buildFollowUpPrompt } from '../lib/followUpMentor.js'
import {
  INTEREST_OPTIONS,
  SKILL_OPTIONS,
  expertiseLabel,
  labelsForValues,
  normalizeProfile,
} from '../lib/profile'
import { sanitizeLanguage } from '../lib/runtimeUtils.js'

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'
const TIMEOUT_MS = 15000
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY?.trim()

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

  if (expertiseLevel === 'exploring') {
    return 'Use clear practical guidance with short explanations and one concrete next action.'
  }

  if (expertiseLevel === 'student') {
    return 'Use structured coaching, reinforce reasoning, and connect concepts to implementation.'
  }

  if (expertiseLevel === 'master') {
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

async function callGemini(prompt, options = {}) {
  const { temperature = 0.5, maxOutputTokens = 256 } = options

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
      `${GEMINI_URL}?key=${GEMINI_API_KEY}`,
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

export function useGemini() {
  const generateRoadmap = useCallback(async (projectDescription, skillLevel, profileContext = null) => {
    const profileBlock = buildProfilePromptBlock(profileContext)
    const basePrompt = `You are a coding mentor. The user wants to build: ${projectDescription}.\nTheir selected project skill level is: ${skillLevel}.\n${profileBlock}\nGenerate a learning roadmap as a JSON array of exactly 6 tasks.\nEach task guides the user to implement one specific piece of the project themselves.\nNever give code directly in the description or hint fields.\nReturn ONLY a valid raw JSON array. No markdown, no backticks, no explanation.\nSchema: [{id, title, description, hint, exampleOutput, language}]\nThe language field must be one of: javascript, typescript, python, html, sql, java, csharp, go, rust, ruby, php, swift, kotlin.\nUse language only as a task-level lock when clearly appropriate.\nThe exampleOutput field may contain code as it is shown only when explicitly requested.`

    const firstAttempt = await callGemini(basePrompt, {
      temperature: 0.7,
      maxOutputTokens: 1024,
    })
    if (firstAttempt.error) {
      return { data: null, error: firstAttempt.error }
    }

    const parseRoadmap = (text) => {
      const cleaned = cleanJsonString(text)
      const parsed = JSON.parse(cleaned)

      if (!Array.isArray(parsed)) {
        throw new Error('Roadmap response is not an array.')
      }

      if (parsed.length !== 6) {
        throw new Error('Roadmap must contain exactly 6 tasks.')
      }

      return parsed.map((task, index) => {
        const title = toText(task.title) || `Task ${index + 1}`
        const description = toText(task.description)
        const hint = toText(task.hint)
        const exampleOutput = toText(task.exampleOutput)
        const lockedLanguage = sanitizeLanguage(task.language)

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
      })
    }

    try {
      const roadmap = parseRoadmap(firstAttempt.data)
      return { data: roadmap, error: null }
    } catch {
      const retryPrompt = `${basePrompt}\nYou must return only raw JSON, nothing else.`
      const secondAttempt = await callGemini(retryPrompt, {
        temperature: 0.7,
        maxOutputTokens: 1024,
      })

      if (secondAttempt.error) {
        return { data: null, error: secondAttempt.error }
      }

      try {
        const roadmap = parseRoadmap(secondAttempt.data)
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

  const checkUserCode = useCallback(async (task, userCode, profileContext = null) => {
    const exampleOutput = toText(task?.exampleOutput ?? '').trim()
    const profileBlock = buildProfilePromptBlock(profileContext)
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
  }, [])

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

      const result = await callGemini(prompt, {
        temperature: 0.4,
        maxOutputTokens: 320,
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
