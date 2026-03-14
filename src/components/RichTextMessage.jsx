import hljs from 'highlight.js/lib/core'
import 'highlight.js/styles/github.css'
import bash from 'highlight.js/lib/languages/bash'
import csharp from 'highlight.js/lib/languages/csharp'
import go from 'highlight.js/lib/languages/go'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import kotlin from 'highlight.js/lib/languages/kotlin'
import php from 'highlight.js/lib/languages/php'
import python from 'highlight.js/lib/languages/python'
import ruby from 'highlight.js/lib/languages/ruby'
import rust from 'highlight.js/lib/languages/rust'
import sql from 'highlight.js/lib/languages/sql'
import swift from 'highlight.js/lib/languages/swift'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'
import { parseRichTextSegments } from '../lib/richTextParser'

hljs.registerLanguage('bash', bash)
hljs.registerLanguage('csharp', csharp)
hljs.registerLanguage('go', go)
hljs.registerLanguage('java', java)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('kotlin', kotlin)
hljs.registerLanguage('php', php)
hljs.registerLanguage('python', python)
hljs.registerLanguage('ruby', ruby)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('swift', swift)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('yaml', yaml)

const LANGUAGE_ALIASES = {
  csharp: 'csharp',
  cs: 'csharp',
  html: 'xml',
  js: 'javascript',
  jsx: 'javascript',
  py: 'python',
  rb: 'ruby',
  shell: 'bash',
  sh: 'bash',
  ts: 'typescript',
  tsx: 'typescript',
  yml: 'yaml',
}

function normalizeLanguage(language) {
  if (!language) {
    return ''
  }

  const normalized = String(language).trim().toLowerCase()
  return LANGUAGE_ALIASES[normalized] || normalized
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function highlightCode(content, language) {
  const normalizedLanguage = normalizeLanguage(language)

  try {
    if (normalizedLanguage && hljs.getLanguage(normalizedLanguage)) {
      return hljs.highlight(content, {
        language: normalizedLanguage,
        ignoreIllegals: true,
      }).value
    }

    return hljs.highlightAuto(content).value
  } catch {
    return escapeHtml(content)
  }
}

function RichTextMessage({ text, className = '' }) {
  const segments = parseRichTextSegments(text)

  return (
    <div className={`flex flex-col gap-2 text-sm leading-6 text-slate-800 ${className}`.trim()}>
      {segments.map((segment, index) => {
        if (segment.type === 'code') {
          const highlighted = highlightCode(segment.content, segment.language)
          const languageClass = normalizeLanguage(segment.language)
          const languageLabel = languageClass || 'code'

          return (
            <div
              key={`code-${index}`}
              className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-1.5">
                <span className="font-mono text-xs uppercase tracking-wide text-slate-600">
                  {languageLabel}
                </span>
              </div>
              <pre className="m-0 max-h-80 overflow-auto bg-slate-950 p-3 text-[12px] leading-5">
                <code
                  className={`hljs !bg-transparent !p-0 font-mono text-slate-100 ${languageClass ? `language-${languageClass}` : ''}`}
                  dangerouslySetInnerHTML={{ __html: highlighted }}
                />
              </pre>
            </div>
          )
        }

        if (!segment.content) {
          return null
        }

        return (
          <p key={`text-${index}`} className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
            {segment.content}
          </p>
        )
      })}
    </div>
  )
}

export default RichTextMessage
