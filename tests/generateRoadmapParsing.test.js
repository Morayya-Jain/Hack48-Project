import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCodeCheckPrompt,
  getGeminiText,
  buildProjectTitlePrompt,
  buildRoadmapPrompt,
  normalizeClarifyingAnswers,
  parseRoadmapFromOutlineText,
  parseRoadmapGenerationResult,
  parseRoadmapGenerationResultLenient,
  selectGeminiModel,
} from '../src/hooks/useGemini.js'

test('getGeminiText concatenates multipart Gemini responses', () => {
  const data = {
    candidates: [
      {
        content: {
          parts: [
            { text: '{ "skillLevel": "intermediate", "tasks": [' },
            { text: '{"title":"Task 1"}' },
            { text: '] }' },
          ],
        },
      },
    ],
  }

  const result = getGeminiText(data)
  assert.equal(result.text, '{ "skillLevel": "intermediate", "tasks": [{"title":"Task 1"}] }')
  assert.equal(result.finishReason, '')
})

test('getGeminiText prefers a complete later candidate when the first is truncated', () => {
  const data = {
    candidates: [
      {
        finishReason: 'MAX_TOKENS',
        content: {
          parts: [{ text: '{"skillLevel":"intermediate","tasks":[{"title":"Truncated' }],
        },
      },
      {
        finishReason: 'STOP',
        content: {
          parts: [{ text: '{"skillLevel":"intermediate","tasks":[{"title":"Complete"}]}' }],
        },
      },
    ],
  }

  const result = getGeminiText(data)
  assert.equal(result.text, '{"skillLevel":"intermediate","tasks":[{"title":"Complete"}]}')
  assert.equal(result.finishReason, 'STOP')
})

test('getGeminiText returns MAX_TOKENS finishReason when only truncated candidate exists', () => {
  const data = {
    candidates: [
      {
        finishReason: 'MAX_TOKENS',
        content: {
          parts: [{ text: '{"status":"FAIL","feedback":"Your code is miss' }],
        },
      },
    ],
  }

  const result = getGeminiText(data)
  assert.equal(result.finishReason, 'MAX_TOKENS')
  assert.ok(result.text.length > 0)
})

function buildTask(index) {
  return {
    id: `task-${index + 1}`,
    title: `Task ${index + 1}`,
    description: `Description ${index + 1}`,
    hint: `Hint ${index + 1}`,
    exampleOutput: `Example ${index + 1}`,
    language: 'javascript',
  }
}

function buildMalformedRoadmapPayload(taskCount = 5) {
  const tasks = Array.from({ length: taskCount }, (_, index) => {
    const taskNumber = index + 1
    const description =
      index === 0
        ? 'Open terminal and run "npm init -y" then create src/main.js.'
        : `Description ${taskNumber}`
    const hint =
      index === 0
        ? 'Run "node src/main.js" once to verify setup before coding features.'
        : `Hint ${taskNumber}`

    return `{
      "id": "task-${taskNumber}",
      "title": "Task ${taskNumber}",
      "description": "${description}",
      "hint": "${hint}",
      "exampleOutput": "Example ${taskNumber}",
      "language": "javascript"
    }`
  }).join(',\n')

  return `{
    "skillLevel": "beginner",
    "tasks": [
      ${tasks}
    ]
  }`
}

test('normalizeClarifyingAnswers applies defaults when values are missing', () => {
  assert.deepEqual(normalizeClarifyingAnswers({}), {
    skillLevelPreference: 'beginner',
    experience: 'Not specified.',
    scope: 'Start with a simple MVP.',
    time: 'Moderate pace.',
  })
})

test('normalizeClarifyingAnswers keeps valid skill preference and normalizes invalid to beginner', () => {
  assert.equal(
    normalizeClarifyingAnswers({ skillLevelPreference: 'Advanced' }).skillLevelPreference,
    'advanced',
  )
  assert.equal(
    normalizeClarifyingAnswers({ skillLevelPreference: 'Master' }).skillLevelPreference,
    'master',
  )
  assert.equal(
    normalizeClarifyingAnswers({ skillLevelPreference: 'guru' }).skillLevelPreference,
    'beginner',
  )
})

test('parseRoadmapGenerationResult parses valid dynamic roadmap payload (5 tasks)', () => {
  const input = JSON.stringify({
    skillLevel: 'advanced',
    tasks: Array.from({ length: 5 }, (_, index) => buildTask(index)),
  })

  const parsed = parseRoadmapGenerationResult(input)
  assert.equal(parsed.skillLevel, 'advanced')
  assert.equal(parsed.tasks.length, 5)
  assert.equal(parsed.tasks[0].task_index, 0)
})

test('parseRoadmapGenerationResult preserves all tasks within allowed range', () => {
  const input = JSON.stringify({
    skillLevel: 'beginner',
    tasks: Array.from({ length: 8 }, (_, index) => buildTask(index)),
  })

  const parsed = parseRoadmapGenerationResult(input)
  assert.equal(parsed.tasks.length, 8)
  assert.equal(parsed.tasks[7].id, 'task-8')
})

test('parseRoadmapGenerationResult preserves master skill level', () => {
  const input = JSON.stringify({
    skillLevel: 'master',
    tasks: Array.from({ length: 4 }, (_, index) => buildTask(index)),
  })

  const parsed = parseRoadmapGenerationResult(input)
  assert.equal(parsed.skillLevel, 'master')
})

test('parseRoadmapGenerationResult falls back to intermediate for invalid skill level', () => {
  const input = JSON.stringify({
    skillLevel: 'expert-plus',
    tasks: Array.from({ length: 5 }, (_, index) => buildTask(index)),
  })

  const parsed = parseRoadmapGenerationResult(input)
  assert.equal(parsed.skillLevel, 'intermediate')
})

test('parseRoadmapGenerationResult throws when task count is below minimum', () => {
  const input = JSON.stringify({
    skillLevel: 'beginner',
    tasks: Array.from({ length: 3 }, (_, index) => buildTask(index)),
  })

  assert.throws(() => parseRoadmapGenerationResult(input), /at least 4 tasks/i)
})

test('parseRoadmapGenerationResult trims over-generated tasks to max allowed count', () => {
  const input = JSON.stringify({
    skillLevel: 'beginner',
    tasks: Array.from({ length: 11 }, (_, index) => buildTask(index)),
  })

  const parsed = parseRoadmapGenerationResult(input)
  assert.equal(parsed.tasks.length, 10)
  assert.equal(parsed.tasks[9].id, 'task-10')
})

test('parseRoadmapGenerationResult keeps first task text as-is without setup rewriting', () => {
  const tasks = Array.from({ length: 5 }, (_, index) => buildTask(index))
  tasks[0] = {
    ...tasks[0],
    title: 'Define calculator arithmetic behavior',
    description: 'Define expected behavior for +, -, *, and / with clear examples.',
    hint: 'Write three sample inputs and expected outputs before implementation.',
    exampleOutput: '2 + 2 -> 4, 9 / 3 -> 3',
  }

  const input = JSON.stringify({
    skillLevel: 'beginner',
    tasks,
  })

  const parsed = parseRoadmapGenerationResult(input)
  assert.equal(parsed.tasks[0].title, tasks[0].title)
  assert.equal(parsed.tasks[0].description, tasks[0].description)
  assert.equal(parsed.tasks[0].hint, tasks[0].hint)
})

test('parseRoadmapGenerationResult fills missing hint/exampleOutput with contextual defaults', () => {
  const tasks = Array.from({ length: 5 }, (_, index) => buildTask(index))
  tasks[2] = {
    ...tasks[2],
    title: 'Implement keypad click handlers',
    description: 'Wire each calculator button to update the input expression.',
    hint: ' ',
    exampleOutput: '',
  }

  const input = JSON.stringify({
    skillLevel: 'beginner',
    tasks,
  })

  const parsed = parseRoadmapGenerationResult(input)
  assert.match(parsed.tasks[2].hint, /implement one small part/i)
  assert.match(parsed.tasks[2].exampleOutput, /Expected result:/i)
})

test('parseRoadmapGenerationResultLenient recovers malformed roadmap JSON', () => {
  const malformed = buildMalformedRoadmapPayload(5)

  const parsed = parseRoadmapGenerationResultLenient(malformed)
  assert.equal(parsed.tasks.length, 5)
  assert.match(parsed.tasks[0].description, /npm init -y/i)
  assert.match(parsed.tasks[0].hint, /node src\/main\.js/i)
})

test('parseRoadmapGenerationResult falls back to lenient parsing for malformed JSON', () => {
  const malformed = buildMalformedRoadmapPayload(5)

  const parsed = parseRoadmapGenerationResult(malformed)
  assert.equal(parsed.tasks.length, 5)
  assert.match(parsed.tasks[0].description, /npm init -y/i)
})

test('parseRoadmapGenerationResultLenient does not capture id field content in exampleOutput', () => {
  // Simulates the field order: exampleOutput -> id -> language
  // The regex should stop at the first unescaped closing quote, not capture across "id".
  const tasks = Array.from({ length: 5 }, (_, i) => {
    const n = i + 1
    return `{
      "title": "Task ${n}",
      "description": "Description ${n}",
      "hint": "Hint ${n}",
      "exampleOutput": "Output ${n}",
      "id": "task-${n}",
      "language": "python"
    }`
  }).join(',\n')

  const malformed = `{
    "skillLevel": "beginner",
    "tasks": [ ${tasks} ]
  }`

  const parsed = parseRoadmapGenerationResultLenient(malformed)
  assert.equal(parsed.tasks.length, 5)
  assert.equal(parsed.tasks[0].exampleOutput, 'Output 1')
  assert.ok(!parsed.tasks[0].exampleOutput.includes('task-1'), 'exampleOutput should not contain id field content')
})

test('parseRoadmapFromOutlineText recovers tasks from numbered non-JSON roadmap', () => {
  const outline = `
1. Define calculator operations and expected math behavior.
2. Build the input expression parser for +, -, *, and /.
3. Render calculator buttons and display state in the UI.
4. Wire button clicks to expression updates and equals evaluation.
5. Handle invalid expressions and divide-by-zero safely.
`

  const parsed = parseRoadmapFromOutlineText(outline, 'beginner')
  assert.equal(parsed.tasks.length, 5)
  assert.equal(parsed.skillLevel, 'beginner')
  assert.match(parsed.tasks[0].title, /define calculator operations/i)
  assert.match(parsed.tasks[0].hint, /implement one small part/i)
})

test('parseRoadmapFromOutlineText throws when outline has too few recoverable entries', () => {
  assert.throws(
    () =>
      parseRoadmapFromOutlineText(
        '1. Build calculator.\n2. Add UI.\n3. Test it.',
        'beginner',
      ),
    /outline recovery failed/i,
  )
})

test('parseRoadmapGenerationResult parses legacy generic titles without throwing', () => {
  const input = JSON.stringify({
    skillLevel: 'beginner',
    tasks: [
      {
        id: 'ai-task-1',
        title: 'Set up the project foundation',
        description: 'Create files and folders.',
        hint: 'Run setup command.',
        exampleOutput: 'Project starts.',
        language: '',
      },
      {
        id: 'ai-task-2',
        title: 'Define core data and flow',
        description: 'Map app data flow.',
        hint: 'Write it down.',
        exampleOutput: 'Data map ready.',
        language: '',
      },
      {
        id: 'ai-task-3',
        title: 'Implement the first MVP feature',
        description: 'Build first feature.',
        hint: 'Code first feature.',
        exampleOutput: 'Feature works.',
        language: '',
      },
      {
        id: 'ai-task-4',
        title: 'Add the second key capability',
        description: 'Build next feature.',
        hint: 'Code next feature.',
        exampleOutput: 'Second feature works.',
        language: '',
      },
      {
        id: 'ai-task-5',
        title: 'Handle errors and edge cases',
        description: 'Handle edge cases.',
        hint: 'Test invalid inputs.',
        exampleOutput: 'Errors handled safely.',
        language: '',
      },
      {
        id: 'ai-task-6',
        title: 'Finalize and verify',
        description: 'Polish and verify.',
        hint: 'Run final pass.',
        exampleOutput: 'MVP demo works.',
        language: '',
      },
    ],
  })

  const parsed = parseRoadmapGenerationResult(input)
  assert.equal(parsed.tasks.length, 6)
  assert.equal(parsed.tasks[0].title, 'Set up the project foundation')
})

test('buildRoadmapPrompt keeps minimal no-solution guardrails and dynamic count contract', () => {
  const prompt = buildRoadmapPrompt(
    'I want to build a notes app',
    {
      skillLevelPreference: 'beginner',
      experience: 'Very new to coding',
      scope: 'Simple MVP',
      time: '3 hours weekly',
    },
    null,
  )

  assert.match(prompt, /Generate a learning roadmap as 4 to 10 tasks/i)
  assert.match(prompt, /Never give complete code solutions in the description or hint fields/i)
  assert.doesNotMatch(prompt, /Special Stage 1 requirement/i)
  assert.match(prompt, /"skillLevel": "beginner\|intermediate\|advanced\|master"/i)
  assert.match(prompt, /Skill level: beginner/i)
  assert.match(prompt, /MUST be "beginner"/i)
  assert.match(prompt, /specific to building THIS/i)
})

test('buildRoadmapPrompt includes different guidance for each skill level', () => {
  const levels = ['beginner', 'intermediate', 'advanced', 'master']
  const prompts = levels.map((level) =>
    buildRoadmapPrompt('calculator', { skillLevelPreference: level }, null),
  )

  for (let i = 0; i < levels.length; i++) {
    assert.match(prompts[i], new RegExp(`Skill level: ${levels[i]}`, 'i'))
    assert.match(prompts[i], new RegExp(`MUST be "${levels[i]}"`, 'i'))
  }

  assert.notEqual(prompts[0], prompts[1])
  assert.notEqual(prompts[1], prompts[2])
  assert.notEqual(prompts[2], prompts[3])
})

test('selectGeminiModel routes advanced and master to pro model', () => {
  assert.equal(selectGeminiModel('beginner'), 'gemini-2.5-flash')
  assert.equal(selectGeminiModel('intermediate'), 'gemini-2.5-flash')
  assert.equal(selectGeminiModel('advanced'), 'gemini-2.5-pro')
  assert.equal(selectGeminiModel('master'), 'gemini-2.5-pro')
  assert.equal(selectGeminiModel('hard'), 'gemini-2.5-pro')
})

test('buildCodeCheckPrompt keeps short-snippet and no-full-solution guardrails', () => {
  const prompt = buildCodeCheckPrompt(
    {
      title: 'Build input validation',
      description: 'Validate empty values and show an inline error',
      exampleOutput: '',
    },
    'const value = input.trim()',
    null,
  )

  assert.match(prompt, /Never provide complete working code or a full-file answer/i)
  assert.match(prompt, /keep each snippet at 6 lines max/i)
  assert.match(prompt, /Return ONLY raw JSON with this exact schema/i)
})

test('buildProjectTitlePrompt enforces concise plain-text title output', () => {
  const prompt = buildProjectTitlePrompt('I want to build a real-time kanban board with auth')

  assert.match(prompt, /Return a plain-text title only/i)
  assert.match(prompt, /Use 3 to 7 words/i)
  assert.match(prompt, /No markdown, no quotes, no numbering/i)
  assert.match(prompt, /Return ONLY the title text\./i)
})
