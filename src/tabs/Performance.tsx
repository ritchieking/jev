import { useState } from 'react'
import { costUsd, PRICE_PER_MTOK_USD } from '../../shared/types'
import type { Mode } from '../App'
import recorded from '../data/recorded.json'

// This tab sends nothing to Jev. The picture and the sums come from how a request is
// billed (input tokens only, the context counted once per request); the measured
// figures are TypeSafe's own, quoted and linked, plus the answers already recorded
// for the Explainer tab.

/** An assumption for the sums, not a property of Jev: questions vary with their wording. */
const TOKENS_PER_QUESTION = 80
const MAX_QUESTIONS = 20
const COOKBOOK = 'https://docs.typesafe.ai/cookbooks/parallel_questions'

const whole = (n: number) => Math.round(n).toLocaleString('en-US')
const dollars = (usd: number) => (usd >= 100 ? `$${whole(usd)}` : usd >= 0.01 ? `$${usd.toFixed(2)}` : `$${usd.toFixed(6)}`)

const recordedResponses = Object.values(recorded.responses)
const recordedMs = recordedResponses.map((response) => response.meta.upstream_ms)
const recordedTokens = recordedResponses.map((response) => response.usage.input_tokens)

export function Performance({ mode }: { mode: Mode }) {
  // The defaults mirror TypeSafe's published example: 13 questions about a long article.
  const [questions, setQuestions] = useState(13)
  const [context, setContext] = useState(12000)

  const together = context + questions * TOKENS_PER_QUESTION
  const apart = questions * (context + TOKENS_PER_QUESTION)
  const ratio = apart / together
  const each = Array.from({ length: questions }, (_, i) => i)

  return (
    <section className="stack perf">
      <p className="intro">
        Jev reads the context once per request, then answers every question in that request against it, side by side.
        So the cheapest and quickest way to ask many things about one piece of text is to ask them all at once.
      </p>

      <div className="panel">
        <h2>Same questions, two ways to send them</h2>
        <p className="muted small">
          Each column is one request. The tall block is the context, which is sent and read again with every request.
        </p>
        <div className="sends">
          <figure>
            <figcaption>
              <strong>One request</strong>
              <span className="muted">The context once, then {questions === 1 ? 'the question' : `all ${questions} questions`}</span>
            </figcaption>
            <div className="columns" role="img" aria-label={`One request: one context block and ${questions} question blocks.`}>
              <div className="column">
                <span className="block context" />
                {each.map((i) => (
                  <span key={i} className="block question" />
                ))}
              </div>
            </div>
          </figure>
          <figure>
            <figcaption>
              <strong>One request per question</strong>
              <span className="muted">
                The context {questions === 1 ? 'once' : `${questions} times`}, in {questions === 1 ? 'one round trip' : `${questions} round trips`}
              </span>
            </figcaption>
            <div
              className="columns"
              role="img"
              aria-label={`${questions} requests, each with its own copy of the context block and one question block.`}
            >
              {each.map((i) => (
                <div key={i} className="column">
                  <span className="block context" />
                  <span className="block question" />
                </div>
              ))}
            </div>
          </figure>
        </div>
        <Legend />

        <div className="sliders">
          <label>
            <span>
              Questions <strong>{questions}</strong>
            </span>
            <input type="range" min={1} max={MAX_QUESTIONS} value={questions} onChange={(event) => setQuestions(event.target.valueAsNumber)} />
          </label>
          <label>
            <span>
              Context <strong>{whole(context)} tokens</strong> <span className="muted">(roughly {whole(context * 0.75)} words)</span>
            </span>
            <input
              type="range"
              min={100}
              max={20000}
              step={100}
              value={context}
              onChange={(event) => setContext(event.target.valueAsNumber)}
            />
          </label>
        </div>
      </div>

      <div className="panel">
        <h2>What you pay for</h2>
        <p className="muted small">
          Jev bills the tokens you send and nothing for the answers. These bars are arithmetic on the sliders above, drawn to
          scale, with each question counted as {TOKENS_PER_QUESTION} tokens.
        </p>

        <p className="hero">
          <strong>{ratio >= 10 ? ratio.toFixed(0) : ratio.toFixed(1)}×</strong>
          <span>{questions === 1 ? 'the same either way, with one question' : 'fewer tokens in one request'}</span>
        </p>

        <div className="token-bars">
          <div className="token-row">
            <p>
              <span>One request</span>
              <span className="value">{whole(together)} tokens</span>
            </p>
            <div className="token-bar" style={{ width: `${Math.max(1.5, (together / apart) * 100)}%` }}>
              <span className="seg context" style={{ flexGrow: context }} title={`Context: ${whole(context)} tokens, sent once`} />
              <span
                className="seg question"
                style={{ flexGrow: questions * TOKENS_PER_QUESTION }}
                title={`Questions: ${whole(questions * TOKENS_PER_QUESTION)} tokens`}
              />
            </div>
          </div>
          <div className="token-row">
            <p>
              <span>One request per question</span>
              <span className="value">{whole(apart)} tokens</span>
            </p>
            <div className="token-bar">
              {each.map((i) => (
                <span key={i} className="pair" style={{ flexGrow: 1 }}>
                  <span className="seg context" style={{ flexGrow: context }} title={`Request ${i + 1}: the context again, ${whole(context)} tokens`} />
                  <span className="seg question" style={{ flexGrow: TOKENS_PER_QUESTION }} title={`Request ${i + 1}: one question, ${TOKENS_PER_QUESTION} tokens`} />
                </span>
              ))}
            </div>
          </div>
        </div>
        <Legend />

        <div className="table-wrap">
          <table className="figures">
            <thead>
              <tr>
                <th scope="col">For each document</th>
                <th scope="col">Requests</th>
                <th scope="col">Tokens</th>
                <th scope="col">Cost</th>
                <th scope="col">Cost for a million documents</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">One request</th>
                <td>1</td>
                <td>{whole(together)}</td>
                <td>{dollars(costUsd(together))}</td>
                <td>{dollars(costUsd(together) * 1e6)}</td>
              </tr>
              <tr>
                <th scope="row">One per question</th>
                <td>{questions}</td>
                <td>{whole(apart)}</td>
                <td>{dollars(costUsd(apart))}</td>
                <td>{dollars(costUsd(apart) * 1e6)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Costs use TypeSafe’s published price for Jev 1.14: ${PRICE_PER_MTOK_USD} per million input tokens, output free.
        </p>

        {mode === 'technical' && (
          <figure className="json">
            <figcaption>The two shapes, and the sum behind each bar</figcaption>
            <pre className="code">{`// One request: the context is counted once.
{ state: document, questions: { q1, q2, … q${questions} } }
// ${whole(context)} + ${questions} × ${TOKENS_PER_QUESTION} = ${whole(together)} tokens

// One request per question: the context is counted every time.
{ state: document, questions: { q1 } }   // and ${questions - 1} more like it
// ${questions} × (${whole(context)} + ${TOKENS_PER_QUESTION}) = ${whole(apart)} tokens`}</pre>
          </figure>
        )}
      </div>

      <div className="panel">
        <h2>What has been measured</h2>
        <div className="measured">
          <div>
            <h3>By TypeSafe</h3>
            <p>
              TypeSafe asked 13 questions about a Wikipedia article of about 54,000 characters, both ways. One request with all
              13 cost $0.000497 and took 0.24 seconds. Thirteen requests, one after another, cost $0.006090 and took 2.81
              seconds in total: 12.2 times the cost and 11.8 times the time. The answers matched.
            </p>
            <p className="muted small">
              Sending the separate requests at the same time would close most of the gap in time, but not in cost, since each
              one still carries the whole article. <a href={COOKBOOK}>TypeSafe’s write-up</a> has the method and the numbers.
            </p>
          </div>
          <div>
            <h3>On this site</h3>
            <p>
              The {recordedMs.length} recorded examples on the Explainer tab each ask three questions about a short message. They
              took between {Math.min(...recordedMs)} and {Math.max(...recordedMs)} milliseconds to come back from TypeSafe,
              timed at this site’s server, and used {Math.min(...recordedTokens)} to {Math.max(...recordedTokens)} tokens each.
            </p>
            <p className="muted small">That is {recordedMs.length} requests, so treat it as an example and not a benchmark.</p>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>What this changes about how you build</h2>
        <ul className="takeaways">
          <li>
            <strong>Extra questions are nearly free.</strong> Once the context is in the request, another question adds only
            its own few tokens. You can ask things you might not need and let your code ignore the answers that turn out not
            to matter.
          </li>
          <li>
            <strong>The context is the bill.</strong> Trimming what you send saves more than trimming what you ask. TypeSafe
            also notes that Jev is less accurate when the context is full of material the question doesn’t need.
          </li>
          <li>
            <strong>Answers aren’t written out.</strong> Each answer is a few numbers of a fixed shape, so there is no reply to
            wait for word by word and no output to pay for.
          </li>
        </ul>
      </div>
    </section>
  )
}

function Legend() {
  return (
    <p className="legend">
      <span>
        <span className="swatch context" /> The context
      </span>
      <span>
        <span className="swatch question" /> A question
      </span>
    </p>
  )
}
