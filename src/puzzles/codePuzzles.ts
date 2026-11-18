import type { CodePuzzle } from './types'

// Puzzles solved in code. Each `starter` and `solution` is the whole program the
// learner sees: it has to define `async function solve(input, jev)`. They are checked
// against the real model by `npm run check-puzzles`, like the card puzzles.
//
// The code is written the way it should read in the editor, so keep lines short.

const headcount: CodePuzzle = {
  kind: 'code',
  id: 'headcount',
  title: 'Headcount',
  brief:
    'The replies to a picnic invitation are in, one line per person. Work out how many people are coming, so you know how much food to buy.',
  input: 'replies',
  returns: 'the number of people coming',
  cases: [
    {
      id: 'five',
      state: ['Ana: Wouldn’t miss it!', 'Ben: Sorry, I’m away that weekend.', 'Chidi: Count me in.', 'Dee: Can’t make it this time.', 'Eli: I’ll be there.'].join('\n'),
      expected: 3,
    },
    {
      id: 'nobody',
      state: ['Tess: No, sorry.', 'Uma: I can’t.', 'Vik: Out of town.', 'Wren: Not me.'].join('\n'),
      expected: 0,
    },
    {
      id: 'second-thoughts',
      state: [
        'Xavi: I’d love to, but no.',
        'Yara: Put me down as a yes.',
        'Zed: Nope.',
        'Abe: Yes, if it doesn’t rain. Actually, yes either way.',
        'Bea: I was going to say no, but I’ve moved things around. I’m coming.',
        'Cal: No way I’m missing this.',
        'Dot: I’ll pass.',
        'Ed: Save me a seat.',
        'Flo: Have fun without me.',
        'Gil: In.',
      ].join('\n'),
      expected: 6,
    },
    {
      id: 'fourteen',
      state: [
        'Ana: No, sorry.',
        'Ben: Yes!',
        'Chidi: Count me in.',
        'Dee: Can’t make it.',
        'Eli: I’ll be there.',
        'Farah: See you there.',
        'Gus: I’m in.',
        'Hana: Count me out.',
        'Ivan: I’ll pass.',
        'Jo: Wouldn’t miss it.',
        'Kemal: Not this time.',
        'Lena: Definitely.',
        'Moe: Save me a seat.',
        'Nia: I’m away that weekend.',
      ].join('\n'),
      expected: 8,
    },
    {
      id: 'sixteen',
      state: [
        'Ana: Yes!',
        'Ben: Count me in.',
        'Chidi: No, sorry.',
        'Dee: I’ll be there.',
        'Eli: Can’t make it.',
        'Farah: Count me out.',
        'Gus: See you there.',
        'Hana: I’m in.',
        'Ivan: Wouldn’t miss it.',
        'Jo: I’ll pass.',
        'Kemal: Definitely.',
        'Lena: Not this time.',
        'Moe: Save me a seat.',
        'Nia: Yes!',
        'Omar: I’m away that weekend.',
        'Pia: Count me in.',
      ].join('\n'),
      expected: 10,
    },
  ],
  starter: `// jev({ state, questions }) sends one request and gives back
// Jev's response. Everything else is ordinary JavaScript.

async function solve(replies, jev) {
  // A choice takes its options as an object: { name: null, ... }
  const numbers = {}
  for (let n = 0; n <= 18; n++) numbers[n] = null

  const { answers } = await jev({
    state: replies,
    questions: {
      coming: {
        type: 'choice',
        instructions:
          'These are replies to a picnic invitation. ' +
          'How many people are coming?',
        criteria: numbers,
      },
    },
  })
  return Number(answers.coming.choice)
}`,
  solution: `// jev({ state, questions }) sends one request and gives back
// Jev's response. Everything else is ordinary JavaScript.

async function solve(replies, jev) {
  // One yes-or-no question per person, built from the replies themselves.
  const questions = {}
  for (const line of replies.split('\\n')) {
    const name = line.split(':')[0]
    questions[name.toLowerCase()] = {
      type: 'noul',
      instructions:
        'These are replies to a picnic invitation. ' +
        \`Is \${name} coming?\`,
    }
  }
  const { answers } = await jev({ state: replies, questions })

  // Jev judges each reply. The counting happens here.
  return Object.values(answers)
    .filter((answer) => answer.noul >= 0.5).length
}`,
  hint: 'Jev is good at telling whether one reply is a yes. Could your code ask about each person separately, in the same request, and do the adding up itself?',
  lesson:
    'Jev recognises what an answer should look like, but it doesn’t tally, and it drifts further off as the list grows. Judging one reply is something it does well, so ask one question per person and count the answers in code. The questions were built by a loop, which cards can’t do.',
}

const returnWindow: CodePuzzle = {
  kind: 'code',
  id: 'return-window',
  title: 'Return window',
  brief:
    'A shop accepts returns within 45 days of purchase. Today is 15 June 2026. For each message, decide whether to accept the return.',
  input: 'message',
  returns: '"accept" or "refuse"',
  cases: [
    { id: 'apr-30', state: 'I bought this kettle on 30 April 2026 and I’d like to return it.', expected: 'refuse' },
    { id: 'may-1', state: 'Order placed May 1, 2026. Can I send it back?', expected: 'accept' },
    { id: 'apr-28', state: 'I ordered these boots on 28 April 2026. They’re too small.', expected: 'refuse' },
    { id: 'may-10', state: 'My receipt says 10 May 2026. Is a return still possible?', expected: 'accept' },
    { id: 'apr-20', state: 'Bought 20 April 2026, changed my mind.', expected: 'refuse' },
    { id: 'apr-25', state: 'Purchase date: 2026-04-25. I want a refund.', expected: 'refuse' },
    { id: 'jun-5', state: 'Bought it on 5 June 2026. Never used it.', expected: 'accept' },
  ],
  starter: `// 15 June 2026. JavaScript counts months from 0.
const TODAY = new Date(2026, 5, 15)
const MONTHS = ['January', 'February', 'March', 'April', 'May',
  'June', 'July', 'August', 'September', 'October', 'November',
  'December']

// Turns a list of names into a choice's options: { name: null, ... }
const asOptions = (names) =>
  Object.fromEntries(names.map((name) => [name, null]))

async function solve(message, jev) {
  const { answers } = await jev({
    state: message,
    questions: {
      in_window: {
        type: 'noul',
        instructions:
          'Today is 15 June 2026. ' +
          'We accept returns within 45 days of purchase. ' +
          'Is this purchase still within the return window?',
      },
    },
  })
  return answers.in_window.noul >= 0.5 ? 'accept' : 'refuse'
}`,
  solution: `// 15 June 2026. JavaScript counts months from 0.
const TODAY = new Date(2026, 5, 15)
const MONTHS = ['January', 'February', 'March', 'April', 'May',
  'June', 'July', 'August', 'September', 'October', 'November',
  'December']
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1))

// Turns a list of names into a choice's options: { name: null, ... }
const asOptions = (names) =>
  Object.fromEntries(names.map((name) => [name, null]))

async function solve(message, jev) {
  // Jev reads the date off the message, one part at a time.
  const { answers } = await jev({
    state: message,
    questions: {
      month: {
        type: 'choice',
        instructions: 'In which month was the item bought?',
        criteria: asOptions(MONTHS),
      },
      day: {
        type: 'choice',
        instructions: 'On which day of the month was the item bought?',
        criteria: asOptions(DAYS),
      },
      year: {
        type: 'choice',
        instructions: 'In which year was the item bought?',
        criteria: asOptions(['2025', '2026']),
      },
    },
  })

  // The arithmetic happens here.
  const bought = new Date(
    Number(answers.year.choice),
    MONTHS.indexOf(answers.month.choice),
    Number(answers.day.choice),
  )
  const days = Math.round((TODAY - bought) / 86_400_000)
  return days <= 45 ? 'accept' : 'refuse'
}`,
  hint: 'Jev can’t subtract dates, but it can read one. A month is one of twelve options, a day is one of thirty-one, and JavaScript can do the rest.',
  lesson:
    'Jev reads dates as text, not as points on a calendar, so near the cut-off it guesses. Reading a date’s month, day and year off the page is a judgment it makes reliably, and each is a choice from a short list. Once the parts are in code, the subtraction is exact.',
}

const takeTheOrder: CodePuzzle = {
  kind: 'code',
  id: 'take-the-order',
  title: 'Take the order',
  brief:
    'A pizza place takes orders by text. Pizzas and sodas come in sizes, and salads come with a dressing. Turn each order into the list the kitchen needs, such as "pizza: large" and "garlic_bread".',
  input: 'order',
  returns: 'a list such as ["pizza: large", "garlic_bread"]',
  cases: [
    { id: 'pizza-soda', state: 'A large pizza and a small soda, please.', expected: ['pizza: large', 'soda: small'] },
    { id: 'bread', state: 'Just garlic bread.', expected: ['garlic_bread'] },
    {
      id: 'three',
      state: 'Medium pizza, a salad with ranch, and garlic bread.',
      expected: ['pizza: medium', 'salad: ranch', 'garlic_bread'],
    },
    { id: 'swapped', state: 'Can I get a small pizza and a large soda?', expected: ['pizza: small', 'soda: large'] },
    {
      id: 'side',
      state: 'Two things: a large soda, and a salad with ranch on the side.',
      expected: ['soda: large', 'salad: ranch'],
    },
    {
      id: 'everything',
      state: 'One small pizza, one large soda, garlic bread, and a salad with the vinaigrette.',
      expected: ['pizza: small', 'soda: large', 'salad: vinaigrette', 'garlic_bread'],
    },
  ],
  starter: `const MENU = {
  pizza: {
    words: 'a pizza',
    field: 'size',
    options: ['small', 'medium', 'large'],
  },
  soda: { words: 'a soda', field: 'size', options: ['small', 'large'] },
  salad: {
    words: 'a salad',
    field: 'dressing',
    options: ['ranch', 'vinaigrette'],
  },
  garlic_bread: { words: 'garlic bread' },
}

async function solve(order, jev) {
  // First request: which things on the menu are in this order?
  const questions = {}
  for (const [item, entry] of Object.entries(MENU)) {
    questions[item] = {
      type: 'noul',
      instructions: \`Does this order include \${entry.words}?\`,
    }
  }
  const found = await jev({ state: order, questions })
  const items = Object.keys(MENU).filter(
    (item) => found.answers[item].noul >= 0.5,
  )

  // To do: the kitchen needs "pizza: large", not just "pizza".
  return items
}`,
  solution: `const MENU = {
  pizza: {
    words: 'a pizza',
    field: 'size',
    options: ['small', 'medium', 'large'],
  },
  soda: { words: 'a soda', field: 'size', options: ['small', 'large'] },
  salad: {
    words: 'a salad',
    field: 'dressing',
    options: ['ranch', 'vinaigrette'],
  },
  garlic_bread: { words: 'garlic bread' },
}

async function solve(order, jev) {
  // First request: which things on the menu are in this order?
  const questions = {}
  for (const [item, entry] of Object.entries(MENU)) {
    questions[item] = {
      type: 'noul',
      instructions: \`Does this order include \${entry.words}?\`,
    }
  }
  const found = await jev({ state: order, questions })
  const items = Object.keys(MENU).filter(
    (item) => found.answers[item].noul >= 0.5,
  )

  // Second request, built from the first one's answers: a question for
  // each thing that was ordered and comes in more than one kind.
  const details = {}
  for (const item of items) {
    const { field, options } = MENU[item]
    if (!field) continue
    details[item] = {
      type: 'choice',
      instructions:
        \`Which \${field} did the customer ask for with the \${item}?\`,
      criteria: Object.fromEntries(
        options.map((option) => [option, null]),
      ),
    }
  }
  if (Object.keys(details).length === 0) return items
  const chosen = await jev({ state: order, questions: details })

  return items.map((item) => {
    const detail = chosen.answers[item]
    return detail ? \`\${item}: \${detail.choice}\` : item
  })
}`,
  hint: 'Once you know an order has a pizza in it, you know there is a size to ask about. A second call to jev can ask only the questions the first call’s answers made relevant.',
  lesson:
    'Some questions only make sense once another has been answered, so the code sends one request, reads the answers, and builds the next request from them. With a menu this small you could also ask every question up front and ignore the ones that turn out not to apply. Chaining matters more as the menu grows, when asking everything at once stops being practical.',
}

export const CODE_PUZZLES: CodePuzzle[] = [headcount, returnWindow, takeTheOrder]
