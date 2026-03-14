import { useState } from 'react'
import { buttonPrimary, buttonSecondary, sizeLg } from '../lib/buttonStyles'

function FeedbackPanel({
  feedbackHistory,
  isCheckingCode,
  isAskingFollowUp,
  onCheckCode,
  onAskFollowUp,
  errorMessage,
}) {
  const [question, setQuestion] = useState('')

  const handleFollowUp = async (event) => {
    event.preventDefault()

    if (!question.trim()) {
      return
    }

    await onAskFollowUp(question)
    setQuestion('')
  }

  return (
    <section className="border p-3 flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Mentor Feedback</h2>

      <button
        type="button"
        className={`${buttonPrimary} ${sizeLg}`}
        onClick={onCheckCode}
        disabled={isCheckingCode}
      >
        {isCheckingCode ? 'Checking code...' : 'Check My Code'}
      </button>

      <div className="border p-2 min-h-40 max-h-80 overflow-auto flex flex-col gap-2">
        {feedbackHistory.length === 0 ? (
          <p>No feedback yet.</p>
        ) : (
          feedbackHistory.map((entry, index) => (
            <p key={`${entry.role}-${index}`}>
              <strong>{entry.role === 'ai' ? 'Mentor' : 'You'}:</strong> {entry.message}
            </p>
          ))
        )}
      </div>

      <form onSubmit={handleFollowUp} className="flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          Ask a follow-up question
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={3}
            className="border p-2"
            placeholder="What should I fix next?"
          />
        </label>
        <button
          type="submit"
          className={`${buttonSecondary} ${sizeLg}`}
          disabled={isAskingFollowUp}
        >
          {isAskingFollowUp ? 'Sending...' : 'Send question'}
        </button>
      </form>

      {errorMessage && <p className="text-red-600">{errorMessage}</p>}
    </section>
  )
}

export default FeedbackPanel
