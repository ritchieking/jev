import { useState } from 'react'
import { costUsd, PRICE_PER_MTOK_USD, type AskResponse } from '../../shared/types'
import type { Mode } from '../App'
import { CardStack, type StackCard } from '../components/CardStack'
import { HighlightProvider, optionKey } from '../components/Highlight'
import { JsonView, type LinkFor } from '../components/JsonView'
import { QuestionCard } from '../components/QuestionCard'
import recordedJson from '../data/recorded.json'
import { PRESETS, QUESTIONS, stateOf } from '../data/sample'
import { ApiError, ask } from '../lib/api'

type Recorded = { recordedAt: string; model: string; responses: Record<string, AskResponse> }
const RECORDED = recordedJson as Recorded

const RECORDED_ON = new Date(`${RECORDED.recordedAt}T00:00:00Z`).toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

// The figures quoted in the prose come from the recorded answers, so they can't drift from them.
const recordedResponses = Object.values(RECORDED.responses)
const range = (values: number[]) => ({ min: Math.min(...values), max: Math.max(...values) })
const TOKENS = range(recordedResponses.map((response) => response.usage.input_tokens))
const MILLISECONDS = range(recordedResponses.map((response) => response.meta.upstream_ms))

const PER_DOLLAR = Math.floor(1 / costUsd(TOKENS.max) / 1000) * 1000

const MAX_OWN_LENGTH = 2000
/** The last card in the pile is blank, for the reader's own pitch. */
const OWN_INDEX = PRESETS.length
const CARD_COUNT = PRESETS.length + 1

/** A live request, remembered with the context it was asked about so it can't be shown for another. */
type Live = {
  state: string
  status: { kind: 'asking' } | { kind: 'done'; response: AskResponse } | { kind: 'failed'; error: ApiError }
}

export function Basics({ mode }: { mode: Mode }) {
  const [current, setCurrent] = useState(0)
  const [ownText, setOwnText] = useState('')
  const [live, setLive] = useState<Live | null>(null)

  const preset = PRESETS[current]
  const state = preset ? stateOf(preset) : ownText.trim()
  const liveHere = live?.state === state ? live.status : null
  const liveResponse = liveHere?.kind === 'done' ? liveHere.response : null
  const response = liveResponse ?? (preset ? RECORDED.responses[preset.id] : undefined)
  const asking = liveHere?.kind === 'asking'
  const technical = mode === 'technical'

  /** `fresh` skips the proxy's cache, so "again" really is a new answer. */
  async function run(fresh: boolean) {
    const asked = state
    const stillCurrent = (now: Live | null) => now?.state === asked && now.status.kind === 'asking'
    setLive({ state: asked, status: { kind: 'asking' } })
    try {
      const answered = await ask({ state: asked, questions: QUESTIONS, fresh })
      setLive((now) => (stillCurrent(now) ? { state: asked, status: { kind: 'done', response: answered } } : now))
    } catch (err) {
      const error = err instanceof ApiError ? err : new ApiError('server', 'Something went wrong. Try again.')
      setLive((now) => (stillCurrent(now) ? { state: asked, status: { kind: 'failed', error } } : now))
    }
  }

  const ownEditor = (
    <>
      <textarea
        aria-label="Your pitch"
        placeholder="Write a pitch of your own: a title, and a sentence or two about the film."
        rows={5}
        maxLength={MAX_OWN_LENGTH}
        value={ownText}
        onChange={(event) => setOwnText(event.target.value)}
      />
      <div className="run-row">
        <button type="button" className="primary" onClick={() => run(false)} disabled={asking || state === ''}>
          {asking ? 'Asking…' : 'Ask Jev'}
        </button>
        <p className="small">This one is sent to Jev live.</p>
      </div>
    </>
  )

  const cards: StackCard[] = [
    ...PRESETS.map((option, index) => ({
      id: option.id,
      label: option.title,
      content: (
        <>
          <p className="eyebrow">
            Pitch {index + 1} of {PRESETS.length}
          </p>
          <h3>{option.title}</h3>
          <p className="pitch">{option.pitch}</p>
        </>
      ),
    })),
    {
      id: 'own',
      label: 'Your own pitch',
      content: (
        <>
          <p className="eyebrow">Your pitch</p>
          {ownEditor}
        </>
      ),
    },
  ]

  const receipt = (
    <div className="receipt" role="status">
      {liveHere?.kind === 'failed' ? (
        <p className="error">{failureMessage(liveHere.error)}</p>
      ) : asking ? (
        <p>Asking Jev…</p>
      ) : response ? (
        <>
          <p className="figures">
            <span>1 request</span>
            <span>{response.usage.input_tokens.toLocaleString('en-US')} tokens</span>
            <span>{formatCost(response.usage.input_tokens)}</span>
            <span>{response.meta.upstream_ms} ms</span>
          </p>
          <p className="when">
            {liveResponse ? 'Answered just now' : `Recorded ${RECORDED_ON}`} by {response.model}
            {preset && (
              <button type="button" className="link" onClick={() => run(true)}>
                Ask again
              </button>
            )}
          </p>
        </>
      ) : (
        <p>All three questions go in one request.</p>
      )}
    </div>
  )

  const notice = preset && (
    <p className="notice">
      <strong>What to notice.</strong> {preset.notice}
    </p>
  )

  return (
    <HighlightProvider>
      <header className="hero">
        <h1>
          Using <span className="hi">Jev</span>
        </h1>
        <p className="lede">
          Jev is an AI model that makes decisions instead of writing. You hand it something to look at and a list of
          questions about it, and it answers each one with numbers your code can act on: how likely a yes is, which
          option fits best, where something falls on a scale.
        </p>
        <p className="lede">
          It comes from <a href="https://docs.typesafe.ai/introduction">TypeSafe</a>, a company betting that most AI
          work will happen between pieces of software, not in a chat window. So Jev never writes a reply or explains
          itself. It only decides.
        </p>
      </header>

      <section className="prose">
        <h2 className="section-head">an example</h2>
        <p>
          Say you program a small film festival. A few hundred pitches come in, each one a title and a couple of
          sentences, and before anyone watches anything you want to know three things about every film: whether it
          claims to be a true story (those get fact-checked), which programme it belongs in, and how frightening it is
          (so nothing terrifying lands in the matinee).
        </p>
        <p>
          Those are three questions. You write them once and send them to Jev along with each pitch.{' '}
          {technical ? (
            <>
              A request is one POST with two fields: <code>state</code>, the thing you are asking about, and{' '}
              <code>questions</code>, under names you choose. The response has one answer under each name.
            </>
          ) : (
            'Flip through the pile to see how it answered.'
          )}
        </p>
      </section>

      {technical ? (
        // Request and response side by side, each under the line that belongs to it.
        <section className="example technical">
          <div className="area-pager">
            <Pager current={current} onChange={setCurrent} label={cards[current]!.label} />
            {!preset && <div className="own-technical">{ownEditor}</div>}
          </div>
          <div className="area-request">
            <JsonView
              label="Request · POST api.typesafe.ai/v1/systemone"
              value={{ model: response?.model ?? RECORDED.model, state, questions: QUESTIONS }}
              linkFor={under('questions')}
            />
            {notice}
          </div>
          <div className="area-receipt">{receipt}</div>
          <div className="area-response">
            {response ? (
              <JsonView
                label="Response"
                value={{ model: response.model, answers: response.answers, usage: response.usage }}
                linkFor={under('answers')}
              />
            ) : (
              <p className="small">The response appears here once Jev has answered.</p>
            )}
          </div>
        </section>
      ) : (
        <section className="example">
          <div className="example-side left">
            <p className="col-label">the pitches</p>
            <CardStack cards={cards} current={current} onChange={setCurrent} label="Pitches" />
            {notice}
          </div>
          <div className="example-side right">
            <p className="col-label">the answers</p>
            {receipt}
            <div className="answers">
              {Object.entries(QUESTIONS).map(([id, question]) => (
                <QuestionCard key={id} question={question} answer={response?.answers[id]} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="prose">
        <h2 className="section-head">time and tokens</h2>
        <p>
          Each request above carried one pitch and three questions. On the recorded runs that came to between{' '}
          {TOKENS.min} and {TOKENS.max} tokens, and Jev took between {MILLISECONDS.min} and {MILLISECONDS.max}{' '}
          milliseconds to answer, measured from this site’s server.
        </p>
        <p>
          TypeSafe <a href="https://docs.typesafe.ai/models">charges</a> ${PRICE_PER_MTOK_USD} per million tokens that
          Jev reads and nothing for its answers. That puts the largest of these requests at {formatCost(TOKENS.max)}, or
          about {PER_DOLLAR.toLocaleString('en-US')} of them for a dollar.
        </p>
        <p>
          Jev reads the pitch once and answers every question about it at the same time, so a fourth question adds a
          few dozen tokens, not another request. TypeSafe{' '}
          <a href="https://docs.typesafe.ai/cookbooks/parallel_questions">tried this</a> with 13 questions about one
          long article: sent together, they cost 12.2 times less and came back 11.8 times faster than the same 13 sent
          one at a time.
        </p>
        <p>
          <a className="cta" href="#puzzles">
            Next: Jev puzzles →
          </a>
        </p>
      </section>
    </HighlightProvider>
  )
}

/** Steps through the cards when there is no pile to flip through. */
function Pager({ current, onChange, label }: { current: number; onChange: (index: number) => void; label: string }) {
  const step = (by: number) => onChange((current + by + CARD_COUNT) % CARD_COUNT)
  return (
    <div className="pager">
      <button type="button" className="round" aria-label="Previous pitch" onClick={() => step(-1)}>
        ←
      </button>
      <p role="status">
        <span className="eyebrow">{current === OWN_INDEX ? 'Your pitch' : `Pitch ${current + 1} of ${PRESETS.length}`}</span>
        {current !== OWN_INDEX && <strong>{label}</strong>}
      </p>
      <button type="button" className="round" aria-label="Next pitch" onClick={() => step(1)}>
        →
      </button>
    </div>
  )
}

/**
 * Links the request to the response: hovering a question, an option or a level in
 * one lights up its counterpart in the other. `field` is where the questions or
 * answers sit in the JSON being shown.
 */
function under(field: 'questions' | 'answers'): LinkFor {
  return (path, value) => {
    if (path[0] !== field) return undefined
    const [, id, part, key] = path
    if (path.length === 2) return `question/${id}`
    const lists = field === 'questions' ? ['criteria'] : ['probabilities', 'legend']
    if (path.length === 4 && lists.includes(String(part))) return optionKey(String(id), key!)
    if (path.length === 3 && part === 'choice' && typeof value === 'string') return optionKey(String(id), value)
    return undefined
  }
}

// A request here costs a few thousandths of a cent, so show enough digits to see it.
function formatCost(inputTokens: number): string {
  return `$${costUsd(inputTokens).toFixed(6)}`
}

function failureMessage(error: ApiError): string {
  if (error.code === 'not_configured') return 'The server doesn’t have a Jev key yet, so live answers are off.'
  if (error.retryAfterSeconds) return `${error.message} Try again in ${error.retryAfterSeconds}s.`
  return error.message
}
