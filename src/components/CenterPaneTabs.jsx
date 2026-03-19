import { useState } from 'react'

const TABS = [
  { id: 'code', label: 'Code' },
  { id: 'preview', label: 'Preview' },
  { id: 'console', label: 'Console' },
]

function CenterPaneTabs({ codeContent, previewContent, consoleContent }) {
  const [activeTab, setActiveTab] = useState('code')

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 gap-1 border-b border-slate-200 bg-slate-50 px-2 pt-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`rounded-t-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'border border-b-0 border-slate-300 bg-white text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {activeTab === 'code' ? <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{codeContent}</div> : null}
        {activeTab === 'preview' ? <div className="flex min-h-0 flex-1 flex-col p-2">{previewContent}</div> : null}
        {activeTab === 'console' ? <div className="flex min-h-0 flex-1 flex-col">{consoleContent}</div> : null}
      </div>
    </div>
  )
}

export default CenterPaneTabs
