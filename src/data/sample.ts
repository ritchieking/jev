import type { ChoiceQuestion, NoulQuestion, ScoreQuestion } from '../../shared/types'

// The explainer's running example: one support inbox, three questions about each
// message. Jev's real answers for the preset messages are in recorded.json
// (regenerate with `npm run record` after changing anything here).

export const QUESTIONS = {
  refund: {
    type: 'noul',
    instructions: 'Does the customer ask for a refund?',
  } satisfies NoulQuestion,
  team: {
    type: 'choice',
    instructions: 'Which team should handle this message?',
    criteria: {
      billing: 'Charges, refunds and invoices',
      technical: 'Bugs, outages and errors',
      account: 'Logins, profiles and settings',
    },
  } satisfies ChoiceQuestion,
  urgency: {
    type: 'score',
    instructions: 'How urgent is this message?',
    criteria: ['Can wait', 'Needs attention this week', 'Needs attention today'],
  } satisfies ScoreQuestion,
}

export type QuestionId = keyof typeof QUESTIONS

/** `notice` says what Jev's recorded answers show; reread it after re-recording. */
export type Preset = { id: string; label: string; state: string; notice: string }

export const PRESETS: Preset[] = [
  {
    id: 'double-charge',
    label: 'Charged twice',
    state:
      'I was charged twice for my subscription this month, and this is the second time I’ve written about it. Please refund the extra charge.',
    notice:
      'Jev is sure about the refund and the team. On urgency it is split between two levels, so the score lands between them.',
  },
  {
    id: 'outage',
    label: 'Checkout is down',
    state:
      'Your checkout page has been throwing a 500 error since 9 this morning. We’re losing orders every minute. Is anyone looking at this?',
    notice:
      'Nothing here is a close call, and every question gets a near-certain answer.',
  },
  {
    id: 'profile',
    label: 'No rush',
    state:
      'Hi! Not urgent at all, but when you get a chance, could someone show me how to change the email address on my profile?',
    notice:
      'The customer says there’s no rush, and the score sits at the bottom of the scale.',
  },
  {
    id: 'mixed',
    label: 'Two problems',
    state:
      'I cancelled my plan last week, but the cancel button showed an error the first time I tried, and now I can’t tell whether I’ll be billed again. If I am, I want that money back.',
    notice:
      'The refund is conditional (“if I am”), so the yes is a little less certain. The message also mentions an error, and “technical” picks up some probability.',
  },
  {
    id: 'recruiter',
    label: 'Wrong inbox',
    state:
      'Hi, I’m a recruiter at a staffing firm that places customer support agents. Do you have ten minutes this week to talk about your hiring plans?',
    notice:
      'None of the three teams fits this message, but a choice has to pick from the options you gave it, and it picks one with high probability. Nothing in the answer says “none of these”.',
  },
]
