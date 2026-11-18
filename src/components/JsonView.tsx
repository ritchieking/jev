import { useLink } from './Highlight'

export type JsonPath = (string | number)[]

/** Returns the highlight key a line belongs to, if it has a counterpart in a chart. */
export type LinkFor = (path: JsonPath, value: unknown) => string | undefined

type Line = {
  indent: number
  path: JsonPath
  value: unknown
  keyLabel?: string
  /** A bracket for container lines, or the formatted leaf value. */
  text: string
  kind: 'bracket' | 'string' | 'number' | 'other'
  comma: boolean
}

function toLines(value: unknown, path: JsonPath, indent: number, keyLabel: string | undefined, comma: boolean): Line[] {
  if (value !== null && typeof value === 'object') {
    const isArray = Array.isArray(value)
    const entries: [string | number, unknown][] = isArray ? value.map((item, i) => [i, item]) : Object.entries(value)
    const [open, close] = isArray ? ['[', ']'] : ['{', '}']
    if (entries.length === 0) {
      return [{ indent, path, value, keyLabel, text: open + close, kind: 'bracket', comma }]
    }
    return [
      { indent, path, value, keyLabel, text: open, kind: 'bracket', comma: false },
      ...entries.flatMap(([key, child], i) =>
        toLines(child, [...path, key], indent + 1, isArray ? undefined : String(key), i < entries.length - 1),
      ),
      { indent, path, value: undefined, text: close, kind: 'bracket', comma },
    ]
  }
  const kind = typeof value === 'string' ? 'string' : typeof value === 'number' ? 'number' : 'other'
  return [{ indent, path, value, keyLabel, text: JSON.stringify(value), kind, comma }]
}

/** Pretty-printed JSON, one element per line so single fields can be highlighted. */
export function JsonView({ label, value, linkFor }: { label: string; value: unknown; linkFor?: LinkFor }) {
  const lines = toLines(value, [], 0, undefined, false)
  return (
    <figure className="json">
      <figcaption>{label}</figcaption>
      <div className="json-body">
        {lines.map((line, i) => (
          <JsonLine key={i} line={line} link={line.value === undefined ? undefined : linkFor?.(line.path, line.value)} />
        ))}
      </div>
    </figure>
  )
}

function JsonLine({ line, link }: { line: Line; link: string | undefined }) {
  const linkProps = useLink(link)
  return (
    // Wrapped lines hang under their first character rather than under the margin.
    <div className="json-line" style={{ paddingLeft: `${line.indent * 2 + 2}ch` }} {...linkProps}>
      {line.keyLabel !== undefined && (
        <>
          <span className="json-key">{JSON.stringify(line.keyLabel)}</span>
          {': '}
        </>
      )}
      <span className={`json-${line.kind}`}>{line.text}</span>
      {line.comma && ','}
    </div>
  )
}
