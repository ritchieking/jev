import { CODE_PUZZLES } from './codePuzzles'
import type { CardPuzzle, CardQuestion, Option, Program, Puzzle, Result } from './types'

// Every puzzle's starter and solution are checked against the real model by
// `npm run check-puzzles`: the starter has to get something wrong, and the solution
// has to get everything right. Run it after changing a puzzle or the pinned model.

const noul = (name: string, instructions: string): CardQuestion => ({
  uid: name,
  name,
  type: 'noul',
  instructions,
  options: [],
  levels: [],
})

const choice = (name: string, instructions: string, options: Record<string, string>): CardQuestion => ({
  uid: name,
  name,
  type: 'choice',
  instructions,
  options: Object.entries(options).map(([optionName, description]): Option => ({ name: optionName, description })),
  levels: [],
})

const outcome = (id: string): Result => ({ kind: 'outcome', outcome: id })
const pick = (question: string): Result => ({ kind: 'pick', question })

/** A program for a set puzzle: no rules, just the cutoff for yes. */
const collect = (questions: CardQuestion[], threshold = 0.5): Program => ({
  questions,
  rules: [],
  otherwise: outcome(''),
  threshold,
})

const needsReply: CardPuzzle = {
  kind: 'cards',
  id: 'needs-reply',
  title: 'Does this need a reply?',
  brief:
    'A support inbox fills up with mail nobody has to answer: thank-yous, auto-replies, newsletters. Sort each message so the team only sees the ones waiting on them.',
  input: 'message',
  result: {
    kind: 'one',
    outcomes: [
      { id: 'reply', label: 'Reply' },
      { id: 'no_reply', label: 'No reply' },
    ],
  },
  cases: [
    { id: 'export', state: 'How do I export my invoices as a PDF?', expected: 'reply' },
    { id: 'thanks', state: 'Thanks so much, that fixed it! Have a great weekend.', expected: 'no_reply' },
    {
      id: 'crash',
      state: 'This is the third time the app has crashed while I was saving. I’ve lost an hour of work.',
      expected: 'reply',
    },
    {
      id: 'ooo',
      state: 'I’m out of the office until Monday and will respond to your email when I’m back.',
      expected: 'no_reply',
    },
    {
      id: 'rhetorical',
      state: 'Who knew renewing could be this painless? It went through on the first try. Nothing needed from your end.',
      expected: 'no_reply',
    },
    { id: 'cancel', state: 'Please cancel my account, effective today.', expected: 'reply' },
    {
      id: 'newsletter',
      state: 'You’re receiving this because you subscribed to Home Office Weekly. This week: five ways to tidy your desk.',
      expected: 'no_reply',
    },
  ],
  starter: {
    questions: [noul('has_question', 'Does this message contain a question?')],
    rules: [{ uid: 'r1', when: { question: 'has_question', op: 'gte', value: 0.5 }, then: outcome('reply') }],
    otherwise: outcome('no_reply'),
    threshold: 0.5,
  },
  solution: {
    questions: [noul('needs_reply', 'Does this message need a reply from the support team?')],
    rules: [{ uid: 'r1', when: { question: 'needs_reply', op: 'gte', value: 0.5 }, then: outcome('reply') }],
    otherwise: outcome('no_reply'),
    threshold: 0.5,
  },
  hint: 'Look at which messages go wrong. Is “contains a question” really the thing you want to know about them?',
  lesson:
    'Jev answers the question you wrote, not the one you meant. A complaint with no question mark still needs a reply, and a rhetorical question doesn’t. Asking directly for what you want to know works better than asking about a stand-in for it.',
}

const houseRules: CardPuzzle = {
  kind: 'cards',
  id: 'house-rules',
  title: 'House rules',
  brief:
    'A neighbourhood plant-swap group has two rules: every post has to be about plants, and plants can be swapped or given away but never sold. Decide which posts a moderator should remove.',
  input: 'post',
  result: {
    kind: 'one',
    outcomes: [
      { id: 'remove', label: 'Remove' },
      { id: 'keep', label: 'Keep' },
    ],
  },
  cases: [
    { id: 'free', state: 'Free spider plant babies, pick up from my porch on Elm Street.', expected: 'keep' },
    { id: 'selling', state: 'Selling three monstera cuttings, $5 each.', expected: 'remove' },
    { id: 'trade', state: 'Anyone want to trade a pothos for a snake plant?', expected: 'keep' },
    { id: 'cat', state: 'Lost tabby cat near Elm Street. Please share!', expected: 'remove' },
    { id: 'advice', state: 'My fiddle leaf fig keeps dropping leaves. Any advice?', expected: 'keep' },
    { id: 'shop', state: 'Grand opening of my plant shop this Saturday, 20% off everything.', expected: 'remove' },
    { id: 'plumber', state: 'Does anyone know a good plumber?', expected: 'remove' },
  ],
  starter: {
    questions: [noul('breaks_rules', 'Does this post break the group’s rules?')],
    rules: [{ uid: 'r1', when: { question: 'breaks_rules', op: 'gte', value: 0.5 }, then: outcome('remove') }],
    otherwise: outcome('keep'),
    threshold: 0.5,
  },
  solution: {
    questions: [
      noul(
        'breaks_rules',
        'The group has two rules: every post must be about plants, and plants may be swapped or given away but never sold. Does this post break a rule?',
      ),
    ],
    rules: [{ uid: 'r1', when: { question: 'breaks_rules', op: 'gte', value: 0.5 }, then: outcome('remove') }],
    otherwise: outcome('keep'),
    threshold: 0.5,
  },
  hint: 'You know the group’s rules because you just read them. Has Jev read them?',
  lesson:
    'Jev knows only what is in the request. It had never seen this group’s rules, so it judged each post against rules in general, and nothing looked wrong with selling a plant. Anything an answer depends on has to be written into the question or the context.',
}

const sureEnough: CardPuzzle = {
  kind: 'cards',
  id: 'sure-enough',
  title: 'Sure enough to act',
  brief:
    'A subscription service cancels automatically when a customer clearly asks for it. When a customer only sounds like they might leave, a person should follow up instead. Everything else needs nothing.',
  input: 'message',
  result: {
    kind: 'one',
    outcomes: [
      { id: 'cancel', label: 'Cancel it' },
      { id: 'follow_up', label: 'A person follows up' },
      { id: 'nothing', label: 'Do nothing' },
    ],
  },
  cases: [
    { id: 'today', state: 'Please cancel my subscription today.', expected: 'cancel' },
    { id: 'card', state: 'Can you update the card on my account?', expected: 'nothing' },
    { id: 'worth-it', state: 'I’m not sure this is worth it for me anymore.', expected: 'follow_up' },
    { id: 'stop-billing', state: 'I want to cancel. Stop billing me.', expected: 'cancel' },
    { id: 'files', state: 'What happens to my files if I cancel?', expected: 'follow_up' },
    { id: 'dashboard', state: 'Loving the new dashboard, thanks!', expected: 'nothing' },
    { id: 'cheaper', state: 'Is there a cheaper plan? Otherwise I’ll have to leave.', expected: 'follow_up' },
    { id: 'undecided', state: 'I might cancel, I haven’t decided.', expected: 'follow_up' },
  ],
  starter: {
    questions: [noul('wants_to_cancel', 'Is this customer asking us to cancel their subscription?')],
    rules: [{ uid: 'r1', when: { question: 'wants_to_cancel', op: 'gte', value: 0.5 }, then: outcome('cancel') }],
    otherwise: outcome('nothing'),
    threshold: 0.5,
  },
  solution: {
    questions: [noul('wants_to_cancel', 'Is this customer asking us to cancel their subscription?')],
    rules: [
      { uid: 'r1', when: { question: 'wants_to_cancel', op: 'gte', value: 0.9 }, then: outcome('cancel') },
      { uid: 'r2', when: { question: 'wants_to_cancel', op: 'lt', value: 0.1 }, then: outcome('nothing') },
    ],
    otherwise: outcome('follow_up'),
    threshold: 0.5,
  },
  hint: 'The question is fine as it is. Run it, look at the numbers Jev gives the in-between messages, and decide in the rules what each range should do.',
  lesson:
    'A yes-or-no answer from Jev is a probability, and where to draw the line is your decision. An action that is hard to undo can wait for a high number, and the uncertain middle can get an outcome of its own. All of that is code, so tuning it never costs another request.',
}

const noneOfThese: CardPuzzle = {
  kind: 'cards',
  id: 'none-of-these',
  title: 'None of these',
  brief:
    'A furniture shop sells three products, each with its own team. Send every message to the right team, and send messages that aren’t about any of the three to nobody.',
  input: 'message',
  result: {
    kind: 'one',
    outcomes: [
      { id: 'desk', label: 'Desk team' },
      { id: 'chair', label: 'Chair team' },
      { id: 'monitor_arm', label: 'Monitor arm team' },
      { id: 'none', label: 'Nobody' },
    ],
  },
  cases: [
    { id: 'motor', state: 'The motor on my standing desk makes a grinding noise whenever it goes up.', expected: 'desk' },
    { id: 'armrest', state: 'One of the armrests on my chair won’t lock in place anymore.', expected: 'chair' },
    {
      id: 'sag',
      state: 'The arm sags under my 34-inch screen even with the tension turned all the way up.',
      expected: 'monitor_arm',
    },
    { id: 'lamp', state: 'Do you sell a desk lamp that matches the oak finish?', expected: 'none' },
    {
      id: 'podcast',
      state: 'I host a podcast about remote work and would love to have your founder on as a guest.',
      expected: 'none',
    },
    { id: 'gas-lift', state: 'The seat sinks slowly over the course of the day. Is the gas lift under warranty?', expected: 'chair' },
  ],
  starter: {
    questions: [
      choice('product', 'Which product is this message about?', {
        desk: 'The standing desk',
        chair: 'The office chair',
        monitor_arm: 'The monitor arm',
      }),
    ],
    rules: [],
    otherwise: pick('product'),
    threshold: 0.5,
  },
  solution: {
    questions: [
      choice('product', 'Which product is this message about?', {
        desk: 'The standing desk',
        chair: 'The office chair',
        monitor_arm: 'The monitor arm',
      }),
      noul(
        'about_a_product',
        'Is this message about one of the three products we sell: the standing desk, the office chair or the monitor arm?',
      ),
    ],
    rules: [{ uid: 'r1', when: { question: 'about_a_product', op: 'lt', value: 0.5 }, then: outcome('none') }],
    otherwise: pick('product'),
    threshold: 0.5,
  },
  hint: 'A choice always picks one of its options. What second question, in the same request, would tell you whether to trust the pick?',
  lesson:
    'A choice has to pick from the options you give it, so on its own it can’t say “none of these.” A yes-or-no question alongside it can, and since both go in one request, the check costs only the tokens of the extra question.',
}

const TOPPINGS = ['mushrooms', 'pepperoni', 'olives', 'onions']

const toppings: CardPuzzle = {
  kind: 'cards',
  id: 'toppings',
  title: 'Pick several',
  brief:
    'A pizza place takes orders by text and offers four toppings: mushrooms, pepperoni, olives and onions. Work out which ones each customer wants.',
  input: 'order',
  result: { kind: 'set', noun: 'toppings', items: TOPPINGS },
  cases: [
    { id: 'two', state: 'One large with pepperoni and mushrooms, please.', expected: ['pepperoni', 'mushrooms'] },
    { id: 'one', state: 'Medium pizza, just olives.', expected: ['olives'] },
    { id: 'all', state: 'Large thin crust with mushrooms, onions, olives and pepperoni.', expected: TOPPINGS },
    { id: 'plain', state: 'Plain cheese, nothing on it.', expected: [] },
    {
      id: 'changed-mind',
      state: 'Pepperoni, onions and olives. Actually, skip the onions.',
      expected: ['pepperoni', 'olives'],
    },
    { id: 'hold', state: 'Small pizza with onions and mushrooms, hold the pepperoni.', expected: ['onions', 'mushrooms'] },
  ],
  starter: collect([
    choice('topping', 'Which topping does the customer want?', {
      mushrooms: '',
      pepperoni: '',
      olives: '',
      onions: '',
    }),
  ]),
  solution: collect(TOPPINGS.map((topping) => noul(topping, `Does the customer want ${topping} on their pizza?`))),
  hint: 'A choice returns exactly one option. Which kind of question can be true for several toppings at once?',
  lesson:
    'A choice returns exactly one option, which is wrong whenever several can be true or none are. One yes-or-no question per option handles both, and all of them travel in a single request.',
}

export const PUZZLES: Puzzle[] = [needsReply, houseRules, noneOfThese, toppings, sureEnough, ...CODE_PUZZLES]
