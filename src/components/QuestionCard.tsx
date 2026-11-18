import type {
  Answer,
  ChoiceAnswer,
  ChoiceQuestion,
  NoulAnswer,
  Question,
  ScoreAnswer,
  ScoreQuestion,
  Structured,
} from '../../shared/types'
import { optionKey, useLink, valueKey } from './Highlight'
import { JsonView, type LinkFor } from './JsonView'

const KIND: Record<Question['type'], { name: string; gloss: string }> = {
  noul: { name: 'Noul', gloss: 'A yes-or-no question. Jev answers with how likely “yes” is.' },
  choice: { name: 'Choice', gloss: 'A pick from options you define. Every option gets a probability.' },
  score: {
    name: 'Score',
    gloss: 'A place on a scale you define. The score is the average of the levels, weighted by how likely each one is.',
  },
}

const pct = (p: number) => `${Math.round(p * 100)}%`

function text(value: Structured | null | undefined): string {
  if (value == null) return ''
  return typeof value === 'string' ? value : JSON.stringify(value)
}

type Props = {
  id: string
  question: Question
  /** Undefined until Jev has answered. */
  answer: Answer | undefined
  /** Show the JSON behind the card, linked to the chart by hover. */
  technical: boolean
}

/** One question and Jev's answer to it, drawn in the shape that primitive answers in. */
export function QuestionCard({ id, question, answer, technical }: Props) {
  const kind = KIND[question.type]
  const linked = technical ? id : undefined
  return (
    <article className="panel question">
      <p className="kind">{kind.name}</p>
      <p className="gloss">{kind.gloss}</p>
      <h3>{text(question.instructions)}</h3>
      {question.type === 'noul' && <Noul linked={linked} answer={answer?.type === 'noul' ? answer : undefined} />}
      {question.type === 'choice' && (
        <Choice linked={linked} question={question} answer={answer?.type === 'choice' ? answer : undefined} />
      )}
      {question.type === 'score' && (
        <Score linked={linked} question={question} answer={answer?.type === 'score' ? answer : undefined} />
      )}
      {technical && (
        <>
          <JsonView label="Question" value={{ [id]: question }} linkFor={linkForQuestions} />
          {answer && <JsonView label="Answer" value={{ [id]: answer }} linkFor={linkForAnswers} />}
        </>
      )}
    </article>
  )
}

/** Maps a path inside a `questions` object to the chart element it defines. */
export const linkForQuestions: LinkFor = (path) => {
  const [id, field, key] = path
  if (path.length === 3 && field === 'criteria' && key !== 'true' && key !== 'false') return optionKey(String(id), key!)
  return undefined
}

/** Maps a path inside an `answers` object to the chart element it produces. */
export const linkForAnswers: LinkFor = (path, value) => {
  const [id, field, key] = path
  if (path.length === 3 && (field === 'probabilities' || field === 'legend')) return optionKey(String(id), key!)
  if (path.length === 2 && field === 'choice' && typeof value === 'string') return optionKey(String(id), value)
  if (path.length === 2 && (field === 'noul' || field === 'score')) return valueKey(String(id))
  return undefined
}

const NO_ANSWER = <p className="answer-headline muted">No answer yet</p>

// One number: how likely the answer is yes.
function Noul({ linked, answer }: { linked: string | undefined; answer: NoulAnswer | undefined }) {
  const link = useLink(linked && valueKey(linked))
  const verdict = !answer ? '' : answer.noul >= 0.7 ? 'Yes' : answer.noul <= 0.3 ? 'No' : 'Unsure'
  return (
    <div className="answer">
      <div className="linkable" {...link}>
        {answer ? (
          <p className="answer-headline">
            {verdict} <span className="muted">{pct(answer.noul)} likely yes</span>
          </p>
        ) : (
          NO_ANSWER
        )}
        <div className="noul-track" role="img" aria-label={answer ? `${pct(answer.noul)} likely yes` : 'No answer yet'}>
          <div className="noul-fill" style={{ width: answer ? pct(answer.noul) : 0 }} />
          <span className="noul-tick" style={{ left: '30%' }} />
          <span className="noul-tick" style={{ left: '70%' }} />
        </div>
        <div className="noul-ends muted">
          <span>No</span>
          <span>Yes</span>
        </div>
      </div>
      <p className="caption">
        The marks at 30% and 70% are TypeSafe’s suggested starting cutoffs for “no” and “yes.” You set your own.
      </p>
    </div>
  )
}

// A probability for every option you offered; the largest is the pick.
function Choice({ linked, question, answer }: { linked: string | undefined; question: ChoiceQuestion; answer: ChoiceAnswer | undefined }) {
  return (
    <div className="answer">
      {answer ? (
        <p className="answer-headline">
          {answer.choice} <span className="muted">{pct(answer.probabilities[answer.choice] ?? 0)}</span>
        </p>
      ) : (
        NO_ANSWER
      )}
      <ul className="bars">
        {Object.entries(question.criteria).map(([name, description]) => (
          <BarRow
            key={name}
            link={linked && optionKey(linked, name)}
            label={name}
            detail={text(description)}
            p={answer?.probabilities[name]}
            picked={name === answer?.choice}
          />
        ))}
      </ul>
    </div>
  )
}

// A probability for every level; the score is their weighted average, so it can land between levels.
function Score({ linked, question, answer }: { linked: string | undefined; question: ScoreQuestion; answer: ScoreAnswer | undefined }) {
  const link = useLink(linked && valueKey(linked))
  const levels = question.criteria.map((_, i) => i)
  const top = levels.length - 1
  const p = (level: number) => answer?.probabilities[String(level)]
  const likeliest = answer ? levels.reduce((best, level) => ((p(level) ?? 0) > (p(best) ?? 0) ? level : best), 0) : undefined
  return (
    <div className="answer">
      <div className="linkable" {...link}>
        {answer ? (
          <p className="answer-headline">
            {answer.score.toFixed(2)} <span className="muted">on a scale of 0 to {top}</span>
          </p>
        ) : (
          NO_ANSWER
        )}
        <div className="scale" role="img" aria-label={answer ? `Score ${answer.score.toFixed(2)} of ${top}` : 'No answer yet'}>
          <div className="scale-line" />
          {levels.map((level) => (
            <span key={level} className="scale-tick" style={{ left: `${(level / top) * 100}%` }}>
              {level}
            </span>
          ))}
          {answer && <span className="scale-dot" style={{ left: `${(answer.score / top) * 100}%` }} />}
        </div>
      </div>
      <ul className="bars">
        {levels.map((level) => (
          <BarRow
            key={level}
            link={linked && optionKey(linked, level)}
            label={String(level)}
            detail={text(question.criteria[level])}
            p={p(level)}
            picked={level === likeliest}
          />
        ))}
      </ul>
    </div>
  )
}

type BarRowProps = { link: string | undefined; label: string; detail: string; p: number | undefined; picked: boolean }

function BarRow({ link, label, detail, p, picked }: BarRowProps) {
  const linkProps = useLink(link)
  return (
    <li className={picked ? 'picked' : undefined} {...linkProps}>
      <span className="bar-label">
        <span className="bar-name">{label}</span>
        {detail && <span className="bar-detail">{detail}</span>}
      </span>
      <span className="bar-track">
        <span className="bar-fill" style={{ width: p === undefined ? 0 : pct(p) }} />
      </span>
      <span className="bar-value">{p === undefined ? '–' : pct(p)}</span>
    </li>
  )
}
