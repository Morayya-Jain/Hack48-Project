import { useState, useRef, useEffect, useCallback } from 'react'
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
  const containerRef = useRef(null)
  const editorRef = useRef(null)
  const [containerHeight, setContainerHeight] = useState(0)

  const isFlexFill = height === '100%'
  const editorHeightStyle = (height && !isFlexFill) ? { height } : undefined
  const editorHeightClass = height && !isFlexFill
    ? ''
    : !height
      ? 'h-[22rem] sm:h-[24rem] md:h-[28rem] lg:h-[32rem]'
      : undefined

  const sectionClass = height
    ? 'flex min-h-0 flex-1 flex-col overflow-hidden border border-slate-700 bg-[#1E1E1E]'
    : 'shrink-0 overflow-hidden border border-slate-700 bg-[#1E1E1E]'

  const layoutEditor = useCallback(() => {
    const container = containerRef.current
    const editor = editorRef.current
    if (!container || !editor) return
    const rect = container.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      editor.layout({ width: Math.floor(rect.width), height: Math.floor(rect.height) })
    }
  }, [])

  useEffect(() => {
    if (!isFlexFill) return
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const h = Math.floor(entries[0].contentRect.height)
      if (h > 0) setContainerHeight(h)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [isFlexFill])

  const handleMount = useCallback((editor) => {
    editorRef.current = editor
    if (!isFlexFill) {
      requestAnimationFrame(() => requestAnimationFrame(() => layoutEditor()))
    }
  }, [isFlexFill, layoutEditor])

  const monacoHeight = isFlexFill ? containerHeight : '100%'

  const monacoEditor = (containerHeight > 0 || !isFlexFill) ? (
    <MonacoEditor
      height={monacoHeight}
      language={editorLanguage}
      theme="vs-dark"
      value={value ?? ''}
      onChange={(newValue) => onChange(newValue || '')}
      onMount={handleMount}
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
  ) : null

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
      {isFlexFill ? (
        <div ref={containerRef} className="min-h-0 flex-1">
          {monacoEditor}
        </div>
      ) : (
        <div className={editorHeightClass} style={editorHeightStyle}>
          {monacoEditor}
        </div>
      )}
    </section>
  )
}

export default Editor
