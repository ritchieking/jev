import { compile, message } from './solve'
import type { FromWorker, ToWorker } from './sandbox'

// Runs the learner's code, in their own browser, off the page's main thread: it has
// no access to the page, and the page can stop it if it never finishes. The only way
// it reaches Jev is by asking the page, which applies the same limits as card mode.

const worker = self as unknown as {
  postMessage(message: FromWorker): void
  onmessage: ((event: MessageEvent<ToWorker>) => void) | null
}

const waiting = new Map<number, { resolve: (value: unknown) => void; reject: (reason: Error) => void }>()
let calls = 0

function format(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

worker.onmessage = (event) => {
  const incoming = event.data
  if (incoming.type === 'answer') {
    const call = waiting.get(incoming.callId)
    waiting.delete(incoming.callId)
    if (!call) return
    if (incoming.ok) call.resolve(incoming.response)
    else call.reject(new Error(incoming.error))
    return
  }

  console.log = (...args: unknown[]) => worker.postMessage({ type: 'log', text: args.map(format).join(' ') })

  let solve: ReturnType<typeof compile>
  try {
    solve = compile(incoming.code)
  } catch (err) {
    worker.postMessage({ type: 'fatal', error: message(err) })
    return
  }

  const runs = incoming.cases.map(async ({ id, input }) => {
    const jev = (request: unknown) =>
      new Promise<unknown>((resolve, reject) => {
        const callId = ++calls
        waiting.set(callId, { resolve, reject })
        try {
          worker.postMessage({ type: 'ask', caseId: id, callId, request })
        } catch {
          // postMessage refuses values that can't be copied, such as functions.
          waiting.delete(callId)
          reject(new Error('A request has to be plain data: text, numbers, lists and objects.'))
        }
      })
    try {
      const value = await solve(input, jev)
      // Through JSON so that whatever was returned can be handed to the page.
      worker.postMessage({ type: 'result', caseId: id, ok: true, value: value === undefined ? undefined : JSON.parse(JSON.stringify(value)) })
    } catch (err) {
      worker.postMessage({ type: 'result', caseId: id, ok: false, error: message(err) })
    }
  })
  void Promise.all(runs).then(() => worker.postMessage({ type: 'finished' }))
}
