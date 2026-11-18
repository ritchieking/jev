import { useRef, type KeyboardEvent } from 'react'

type Props = {
  value: string
  onChange: (next: string) => void
  label: string
}

const INDENT = '  '

/** A plain code box: monospace, no wrapping, and Tab indents instead of leaving the field. */
export function CodeEditor({ value, onChange, label }: Props) {
  // Escape, then Tab, leaves the box as usual, so keyboard users aren't trapped in it.
  const escaped = useRef(false)

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const leaving = escaped.current
    escaped.current = event.key === 'Escape'
    if (event.key !== 'Tab' || leaving || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return
    event.preventDefault()
    const box = event.currentTarget
    const { selectionStart, selectionEnd } = box
    onChange(value.slice(0, selectionStart) + INDENT + value.slice(selectionEnd))
    // After React has written the new value, put the caret back where typing continues.
    requestAnimationFrame(() => box.setSelectionRange(selectionStart + INDENT.length, selectionStart + INDENT.length))
  }

  return (
    <textarea
      className="code-editor"
      aria-label={label}
      value={value}
      rows={Math.max(12, value.split('\n').length + 1)}
      wrap="off"
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      autoComplete="off"
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
    />
  )
}
