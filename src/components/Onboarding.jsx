import { useState } from 'react'
import { buttonPrimary, sizeLg } from '../lib/buttonStyles'

function Onboarding({
  onSubmit,
  isGeneratingRoadmap,
  errorMessage,
  defaultDescription,
  defaultSkillLevel,
}) {
  const [description, setDescription] = useState(defaultDescription || '')
  const [skillLevel, setSkillLevel] = useState(defaultSkillLevel || 'beginner')

  const handleSubmit = async (event) => {
    event.preventDefault()
    await onSubmit(description, skillLevel)
  }

  return (
    <main className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Start a New Project</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          What do you want to build?
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={6}
            required
            className="border p-2"
            placeholder="Example: Build a React todo app with Supabase auth"
          />
        </label>

        <label className="flex flex-col gap-1">
          Skill level
          <select
            value={skillLevel}
            onChange={(event) => setSkillLevel(event.target.value)}
            className="border p-2"
          >
            <option value="beginner">beginner</option>
            <option value="intermediate">intermediate</option>
          </select>
        </label>

        <button
          type="submit"
          className={`${buttonPrimary} ${sizeLg}`}
          disabled={isGeneratingRoadmap}
        >
          {isGeneratingRoadmap ? 'Generating roadmap...' : 'Generate roadmap'}
        </button>
      </form>

      {errorMessage && <p className="text-red-600 mt-4">{errorMessage}</p>}
    </main>
  )
}

export default Onboarding
