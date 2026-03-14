import { useCallback } from 'react'

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
  const generateRoadmap = useCallback(async (projectDescription, skillLevel) => {
    const basePrompt = `You are a coding mentor. The user wants to build: ${projectDescription}.\nTheir skill level is: ${skillLevel}.\nGenerate a learning roadmap as a JSON array of exactly 6 tasks.\nEach task guides the user to implement one specific piece of the project themselves.\nNever give code directly in the description or hint fields.\nReturn ONLY a valid raw JSON array. No markdown, no backticks, no explanation.\nSchema: [{id, title, description, hint, exampleOutput}]\nThe exampleOutput field may contain code as it is shown only when explicitly requested.`

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

      return parsed.map((task, index) => ({
        id: task.id || `ai-task-${index + 1}`,
        title: toText(task.title) || `Task ${index + 1}`,
        description: toText(task.description),
        hint: toText(task.hint),
        exampleOutput: toText(task.exampleOutput),
        completed: false,
        task_index: index,
      }))
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

  const checkUserCode = useCallback(async (task, userCode) => {
    const prompt = `You are a strict, concise coding mentor.\nThe user is working on this task: ${task.description}\nThey have written this code:\n${userCode}\nGive specific targeted feedback on their attempt.\nDo NOT give them the complete solution under any circumstances.\nPoint out exactly what is wrong or missing.\nEnd with one question that nudges them to think about the next step.\nStart directly with technical feedback. No greeting, no preamble, no filler.\nKeep response under 90 words.`

    const result = await callGemini(prompt, {
      temperature: 0.4,
      maxOutputTokens: 220,
    })
    if (result.error) {
      return { data: null, error: result.error }
    }

    return { data: result.data, error: null }
  }, [])

  const askFollowUp = useCallback(
    async (task, userCode, userQuestion, feedbackHistory) => {
      const prompt = `You are a concise coding mentor in an ongoing conversation.\nCurrent task: ${task.description}\nUser's current code: ${userCode}\nConversation so far: ${JSON.stringify(feedbackHistory)}\nUser's new question: ${userQuestion}\nAnswer their question helpfully but do not give them complete working code.\nGive hints, ask one focused question back, and point them in the right direction.\nStart directly with the answer. No greeting, no preamble, no filler.\nKeep response under 80 words.`

      const result = await callGemini(prompt, {
        temperature: 0.4,
        maxOutputTokens: 180,
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
