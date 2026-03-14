import { useState } from 'react'
import { buttonPrimary, buttonSecondary, sizeLg } from '../lib/buttonStyles'
import RichTextMessage from './RichTextMessage'

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
    <section className="flex flex-col gap-3 border border-slate-300 bg-white p-4">
      <h2 className="text-2xl font-semibold text-slate-900">Mentor Feedback</h2>

      <button
        type="button"
        className={`${buttonPrimary} ${sizeLg} w-full rounded-lg border-emerald-600 bg-emerald-500 hover:border-emerald-500 hover:bg-emerald-400`}
        onClick={onCheckCode}
        disabled={isCheckingCode}
      >
        {isCheckingCode ? 'Checking code...' : 'Check My Code'}
      </button>

      <div className="min-h-[320px] max-h-[420px] overflow-auto rounded-xl border border-slate-300 bg-slate-50 p-3">
        {feedbackHistory.length === 0 ? (
          <p className="text-sm leading-6 text-slate-500">No feedback yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {feedbackHistory.map((entry, index) => (
              <div
                key={`${entry.role}-${index}`}
                className="rounded-lg border border-slate-200 bg-white p-3"
              >
                <strong className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {entry.role === 'ai' ? 'Mentor' : 'You'}
                </strong>
                {entry.role === 'ai' ? (
                  <RichTextMessage text={entry.message} className="mt-1" />
                ) : (
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
                    {entry.message}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleFollowUp} className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-900">
          Ask a follow-up question
          <input
            type="text"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2"
            placeholder="What should I fix next?"
          />
        </label>
        <button
          type="submit"
          className={`${buttonSecondary} ${sizeLg} w-full rounded-lg`}
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
