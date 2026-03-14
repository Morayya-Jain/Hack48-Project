function toText(value) {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return ''
}

export const STARTER_PROMPT_CARDS = [
  {
    id: 'learn-language',
    title: 'Learn a Language',
    description: 'Master programming fundamentals',
    template:
      'I want to build a beginner-friendly language learning app. Start with an MVP that has user sign-up/login, a daily lesson view, simple progress tracking, and one quiz type. Focus on clear fundamentals, small milestones, and practical coding exercises I can implement myself.',
  },
  {
    id: 'build-frontend',
    title: 'Build the Front-End',
    description: 'Create beautiful interfaces',
    template:
      'I want to build the front-end of a modern web app. Guide me to create reusable UI components, state management for user interactions, responsive layouts for mobile and desktop, and accessible forms. Prioritize clean component structure and styling best practices.',
  },
  {
    id: 'build-backend',
    title: 'Build the Back-End',
    description: 'Develop server logic',
    template:
      'I want to build a production-ready backend for an app. Help me design API endpoints, authentication, data models, and database operations with Supabase. Break it down into secure, testable steps and focus on scalable server-side logic.',
  },
  {
    id: 'setting-domain',
    title: 'Setting a Domain',
    description: 'Deploy your app live',
    template:
      'I want to deploy my existing app to production and connect a custom domain. Guide me through deployment setup, environment variables, domain configuration, SSL, and final launch checks so the app is reliably accessible online.',
  },
]

const STARTER_BY_ID = new Map(STARTER_PROMPT_CARDS.map((card) => [card.id, card]))

export function getStarterTemplate(starterId) {
  return STARTER_BY_ID.get(toText(starterId).trim())?.template || ''
}

export function deriveWelcomeName(user) {
  const metadataName = toText(user?.user_metadata?.username).trim()
  if (metadataName) {
    return metadataName
  }

  const emailPrefix = toText(user?.email).split('@')[0]?.trim()
  if (emailPrefix) {
    return emailPrefix
  }

  return 'Builder'
}

export function deriveSkillBadge(profile) {
  const expertise = toText(profile?.expertiseLevel ?? profile?.expertise_level).trim().toLowerCase()

  if (expertise === 'student') {
    return 'Intermediate'
  }

  if (expertise === 'master') {
    return 'Advanced'
  }

  return 'Beginner'
}
