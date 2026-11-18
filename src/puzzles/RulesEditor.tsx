import type { CardPuzzle, CardQuestion, Condition, Program, Result, Rule } from './types'

type Props = {
  puzzle: CardPuzzle
  program: Program
  onChange: (next: Program) => void
  newUid: () => string
}

/**
 * The code half of a solution: how Jev's answers become a result. Editing it never
 * needs a new request, because the answers don't change.
 */
export function RulesEditor({ puzzle, program, onChange, newUid }: Props) {
  if (puzzle.result.kind === 'set') {
    return (
      <div className="rules">
        <p className="rule-text">
          Every yes-or-no question answered at least{' '}
          <input
            type="number"
            className="num"
            aria-label="Cutoff for yes"
            min={0}
            max={1}
            step={0.05}
            value={Number.isFinite(program.threshold) ? program.threshold : ''}
            onChange={(event) => onChange({ ...program, threshold: event.target.valueAsNumber })}
          />{' '}
          adds its name to the {puzzle.result.noun}. A choice adds whatever it picks.
        </p>
        <p className="muted small">
          So name each question after what it stands for: {puzzle.result.items.map((item) => <code key={item}>{item}</code>)}
        </p>
      </div>
    )
  }

  const { questions } = program
  const outcomes = puzzle.result.outcomes
  const setRule = (uid: string, next: Rule) => onChange({ ...program, rules: program.rules.map((rule) => (rule.uid === uid ? next : rule)) })

  function addRule() {
    const first = questions[0]
    if (!first) return
    const rule: Rule = { uid: newUid(), when: defaultCondition(first), then: { kind: 'outcome', outcome: outcomes[0]!.id } }
    onChange({ ...program, rules: [...program.rules, rule] })
  }

  return (
    <div className="rules">
      {program.rules.map((rule, index) => {
        const question = questions.find((candidate) => candidate.uid === rule.when.question)
        return (
          <div key={rule.uid} className="rule">
            <span className="rule-word">{index === 0 ? 'If' : 'Else if'}</span>
            <select
              className="mono"
              aria-label={`Rule ${index + 1} question`}
              value={question ? rule.when.question : ''}
              onChange={(event) => {
                const next = questions.find((candidate) => candidate.uid === event.target.value)
                if (next) setRule(rule.uid, { ...rule, when: retarget(rule.when, next) })
              }}
            >
              {!question && <option value="">(removed)</option>}
              {questions.map((candidate) => (
                <option key={candidate.uid} value={candidate.uid}>
                  {candidate.name || '(unnamed)'}
                </option>
              ))}
            </select>
            {question && <ConditionFields rule={rule} index={index} question={question} onChange={(when) => setRule(rule.uid, { ...rule, when })} />}
            <span className="rule-word">then</span>
            <ResultSelect
              label={`Rule ${index + 1} result`}
              result={rule.then}
              puzzle={puzzle}
              questions={questions}
              onChange={(then) => setRule(rule.uid, { ...rule, then })}
            />
            <button
              type="button"
              className="icon"
              aria-label={`Remove rule ${index + 1}`}
              onClick={() => onChange({ ...program, rules: program.rules.filter((candidate) => candidate.uid !== rule.uid) })}
            >
              ×
            </button>
          </div>
        )
      })}
      <div className="rule">
        <span className="rule-word">{program.rules.length === 0 ? 'Always' : 'Otherwise'}</span>
        <ResultSelect
          label="Result when no rule applies"
          result={program.otherwise}
          puzzle={puzzle}
          questions={questions}
          onChange={(otherwise) => onChange({ ...program, otherwise })}
        />
      </div>
      <button type="button" className="add" onClick={addRule} disabled={questions.length === 0}>
        + Add a rule
      </button>
    </div>
  )
}

function defaultCondition(question: CardQuestion): Condition {
  return { question: question.uid, op: 'gte', value: 0.5 }
}

/** Point a condition at another question, keeping the comparison when it still makes sense. */
function retarget(condition: Condition, question: CardQuestion): Condition {
  if (condition.op === 'picks') {
    return question.type === 'choice'
      ? { question: question.uid, op: 'picks', option: question.options[0]?.name ?? '' }
      : defaultCondition(question)
  }
  return { ...condition, question: question.uid }
}

type ConditionProps = { rule: Rule; index: number; question: CardQuestion; onChange: (when: Condition) => void }

function ConditionFields({ rule, index, question, onChange }: ConditionProps) {
  const { when } = rule
  const isChoice = question.type === 'choice'
  const top = question.type === 'score' ? Math.max(1, question.levels.length - 1) : 1

  function setOp(op: Condition['op']) {
    if (op === 'picks') onChange({ question: question.uid, op, option: question.options[0]?.name ?? '' })
    else onChange({ question: question.uid, op, value: when.op === 'picks' ? 0.5 : when.value })
  }

  return (
    <>
      <select aria-label={`Rule ${index + 1} comparison`} value={when.op} onChange={(event) => setOp(event.target.value as Condition['op'])}>
        {isChoice && <option value="picks">picks</option>}
        <option value="gte">{isChoice ? 'is sure of its pick, at least' : 'is at least'}</option>
        <option value="lt">{isChoice ? 'is unsure of its pick, below' : 'is below'}</option>
      </select>
      {when.op === 'picks' ? (
        <select
          className="mono"
          aria-label={`Rule ${index + 1} option`}
          value={when.option}
          onChange={(event) => onChange({ ...when, option: event.target.value })}
        >
          {!question.options.some((option) => option.name === when.option) && <option value={when.option}>(removed)</option>}
          {question.options.map((option, i) => (
            <option key={i} value={option.name}>
              {option.name || '(unnamed)'}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="number"
          className="num"
          aria-label={`Rule ${index + 1} value`}
          min={0}
          max={top}
          step={0.05}
          value={Number.isFinite(when.value) ? when.value : ''}
          onChange={(event) => onChange({ ...when, value: event.target.valueAsNumber })}
        />
      )}
    </>
  )
}

type ResultSelectProps = {
  label: string
  result: Result
  puzzle: CardPuzzle
  questions: CardQuestion[]
  onChange: (result: Result) => void
}

// Encoded as "o:<outcome id>" or "p:<question uid>" so one <select> can hold both kinds.
function ResultSelect({ label, result, puzzle, questions, onChange }: ResultSelectProps) {
  if (puzzle.result.kind !== 'one') return null
  const choices = questions.filter((question) => question.type === 'choice')
  const value = result.kind === 'outcome' ? `o:${result.outcome}` : `p:${result.question}`
  const known = result.kind === 'outcome' || choices.some((question) => question.uid === result.question)
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => {
        const [kind, id] = [event.target.value.slice(0, 1), event.target.value.slice(2)]
        onChange(kind === 'o' ? { kind: 'outcome', outcome: id } : { kind: 'pick', question: id })
      }}
    >
      {!known && <option value={value}>(removed)</option>}
      {puzzle.result.outcomes.map((outcome) => (
        <option key={outcome.id} value={`o:${outcome.id}`}>
          {outcome.label}
        </option>
      ))}
      {choices.map((question) => (
        <option key={question.uid} value={`p:${question.uid}`}>
          whatever {question.name || '(unnamed)'} picks
        </option>
      ))}
    </select>
  )
}
