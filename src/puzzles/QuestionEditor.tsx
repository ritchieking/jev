import { MAX_LEVELS, MAX_OPTIONS } from './engine'
import type { CardQuestion, QuestionType } from './types'

const TYPES: { value: QuestionType; label: string }[] = [
  { value: 'noul', label: 'Noul · yes or no' },
  { value: 'choice', label: 'Choice · one option' },
  { value: 'score', label: 'Score · a scale' },
]

type Props = {
  question: CardQuestion
  onChange: (next: CardQuestion) => void
  onRemove: () => void
}

/** One question card: its type, its name in the request, and what it asks. */
export function QuestionEditor({ question, onChange, onRemove }: Props) {
  const set = (patch: Partial<CardQuestion>) => onChange({ ...question, ...patch })
  const label = question.name || 'question'

  function setType(type: QuestionType) {
    // Give a freshly switched card the minimum it needs to be valid.
    const options = type === 'choice' && question.options.length === 0 ? [blankOption(), blankOption()] : question.options
    const levels = type === 'score' && question.levels.length === 0 ? ['', ''] : question.levels
    set({ type, options, levels })
  }

  return (
    <div className="qcard">
      <div className="qcard-head">
        <select aria-label={`Type of ${label}`} value={question.type} onChange={(event) => setType(event.target.value as QuestionType)}>
          {TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        <input
          className="mono"
          aria-label="Question name"
          placeholder="name"
          spellCheck={false}
          autoCapitalize="none"
          value={question.name}
          onChange={(event) => set({ name: event.target.value })}
        />
        <button type="button" className="icon" aria-label={`Remove ${label}`} onClick={onRemove}>
          ×
        </button>
      </div>

      <textarea
        aria-label={`What ${label} asks`}
        placeholder="What do you want to ask?"
        rows={2}
        value={question.instructions}
        onChange={(event) => set({ instructions: event.target.value })}
      />

      {question.type === 'choice' && (
        <div className="qcard-list">
          <p className="field-label">Options</p>
          {question.options.map((option, index) => (
            <div key={index} className="qcard-row">
              <input
                className="mono narrow"
                aria-label={`Option ${index + 1} name`}
                placeholder="name"
                spellCheck={false}
                autoCapitalize="none"
                value={option.name}
                onChange={(event) => set({ options: replaceAt(question.options, index, { ...option, name: event.target.value }) })}
              />
              <input
                aria-label={`Option ${index + 1} description`}
                placeholder="What it means (optional)"
                value={option.description}
                onChange={(event) =>
                  set({ options: replaceAt(question.options, index, { ...option, description: event.target.value }) })
                }
              />
              <button
                type="button"
                className="icon"
                aria-label={`Remove option ${option.name || index + 1}`}
                onClick={() => set({ options: question.options.filter((_, i) => i !== index) })}
              >
                ×
              </button>
            </div>
          ))}
          {question.options.length < MAX_OPTIONS && (
            <button type="button" className="add" onClick={() => set({ options: [...question.options, blankOption()] })}>
              + Add an option
            </button>
          )}
        </div>
      )}

      {question.type === 'score' && (
        <div className="qcard-list">
          <p className="field-label">Levels, lowest first</p>
          {question.levels.map((level, index) => (
            <div key={index} className="qcard-row">
              <span className="level-index">{index}</span>
              <input
                aria-label={`Level ${index}`}
                placeholder="What this level means"
                value={level}
                onChange={(event) => set({ levels: replaceAt(question.levels, index, event.target.value) })}
              />
              <button
                type="button"
                className="icon"
                aria-label={`Remove level ${index}`}
                onClick={() => set({ levels: question.levels.filter((_, i) => i !== index) })}
              >
                ×
              </button>
            </div>
          ))}
          {question.levels.length < MAX_LEVELS && (
            <button type="button" className="add" onClick={() => set({ levels: [...question.levels, ''] })}>
              + Add a level
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const blankOption = () => ({ name: '', description: '' })

function replaceAt<T>(items: T[], index: number, next: T): T[] {
  return items.map((item, i) => (i === index ? next : item))
}
