import { buttonPrimary, buttonSecondary, sizeSm } from '../lib/buttonStyles'

function HintBox({
  task,
  hintsUsed,
  exampleViewed,
  onGiveHint,
  onShowExample,
  isDisabled,
}) {
  const hintText =
    typeof task?.hint === 'string' && task.hint.trim().length > 0
      ? task.hint
      : 'No hint is available for this task yet. Ask the mentor a follow-up question for guidance.'

  const exampleText =
    typeof task?.exampleOutput === 'string' && task.exampleOutput.trim().length > 0
      ? task.exampleOutput
      : 'No example output is available for this task yet.'

  return (
    <section className="border p-3 flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Hints</h2>

      <div className="flex gap-2">
        <button
          type="button"
          className={`${buttonPrimary} ${sizeSm}`}
          onClick={onGiveHint}
          disabled={isDisabled}
        >
          Give me a hint
        </button>
        <button
          type="button"
          className={`${buttonSecondary} ${sizeSm}`}
          onClick={onShowExample}
          disabled={isDisabled || hintsUsed < 1}
          title={hintsUsed < 1 ? 'Reveal at least one hint first.' : undefined}
        >
          {exampleViewed ? 'Hide example' : 'Show example'}
        </button>
      </div>
      {hintsUsed < 1 && !isDisabled ? (
        <p className="text-sm text-gray-600">Reveal one hint to unlock the example.</p>
      ) : null}

      {hintsUsed > 0 && (
        <div>
          <h3 className="font-semibold">Hint</h3>
          <p>{hintText}</p>
        </div>
      )}

      {exampleViewed && (
        <div>
          <h3 className="font-semibold">Example Output</h3>
          <pre className="border p-2 overflow-auto whitespace-pre-wrap">{exampleText}</pre>
        </div>
      )}
    </section>
  )
}

export default HintBox
