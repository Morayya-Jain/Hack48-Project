import { useState } from 'react'
import { buttonDanger, buttonPrimary, sizeSm } from '../lib/buttonStyles'

function FileTree({
  files,
  activeFileId,
  onSelectFile,
  onCreateFile,
  onRenameFile,
  onDeleteFile,
  isBusy,
  errorMessage,
}) {
  const [openMenuFileId, setOpenMenuFileId] = useState(null)

  const handleCreate = () => {
    const nextPath = window.prompt('Enter a file path (example: src/main.js)', 'main.js')
    if (!nextPath) {
      return
    }

    setOpenMenuFileId(null)
    onCreateFile(nextPath)
  }

  const handleRename = (file) => {
    const nextPath = window.prompt('Rename file path', file.path)
    if (!nextPath || nextPath === file.path) {
      return
    }

    setOpenMenuFileId(null)
    onRenameFile(file.id, nextPath)
  }

  const handleDelete = (file) => {
    const confirmed = window.confirm(`Delete "${file.path}"?`)
    if (!confirmed) {
      return
    }

    setOpenMenuFileId(null)
    onDeleteFile(file.id)
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Files</h2>
        <button
          type="button"
          className={`${buttonPrimary} ${sizeSm} min-w-0 rounded-lg px-2 py-1`}
          onClick={handleCreate}
          disabled={isBusy}
          title="Create file"
        >
          +
        </button>
      </div>

      {isBusy ? <p className="text-sm text-slate-600">Saving files...</p> : null}
      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      <div className="flex max-h-64 flex-col gap-1 overflow-auto pr-1">
        {files.length === 0 ? (
          <p className="text-sm text-slate-600">No files yet.</p>
        ) : (
          files.map((file) => {
            const isActive = file.id === activeFileId

            return (
              <div
                key={file.id}
                className={`rounded-lg border px-2 py-1.5 ${
                  isActive ? 'border-slate-800 bg-slate-100' : 'border-transparent hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    className={`min-w-0 flex-1 truncate text-left text-sm ${
                      isActive ? 'font-semibold text-slate-900' : 'text-slate-700'
                    }`}
                    onClick={() => {
                      setOpenMenuFileId(null)
                      onSelectFile(file.id)
                    }}
                  >
                    {file.path}
                  </button>

                  <button
                    type="button"
                    className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-slate-600 hover:border-slate-300 hover:bg-white hover:text-slate-900"
                    onClick={() =>
                      setOpenMenuFileId((prev) => (prev === file.id ? null : file.id))
                    }
                    disabled={isBusy}
                    title="File actions"
                    aria-label={`Actions for ${file.path}`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="5" r="1.5" />
                      <circle cx="12" cy="12" r="1.5" />
                      <circle cx="12" cy="19" r="1.5" />
                    </svg>
                  </button>
                </div>

                {openMenuFileId === file.id ? (
                  <div className="mt-2 space-y-1 rounded-lg border border-slate-200 bg-white p-1">
                    <button
                      type="button"
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-100"
                      onClick={() => handleRename(file)}
                      disabled={isBusy}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className={`${buttonDanger} ${sizeSm} w-full justify-start rounded-md px-2 py-1 text-xs`}
                      onClick={() => handleDelete(file)}
                      disabled={isBusy}
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}

export default FileTree
