// A puzzle gives the learner some inputs with known right answers. They solve it by
// writing questions for Jev (the request) and rules that turn Jev's answers into a
// result (the code around the request). Together those two parts are a Program.

export type QuestionType = 'noul' | 'choice' | 'score'

export type Option = { name: string; description: string }

/**
 * One question card. It carries the fields for every type, so switching a card's
 * type in the editor doesn't throw away what was typed.
 */
export type CardQuestion = {
  /** Stable identity for rules and React; `name` is editable. */
  uid: string
  /** The question's key in the request, and how rules and code refer to it. */
  name: string
  type: QuestionType
  instructions: string
  /** Choice only. */
  options: Option[]
  /** Score only; a level's score is its position. */
  levels: string[]
}

/**
 * What a rule tests. For a noul the number is the probability of yes, for a score
 * it is the score, and for a choice it is the probability of the option it picked.
 */
export type Condition =
  | { question: string; op: 'gte' | 'lt'; value: number }
  | { question: string; op: 'picks'; option: string }

/** A fixed outcome, or whatever a choice question picked. */
export type Result = { kind: 'outcome'; outcome: string } | { kind: 'pick'; question: string }

export type Rule = { uid: string; when: Condition; then: Result }

export type Program = {
  questions: CardQuestion[]
  /** Tried in order; the first whose condition holds decides. Puzzles with one result per input. */
  rules: Rule[]
  otherwise: Result
  /** Puzzles whose result is a set: include every noul answered at least this. */
  threshold: number
}

export type PuzzleCase = {
  id: string
  /** The context sent to Jev. */
  state: string
  /** The right result: an outcome id, or the items that belong in the set. */
  expected: string | string[]
}

export type Puzzle = {
  id: string
  title: string
  /** The situation and the task, in a sentence or two. */
  brief: string
  /** What one input is called, e.g. "message" or "order". */
  input: string
  result:
    | { kind: 'one'; outcomes: { id: string; label: string }[] }
    /** Any subset of `items`; a noul named after an item adds it when answered yes. */
    | { kind: 'set'; noun: string; items: string[] }
  cases: PuzzleCase[]
  /** Where the learner begins. It runs, and gets some cases wrong. */
  starter: Program
  /** A reference solution, checked against the real model by `npm run check-puzzles`. */
  solution: Program
  hint: string
  /** Shown once solved: what the puzzle was demonstrating. */
  lesson: string
}

export type Outcome = string | string[]
