import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { costUsd } from '../../shared/types'
import { JsonView } from '../components/JsonView'
import { CaseItem, show } from './CaseItem'
import { evaluate, matches, MAX_QUESTIONS, toCode, toQuestions, validate } from './engine'
import { askOnce, recall } from './memo'
import { QuestionEditor } from './QuestionEditor'
import { RulesEditor } from './RulesEditor'
import { describe } from './sandbox'
import type { CardPuzzle, CardQuestion, Program } from './types'

let uidCounter = 0
const newUid = () => `new-${++uidCounter}`

type Props = {
  puzzle: CardPuzzle
  program: Program
  onChange: (next: Program) => void
  technical: boolean
  /** The Cards / Code switch, shown in the panel's header. */
  toggle: ReactNode
  onEditAsCode: () => void
  onSolvedChange: (solved: boolean) => void
}

/** A puzzle as question cards and rules: one request per input, re-scored in the page when only a rule changes. */
export function CardsBench({ puzzle, program, onChange, technical, toggle, onEditAsCode, onSolvedChange }: Props) {
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Bumped when the answer memo gains entries, since it lives outside React.
  const [, setVersion] = useState(0)

  const problems = useMemo(() => validate(puzzle, program), [puzzle, program])
  const questions = useMemo(() => (problems.length === 0 ? toQuestions(program) : null), [problems, program])
  // A stable string for effects: the questions object is rebuilt on every edit.
  const questionsKey = questions ? JSON.stringify(questions) : ''

  const rows = puzzle.cases.map((testCase) => {
    const response = questions ? recall({ state: testCase.state, questions }) : undefined
    const result = response ? evaluate(puzzle, program, response.answers) : undefined
    return { testCase, response, result, correct: result !== undefined && matches(result, testCase.expected) }
  })
  const waiting = rows.filter((row) => !row.response).length
  const right = rows.filter((row) => row.correct).length
  const solved = waiting === 0 && right === rows.length
  const tokens = rows.reduce((sum, row) => sum + (row.response?.usage.input_tokens ?? 0), 0)

  useEffect(() => onSolvedChange(solved), [solved, onSolvedChange])

  // An error belongs to the questions it happened with.
  useEffect(() => setError(null), [questionsKey])

  async function run() {
    if (!questions) return
    setRunning(true)
    setError(null)
    const settled = await Promise.allSettled(puzzle.cases.map((testCase) => askOnce({ state: testCase.state, questions })))
    const failure = settled.find((outcome) => outcome.status === 'rejected')
    if (failure?.status === 'rejected') setError(describe(failure.reason))
    setVersion((version) => version + 1)
    setRunning(false)
  }

  const setQuestion = (uid: string, next: CardQuestion) =>
    onChange({ ...program, questions: program.questions.map((question) => (question.uid === uid ? next : question)) })

  function addQuestion() {
    const taken = new Set(program.questions.map((question) => question.name))
    let n = program.questions.length + 1
    while (taken.has(`question_${n}`)) n += 1
    const blank: CardQuestion = { uid: newUid(), name: `question_${n}`, type: 'noul', instructions: '', options: [], levels: [] }
    onChange({ ...program, questions: [...program.questions, blank] })
  }

  const count = puzzle.cases.length
  const plural = `${puzzle.input}s`

  return (
    <div className="workbench">
      <div className="panel">
        <div className="step-head">
          <h3>
            <span className="step">1</span> Ask Jev
          </h3>
          <div className="step-tools">
            {toggle}
            <button type="button" className="link" onClick={() => onChange(puzzle.starter)}>
              Start over
            </button>
          </div>
        </div>
        <p className="muted small">These questions are sent with each {puzzle.input}, all in one request.</p>
        <div className="qcards">
          {program.questions.map((question) => (
            <QuestionEditor
              key={question.uid}
              question={question}
              onChange={(next) => setQuestion(question.uid, next)}
              onRemove={() => onChange({ ...program, questions: program.questions.filter((other) => other.uid !== question.uid) })}
            />
          ))}
        </div>
        {program.questions.length < MAX_QUESTIONS && (
          <button type="button" className="add" onClick={addQuestion}>
            + Add a question
          </button>
        )}

        <div className="step-head second">
          <h3>
            <span className="step">2</span> Decide
          </h3>
        </div>
        <p className="muted small">Your code turns the answers into a result. Changing it doesn’t need a new request.</p>
        <RulesEditor puzzle={puzzle} program={program} onChange={onChange} newUid={newUid} />

        {technical && (
          <>
            {questions && (
              <JsonView
                label={`Request for the first ${puzzle.input} · POST api.typesafe.ai/v1/systemone`}
                value={{ model: rows[0]?.response?.model ?? 'jev-1.14.0', state: puzzle.cases[0]!.state, questions }}
              />
            )}
            <figure className="json">
              <figcaption>
                The same solution as code
                <button type="button" className="link" onClick={onEditAsCode}>
                  Edit it
                </button>
              </figcaption>
              <pre className="code">{toCode(puzzle, program)}</pre>
            </figure>
          </>
        )}
      </div>

      <div className="panel">
        <div className="step-head">
          <h3>
            <span className="step">3</span> Check
          </h3>
          <p className="tally" role="status">
            {waiting === count ? `${count} ${plural}` : `${right} of ${count} right`}
          </p>
        </div>

        {problems.length > 0 ? (
          <ul className="problems">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        ) : waiting > 0 ? (
          <div className="run-row">
            <button type="button" className="primary" onClick={run} disabled={running}>
              {running ? 'Asking Jev…' : `Ask Jev about ${waiting === count ? `all ${count}` : `${waiting} more`}`}
            </button>
          </div>
        ) : (
          <p className="muted small stats">
            {count} requests · {tokens.toLocaleString('en-US')} tokens · ${costUsd(tokens).toFixed(6)}
          </p>
        )}
        {error && <p className="error small">{error}</p>}

        <ul className="cases">
          {rows.map(({ testCase, response, result, correct }) => (
            <CaseItem
              key={testCase.id}
              state={testCase.state}
              steps={response ? [response.answers] : []}
              verdict={response ? (correct ? 'right' : 'wrong') : undefined}
              yours={show(puzzle, result)}
              expected={show(puzzle, testCase.expected)}
            />
          ))}
        </ul>
      </div>
    </div>
  )
}
