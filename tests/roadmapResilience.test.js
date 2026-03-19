import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseRoadmapGenerationResult,
  parseRoadmapGenerationResultLenient,
  parseRoadmapFromOutlineText,
  normalizeClarifyingAnswers,
  buildRoadmapPrompt,
} from '../src/hooks/useGemini.js'
import {
  isStrictlyGenericRoadmap,
  isLikelyGenericRoadmap,
} from '../src/lib/roadmapQuality.js'

// -- Helpers --

function buildProjectTask(index, overrides = {}) {
  return {
    id: `task-${index + 1}`,
    title: overrides.title || `Build feature ${index + 1}`,
    description: overrides.description || `Description for task ${index + 1}`,
    hint: overrides.hint || `Hint for task ${index + 1}`,
    exampleOutput: overrides.exampleOutput || `Example output ${index + 1}`,
    language: overrides.language || 'javascript',
  }
}

function buildValidRoadmapJson(taskCount, skillLevel = 'beginner', taskOverrides = {}) {
  return JSON.stringify({
    skillLevel,
    tasks: Array.from({ length: taskCount }, (_, i) =>
      buildProjectTask(i, typeof taskOverrides === 'function' ? taskOverrides(i) : taskOverrides),
    ),
  })
}

// ============================================================
// 1. TRUNCATED RESPONSES (the bug that caused "Unable to generate")
// ============================================================

test('parseRoadmapGenerationResult recovers from truncated JSON via lenient parser', () => {
  // Simulates what happens when Gemini returns MAX_TOKENS —
  // JSON is cut off mid-way through the tasks array.
  const truncated = `{"skillLevel":"beginner","tasks":[
    {"id":"task-1","title":"Create HTML layout for todo list","description":"Build the basic HTML structure","hint":"Use a div container","exampleOutput":"A page with input and list","language":"html"},
    {"id":"task-2","title":"Style the todo app with CSS","description":"Add colors and spacing","hint":"Use flexbox","exampleOutput":"Styled page","language":"css"},
    {"id":"task-3","title":"Add JavaScript click handler","description":"Wire the add button","hint":"Use addEventListener","exampleOutput":"Clicking adds text","language":"javascript"},
    {"id":"task-4","title":"Implement delete functionality","description":"Add remove button per item","hint":"Use event delegation","exampleOutput":"Items can be removed","language":"javascript"}
  `
  // Missing closing ]} — this is what truncation looks like

  const parsed = parseRoadmapGenerationResult(truncated)
  assert.equal(parsed.tasks.length, 4)
  assert.equal(parsed.skillLevel, 'beginner')
  assert.match(parsed.tasks[0].title, /HTML layout/i)
})

test('parseRoadmapGenerationResultLenient recovers 5 tasks from heavily truncated response', () => {
  const truncated = `{"skillLevel":"intermediate","tasks":[
    {"id":"1","title":"Set up React project for weather dashboard","description":"Initialize with Vite","hint":"Run npm create vite","exampleOutput":"Dev server running","language":"javascript"},
    {"id":"2","title":"Build city search input component","description":"Add autocomplete input","hint":"Use controlled component","exampleOutput":"User can type city name","language":"javascript"},
    {"id":"3","title":"Fetch weather data from OpenWeather API","description":"Call the API endpoint","hint":"Use fetch with async/await","exampleOutput":"JSON response logged","language":"javascript"},
    {"id":"4","title":"Display current temperature and icon","description":"Show temp in Celsius","hint":"Parse response.main.temp","exampleOutput":"72°F shown on screen","language":"javascript"},
    {"id":"5","title":"Add 5-day forecast section","description":"Show upcoming weather","hint":"Use forecast endpoint","exampleOutput":"5 cards with daily`

  const parsed = parseRoadmapGenerationResultLenient(truncated)
  assert.ok(parsed.tasks.length >= 4, `Expected at least 4 tasks, got ${parsed.tasks.length}`)
  assert.match(parsed.tasks[0].title, /React project.*weather/i)
})

// ============================================================
// 2. VARIOUS PROJECT TYPES — parsing always succeeds
// ============================================================

test('parseRoadmapGenerationResult handles todo app roadmap', () => {
  const input = buildValidRoadmapJson(5, 'beginner', (i) => ({
    title: ['Create HTML todo form', 'Style with Tailwind', 'Add task with JS', 'Mark tasks complete', 'Save to localStorage'][i],
  }))

  const parsed = parseRoadmapGenerationResult(input)
  assert.equal(parsed.tasks.length, 5)
  assert.ok(!isStrictlyGenericRoadmap(parsed.tasks))
})

test('parseRoadmapGenerationResult handles Python snake game roadmap', () => {
  const input = buildValidRoadmapJson(6, 'intermediate', (i) => ({
    title: [
      'Initialize pygame window for snake',
      'Draw snake body segments on grid',
      'Handle arrow key movement input',
      'Spawn random food on the grid',
      'Detect snake collision with food',
      'Track and display player score',
    ][i],
    language: 'python',
  }))

  const parsed = parseRoadmapGenerationResult(input)
  assert.equal(parsed.tasks.length, 6)
  assert.equal(parsed.skillLevel, 'intermediate')
})

test('parseRoadmapGenerationResult handles advanced React dashboard roadmap', () => {
  const input = buildValidRoadmapJson(8, 'advanced', (i) => ({
    title: [
      'Configure Vite with React and TypeScript',
      'Build reusable Chart component with Recharts',
      'Implement dashboard layout with CSS Grid',
      'Add real-time data fetching with SWR',
      'Create filter sidebar with date range picker',
      'Implement responsive breakpoints',
      'Add dark mode theme toggle',
      'Write integration tests with Playwright',
    ][i],
    language: i < 6 ? 'typescript' : 'javascript',
  }))

  const parsed = parseRoadmapGenerationResult(input)
  assert.equal(parsed.tasks.length, 8)
  assert.equal(parsed.skillLevel, 'advanced')
})

test('parseRoadmapGenerationResult handles master-level API project', () => {
  const input = buildValidRoadmapJson(4, 'master', (i) => ({
    title: [
      'Design REST API schema with OpenAPI spec',
      'Implement authentication middleware with JWT',
      'Build rate-limiting with Redis sliding window',
      'Add WebSocket real-time notifications',
    ][i],
  }))

  const parsed = parseRoadmapGenerationResult(input)
  assert.equal(parsed.tasks.length, 4)
  assert.equal(parsed.skillLevel, 'master')
})

// ============================================================
// 3. EDGE CASES — malformed, empty, weird inputs
// ============================================================

test('parseRoadmapGenerationResult throws on completely empty response', () => {
  assert.throws(() => parseRoadmapGenerationResult(''))
})

test('parseRoadmapGenerationResult throws on response with zero tasks', () => {
  const input = JSON.stringify({ skillLevel: 'beginner', tasks: [] })
  assert.throws(() => parseRoadmapGenerationResult(input), /at least 4/i)
})

test('parseRoadmapGenerationResult throws on non-JSON text', () => {
  assert.throws(
    () => parseRoadmapGenerationResult('Here is your roadmap:\n1. Do this\n2. Do that\n3. Done'),
  )
})

test('parseRoadmapGenerationResult handles tasks with missing optional fields', () => {
  const input = JSON.stringify({
    skillLevel: 'beginner',
    tasks: Array.from({ length: 5 }, (_, i) => ({
      title: `Build feature ${i + 1} of the chat app`,
      description: `Step ${i + 1} description`,
      // hint and exampleOutput missing
    })),
  })

  const parsed = parseRoadmapGenerationResult(input)
  assert.equal(parsed.tasks.length, 5)
  // Missing fields should get contextual defaults
  assert.ok(parsed.tasks[0].hint.length > 0, 'hint should have fallback')
  assert.ok(parsed.tasks[0].exampleOutput.length > 0, 'exampleOutput should have fallback')
})

test('parseRoadmapGenerationResult handles tasks with empty string fields', () => {
  const input = JSON.stringify({
    skillLevel: 'beginner',
    tasks: Array.from({ length: 4 }, (_, i) => ({
      title: `Implement part ${i + 1} of the calculator`,
      description: `Do part ${i + 1}`,
      hint: '',
      exampleOutput: '',
      language: '',
    })),
  })

  const parsed = parseRoadmapGenerationResult(input)
  assert.equal(parsed.tasks.length, 4)
  assert.ok(parsed.tasks[0].hint.length > 0, 'empty hint should get fallback')
  assert.ok(parsed.tasks[0].exampleOutput.length > 0, 'empty exampleOutput should get fallback')
})

test('parseRoadmapGenerationResult handles JSON wrapped in markdown code fence', () => {
  const wrapped = '```json\n' + buildValidRoadmapJson(5) + '\n```'
  // This should either parse directly or fall through to lenient
  const parsed = parseRoadmapGenerationResult(wrapped)
  assert.equal(parsed.tasks.length, 5)
})

test('parseRoadmapGenerationResult handles unicode in task titles', () => {
  const input = JSON.stringify({
    skillLevel: 'beginner',
    tasks: Array.from({ length: 4 }, (_, i) => ({
      id: `task-${i + 1}`,
      title: ['Créer la page d\'accueil', 'Ajouter le formulaire de connexion', 'Implémenter la validation côté client', 'Tester les cas limites'][i],
      description: `Description ${i + 1}`,
      hint: `Hint ${i + 1}`,
      exampleOutput: `Output ${i + 1}`,
      language: 'javascript',
    })),
  })

  const parsed = parseRoadmapGenerationResult(input)
  assert.equal(parsed.tasks.length, 4)
  assert.match(parsed.tasks[0].title, /accueil/i)
})

// ============================================================
// 4. GENERIC ROADMAP DETECTION
// ============================================================

test('isStrictlyGenericRoadmap rejects project-specific tasks', () => {
  const tasks = [
    { title: 'Create HTML layout for todo list' },
    { title: 'Style the todo app with CSS flexbox' },
    { title: 'Add JavaScript click handler for new items' },
    { title: 'Implement delete with event delegation' },
    { title: 'Save todos to localStorage' },
    { title: 'Add filter buttons for active/completed' },
  ]
  assert.equal(isStrictlyGenericRoadmap(tasks), false)
})

test('isStrictlyGenericRoadmap catches known generic pattern', () => {
  const tasks = [
    { title: 'Set up the project foundation' },
    { title: 'Define core data and flow' },
    { title: 'Implement the first MVP feature' },
    { title: 'Add the second key capability' },
    { title: 'Handle errors and edge cases' },
    { title: 'Finalize and verify' },
  ]
  assert.equal(isStrictlyGenericRoadmap(tasks), true)
})

test('isLikelyGenericRoadmap catches vaguely generic tasks', () => {
  const tasks = [
    { title: 'Set up project structure' },
    { title: 'Implement core logic' },
    { title: 'Add basic functionality' },
    { title: 'Handle errors' },
    { title: 'Create main feature' },
  ]
  assert.equal(isLikelyGenericRoadmap(tasks), true)
})

test('isLikelyGenericRoadmap passes specific weather app tasks', () => {
  const tasks = [
    { title: 'Create city search input with autocomplete' },
    { title: 'Fetch OpenWeather API for current conditions' },
    { title: 'Display temperature and humidity cards' },
    { title: 'Add 5-day forecast timeline view' },
    { title: 'Implement geolocation for auto-detect city' },
  ]
  assert.equal(isLikelyGenericRoadmap(tasks), false)
})

// ============================================================
// 5. OUTLINE RECOVERY (fallback when JSON parse fails)
// ============================================================

test('parseRoadmapFromOutlineText recovers from numbered list format', () => {
  const outline = `
1. Create the HTML structure for the recipe book app
2. Style the recipe cards with CSS Grid layout
3. Build a recipe search filter with JavaScript
4. Implement add-new-recipe form with validation
5. Save recipes to browser localStorage
`
  const parsed = parseRoadmapFromOutlineText(outline, 'beginner')
  assert.ok(parsed.tasks.length >= 4)
  assert.match(parsed.tasks[0].title, /recipe book/i)
})

test('parseRoadmapFromOutlineText recovers from bullet list format', () => {
  const outline = `
- Design the database schema for blog posts
- Build the REST API endpoints for CRUD operations
- Create the React frontend with post list view
- Implement markdown editor for new posts
- Add authentication with JWT tokens
`
  const parsed = parseRoadmapFromOutlineText(outline, 'intermediate')
  assert.ok(parsed.tasks.length >= 4)
  assert.equal(parsed.skillLevel, 'intermediate')
})

test('parseRoadmapFromOutlineText throws on too few entries', () => {
  assert.throws(
    () => parseRoadmapFromOutlineText('1. Do thing\n2. Done', 'beginner'),
    /outline recovery failed/i,
  )
})

// ============================================================
// 6. SKILL LEVEL NORMALIZATION
// ============================================================

test('normalizeClarifyingAnswers handles all valid skill levels', () => {
  const levels = ['beginner', 'intermediate', 'advanced', 'master']
  for (const level of levels) {
    const result = normalizeClarifyingAnswers({ skillLevelPreference: level })
    assert.equal(result.skillLevelPreference, level)
  }
})

test('normalizeClarifyingAnswers normalizes case-insensitive input', () => {
  assert.equal(
    normalizeClarifyingAnswers({ skillLevelPreference: 'BEGINNER' }).skillLevelPreference,
    'beginner',
  )
  assert.equal(
    normalizeClarifyingAnswers({ skillLevelPreference: 'Advanced' }).skillLevelPreference,
    'advanced',
  )
})

test('normalizeClarifyingAnswers defaults invalid skill level to beginner', () => {
  assert.equal(
    normalizeClarifyingAnswers({ skillLevelPreference: 'expert' }).skillLevelPreference,
    'beginner',
  )
  assert.equal(
    normalizeClarifyingAnswers({ skillLevelPreference: '' }).skillLevelPreference,
    'beginner',
  )
  assert.equal(
    normalizeClarifyingAnswers({ skillLevelPreference: null }).skillLevelPreference,
    'beginner',
  )
})

test('normalizeClarifyingAnswers fills missing fields with defaults', () => {
  const result = normalizeClarifyingAnswers({})
  assert.ok(result.experience.length > 0)
  assert.ok(result.scope.length > 0)
  assert.ok(result.time.length > 0)
})

// ============================================================
// 7. PROMPT GENERATION — ensures all project types produce valid prompts
// ============================================================

test('buildRoadmapPrompt includes project description for various project types', () => {
  const projects = [
    'a todo app with React',
    'a snake game in Python with pygame',
    'a REST API with Node.js and Express',
    'a personal portfolio website with HTML and CSS',
    'a chat application with WebSockets',
    'a machine learning image classifier',
    'un jeu de morpion en JavaScript',
  ]

  for (const project of projects) {
    const prompt = buildRoadmapPrompt(project, { skillLevelPreference: 'beginner' })
    assert.ok(prompt.includes(project), `Prompt should include "${project}"`)
    assert.match(prompt, /4 to 10 tasks/i)
    assert.match(prompt, /specific to building THIS project/i)
  }
})

test('buildRoadmapPrompt includes language constraint when languages provided', () => {
  const prompt = buildRoadmapPrompt(
    'a calculator app',
    { skillLevelPreference: 'beginner' },
    null,
    ['python'],
  )
  assert.match(prompt, /LANGUAGE CONSTRAINT/i)
  assert.match(prompt, /python/i)
})

test('buildRoadmapPrompt works with null/undefined clarifying answers', () => {
  const prompt1 = buildRoadmapPrompt('a todo app', null)
  assert.ok(prompt1.length > 100)

  const prompt2 = buildRoadmapPrompt('a todo app', undefined)
  assert.ok(prompt2.length > 100)
})

// ============================================================
// 8. SIMULATED GEMINI RESPONSE FORMATS
// ============================================================

test('parseRoadmapGenerationResult handles response with extra whitespace and newlines', () => {
  const input = `

  {
    "skillLevel" : "beginner" ,
    "tasks" : [
      { "id": "1", "title": "Build login form",   "description": "Create form",  "hint": "Use input tags", "exampleOutput": "Form renders",  "language": "html" },
      { "id": "2", "title": "Add CSS styling",     "description": "Style form",   "hint": "Use flexbox",    "exampleOutput": "Styled form",   "language": "css" },
      { "id": "3", "title": "Validate email input", "description": "Check email",  "hint": "Use regex",      "exampleOutput": "Error shown",   "language": "javascript" },
      { "id": "4", "title": "Submit form data",    "description": "Send request", "hint": "Use fetch",      "exampleOutput": "200 response",  "language": "javascript" }
    ]
  }

  `

  const parsed = parseRoadmapGenerationResult(input)
  assert.equal(parsed.tasks.length, 4)
  assert.match(parsed.tasks[0].title, /login form/i)
})

test('parseRoadmapGenerationResult handles response with HTML entities in fields', () => {
  const input = JSON.stringify({
    skillLevel: 'beginner',
    tasks: Array.from({ length: 4 }, (_, i) => ({
      id: `task-${i + 1}`,
      title: `Task ${i + 1}: Build the <header> component`,
      description: `Create a <nav> with links & buttons`,
      hint: `Use <a> and <button> tags`,
      exampleOutput: `<header> renders with 3 nav links`,
      language: 'html',
    })),
  })

  const parsed = parseRoadmapGenerationResult(input)
  assert.equal(parsed.tasks.length, 4)
  assert.ok(parsed.tasks[0].title.includes('<header>'))
})

test('parseRoadmapGenerationResult handles response with code in exampleOutput', () => {
  const input = JSON.stringify({
    skillLevel: 'intermediate',
    tasks: [
      {
        id: 'task-1',
        title: 'Create Express server with GET endpoint',
        description: 'Set up Express and add a /health route',
        hint: 'Use app.get() with res.json()',
        exampleOutput: 'GET /health returns { "status": "ok" }',
        language: 'javascript',
      },
      {
        id: 'task-2',
        title: 'Add POST /users endpoint',
        description: 'Create user route with body parsing',
        hint: 'Use express.json() middleware',
        exampleOutput: 'POST /users with {"name":"Jo"} returns 201',
        language: 'javascript',
      },
      {
        id: 'task-3',
        title: 'Implement input validation middleware',
        description: 'Validate request body fields',
        hint: 'Check required fields exist',
        exampleOutput: 'Missing name returns 400 with error message',
        language: 'javascript',
      },
      {
        id: 'task-4',
        title: 'Connect to SQLite database',
        description: 'Set up better-sqlite3 and create users table',
        hint: 'Use db.prepare() for queries',
        exampleOutput: 'Database file created, table exists',
        language: 'javascript',
      },
    ],
  })

  const parsed = parseRoadmapGenerationResult(input)
  assert.equal(parsed.tasks.length, 4)
  assert.match(parsed.tasks[0].exampleOutput, /status.*ok/i)
})

test('parseRoadmapGenerationResult handles exactly 10 tasks (max boundary)', () => {
  const input = buildValidRoadmapJson(10, 'advanced')
  const parsed = parseRoadmapGenerationResult(input)
  assert.equal(parsed.tasks.length, 10)
})

test('parseRoadmapGenerationResult handles exactly 4 tasks (min boundary)', () => {
  const input = buildValidRoadmapJson(4, 'beginner')
  const parsed = parseRoadmapGenerationResult(input)
  assert.equal(parsed.tasks.length, 4)
})
