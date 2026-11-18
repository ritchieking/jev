import type { AskRequest, AskResponse } from '../../shared/types'
import { ask } from '../lib/api'

// Jev's answers this session, by exact request. Going back to an earlier wording,
// changing only the rules, or re-running code that asks the same things shows
// results again without sending anything.
const answered = new Map<string, AskResponse>()
const inFlight = new Map<string, Promise<AskResponse>>()

const keyOf = (request: AskRequest) => JSON.stringify([request.state, request.questions])

/** The answer to this exact request, if it has been asked this session. */
export function recall(request: AskRequest): AskResponse | undefined {
  return answered.get(keyOf(request))
}

/** Asks Jev, unless this exact request has been answered or is already on its way. */
export function askOnce(request: AskRequest): Promise<AskResponse> {
  const key = keyOf(request)
  const known = answered.get(key)
  if (known) return Promise.resolve(known)
  const pending = inFlight.get(key)
  if (pending) return pending
  const sent = ask({ state: request.state, questions: request.questions })
    .then((response) => {
      answered.set(key, response)
      return response
    })
    .finally(() => inFlight.delete(key))
  inFlight.set(key, sent)
  return sent
}
