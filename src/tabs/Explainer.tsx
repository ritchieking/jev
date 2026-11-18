import { useState } from 'react'
import { costUsd, type AskResponse } from '../../shared/types'
import type { Mode } from '../App'
import { HighlightProvider } from '../components/Highlight'
import { JsonView, type LinkFor } from '../components/JsonView'
import { linkForAnswers, linkForQuestions, QuestionCard } from '../components/QuestionCard'
import recordedJson from '../data/recorded.json'
import { PRESETS, QUESTIONS } from '../data/sample'
import { ApiError, ask } from '../lib/api'

type Recorded = { recordedAt: string; model: string; responses: Record<string, AskResponse> }
const RECORDED = recordedJson as Recorded

const RECORDED_ON = new Date(`${RECORDED.recordedAt}T00:00:00Z`).toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

const OWN = 'own'
const MAX_OWN_LENGTH = 2000

/** A live request, remembered with the context it was asked about so it can't be shown for another. */
type Live = {
  state: string
  status: { kind: 'asking' } | { kind: 'done'; response: AskResponse } | { kind: 'failed'; error: ApiError }
}

export function Explainer({ mode }: { mode: Mode }) {
  const [selected, setSelected] = useState(PRESETS[0]!.id)
  const [ownText, setOwnText] = useState('')
  const [live, setLive] = useState<Live | null>(null)

  const preset = PRESETS.find((candidate) => candidate.id === selected)
  const state = preset ? preset.state : ownText.trim()
  const liveHere = live?.state === state ? live.status : null
  const liveResponse = liveHere?.kind === 'done' ? liveHere.response : null
  const response = liveResponse ?? (preset ? RECORDED.responses[preset.id] : undefined)
  const asking = liveHere?.kind === 'asking'
  const technical = mode === 'technical'

  async function run() {
    const asked = state
    const stillCurrent = (current: Live | null) => current?.state === asked && current.status.kind === 'asking'
    setLive({ state: asked, status: { kind: 'asking' } })
    try {
      const fresh = await ask({ state: asked, questions: QUESTIONS })
      setLive((current) => (stillCurrent(current) ? { state: asked, status: { kind: 'done', response: fresh } } : current))
    } catch (err) {
      const error = err instanceof ApiError ? err : new ApiError('server', 'Something went wrong. Try again.')
      setLive((current) => (stillCurrent(current) ? { state: asked, status: { kind: 'failed', error } } : current))
    }
  }

  return (
    <HighlightProvider>
      <section className="stack">
        <p className="intro">
          Every request to Jev has two parts: some context, and questions about it. Here the context is a message to a
          support inbox, and the same three questions are asked of each one.
        </p>

        <div className="panel">
          <div className="panel-head">
            <h2>The context{technical && <code>state</code>}</h2>
            <div className="chips" role="group" aria-label="Choose a message">
              {PRESETS.map((option) => (
                <button key={option.id} type="button" aria-pressed={selected === option.id} onClick={() => setSelected(option.id)}>
                  {option.label}
                </button>
              ))}
              <button type="button" aria-pressed={selected === OWN} onClick={() => setSelected(OWN)}>
                Write your own
              </button>
            </div>
          </div>
          {preset ? (
            <>
              <p className="state">{preset.state}</p>
              <p className="notice">
                <strong>What to notice.</strong> {preset.notice}
              </p>
            </>
          ) : (
            <>
              <textarea
                className="state"
                aria-label="Your message"
                placeholder="Write a message a customer might send…"
                rows={4}
                maxLength={MAX_OWN_LENGTH}
                value={ownText}
                onChange={(event) => setOwnText(event.target.value)}
              />
              <div className="run-row">
                <button type="button" className="primary" onClick={run} disabled={asking || state === ''}>
                  {asking ? 'Asking…' : 'Ask Jev'}
                </button>
                <p className="muted">Your message is sent to Jev, and the answer comes back live.</p>
              </div>
            </>
          )}
        </div>

        <div className="question-grid">
          {Object.entries(QUESTIONS).map(([id, question]) => (
            <QuestionCard key={id} id={id} question={question} answer={response?.answers[id]} technical={technical} />
          ))}
        </div>

        <div className="run-row" role="status">
          {liveHere?.kind === 'failed' ? (
            <p className="error">{failureMessage(liveHere.error)}</p>
          ) : asking ? (
            <p className="muted">Asking Jev…</p>
          ) : response ? (
            <p className="muted stats">
              All three questions went in one request: {response.usage.input_tokens.toLocaleString('en-US')} tokens ·{' '}
              {formatCost(response.usage.input_tokens)} · {response.meta.upstream_ms} ms.{' '}
              {liveResponse ? 'Answered just now' : `Recorded ${RECORDED_ON}`} by {response.model}.
            </p>
          ) : (
            <p className="muted">All three questions go in one request.</p>
          )}
          {preset && (
            <button type="button" className="quiet" onClick={run} disabled={asking}>
              Ask Jev again
            </button>
          )}
        </div>

        {technical && (
          <div className="json-pair">
            <JsonView
              label="Request · POST api.typesafe.ai/v1/systemone"
              value={{ model: response?.model ?? RECORDED.model, state, questions: QUESTIONS }}
              linkFor={under('questions', linkForQuestions)}
            />
            {response && (
              <JsonView
                label="Response"
                value={{ model: response.model, answers: response.answers, usage: response.usage }}
                linkFor={under('answers', linkForAnswers)}
              />
            )}
          </div>
        )}
      </section>
    </HighlightProvider>
  )
}

/** Applies a link function to everything under one top-level field. */
function under(field: string, linkFor: LinkFor): LinkFor {
  return (path, value) => (path[0] === field ? linkFor(path.slice(1), value) : undefined)
}

// A typical request here costs a few thousandths of a cent, so show enough digits to see it.
function formatCost(inputTokens: number): string {
  return `$${costUsd(inputTokens).toFixed(6)}`
}

function failureMessage(error: ApiError): string {
  if (error.code === 'not_configured') return 'The server doesn’t have a Jev key yet, so live answers are off.'
  if (error.retryAfterSeconds) return `${error.message} Try again in ${error.retryAfterSeconds}s.`
  return error.message
}
