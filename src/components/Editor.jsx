import MonacoEditor from '@monaco-editor/react'
import { detectLanguage } from '../lib/detectLanguage'

function Editor({
  projectDescription,
  value,
  onChange,
  readOnly,
  language,
  tabs = [],
  activeTabId = null,
  onSelectTab,
  height,
}) {
  const editorLanguage = language || detectLanguage(projectDescription, value)
  const editorHeightStyle = height ? { height } : undefined
  const editorHeightClass = height ? 'h-full' : 'h-[22rem] sm:h-[24rem] md:h-[28rem] lg:h-[32rem]'

  const sectionClass = height
    ? 'flex min-h-0 flex-1 flex-col overflow-hidden border border-slate-300 bg-white'
    : 'shrink-0 overflow-hidden border border-slate-300 bg-white'

  return (
    <section className={sectionClass}>
      {tabs.length > 0 ? (
        <div className="flex overflow-auto border-b border-slate-300 bg-slate-100" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={tab.id === activeTabId}
              className={`flex items-center gap-2 border-r border-slate-300 px-4 py-2 text-sm font-medium ${
                tab.id === activeTabId
                  ? 'bg-[#1E1E1E] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              onClick={() => onSelectTab?.(tab.id)}
            >
              {tab.label}
              {tab.id === activeTabId ? <span className="h-2 w-2 rounded-full bg-emerald-500" /> : null}
            </button>
          ))}
        </div>
      ) : null}
      <div className={editorHeightClass} style={editorHeightStyle}>
        <MonacoEditor
          height="100%"
          language={editorLanguage}
          theme="vs-dark"
          value={value ?? ''}
          onChange={(newValue) => onChange(newValue || '')}
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 14,
            scrollBeyondLastLine: false,
            lineNumbersMinChars: 3,
            automaticLayout: true,
            scrollbar: {
              alwaysConsumeMouseWheel: false,
            },
          }}
        />
      </div>
    </section>
  )
}

export default Editor
