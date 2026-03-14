import MonacoEditor from '@monaco-editor/react'
import { detectLanguage } from '../lib/detectLanguage'

function Editor({ projectDescription, value, onChange, readOnly, language }) {
  const editorLanguage = language || detectLanguage(projectDescription, value)

  return (
    <section className="border p-2 h-full">
      <h2 className="text-lg font-semibold mb-2">Editor</h2>
      <MonacoEditor
        height="70vh"
        language={editorLanguage}
        theme="vs-dark"
        value={value ?? ''}
        onChange={(newValue) => onChange(newValue || '')}
        options={{
          readOnly,
          minimap: { enabled: false },
        }}
      />
    </section>
  )
}

export default Editor
