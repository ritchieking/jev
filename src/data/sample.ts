import type { ChoiceQuestion, NoulQuestion, ScoreQuestion } from '../../shared/types'

// The running example on the basics page: pitches sent to a film festival, and the
// same three questions about each one. Jev's real answers for the preset pitches are
// in recorded.json (regenerate with `npm run record` after changing anything here).

export const QUESTIONS = {
  true_story: {
    type: 'noul',
    instructions: 'Is this film based on a true story?',
  } satisfies NoulQuestion,
  programme: {
    type: 'choice',
    instructions: 'Which programme should this film screen in?',
    criteria: {
      comedy: 'Films meant to make people laugh',
      horror: 'Films meant to frighten',
      romance: 'Love stories',
      documentary: 'Non-fiction films',
    },
  } satisfies ChoiceQuestion,
  scary: {
    type: 'score',
    instructions: 'How frightening is this film?',
    criteria: ['Not frightening at all', 'A little tense', 'Scary', 'Terrifying'],
  } satisfies ScoreQuestion,
}

export type QuestionId = keyof typeof QUESTIONS

/** `notice` says what Jev's recorded answers show; reread it after re-recording. */
export type Preset = { id: string; title: string; pitch: string; notice: string }

/** What is sent to Jev for a preset: the card's text, title first. */
export const stateOf = (preset: Preset) => `${preset.title}\n\n${preset.pitch}`

export const PRESETS: Preset[] = [
  {
    id: 'room-nine',
    title: 'Room Nine',
    pitch:
      'A night nurse starts to suspect that the patient in room nine died three days ago. Nobody else on the ward can see him.',
    notice:
      'The programme is not a close call. The score is: Jev puts most of the weight on “Scary” and the rest on “A little tense”, so the number lands between the two.',
  },
  {
    id: 'the-keeper',
    title: 'The Keeper',
    pitch:
      'Three years with the last lighthouse keeper in Newfoundland, filmed as the coast guard prepares to automate his light.',
    notice:
      'The pitch never says “true” or “documentary”, and Jev gets there anyway: it is certain about the programme, and fairly sure this really happened.',
  },
  {
    id: 'bingo',
    title: 'Bingo Night of the Damned',
    pitch:
      'Four retirees discover their bingo hall was built over a gate to hell. The demons that crawl out are bloodthirsty, and terrible at bingo.',
    notice:
      'A horror comedy fits two programmes, and the choice comes back nearly even. The option on top is the pick, but the numbers under it tell you how close it was.',
  },
  {
    id: 'thaw',
    title: 'Yours, Until the Thaw',
    pitch:
      'Two strangers at opposite ends of an Antarctic supply route fall in love by radio over one long winter. Inspired by the director’s grandparents.',
    notice:
      '“Inspired by the director’s grandparents” is not quite “based on a true story”, and the yes-or-no answer sits in the middle. What to do with an unsure answer is up to you.',
  },
  {
    id: 'idle',
    title: 'Idle',
    pitch:
      'A getaway driver takes one last job to pay for her daughter’s surgery. Then the crew leaves her outside the bank with the engine running.',
    notice:
      'A heist thriller has no programme here, but a choice has to pick from the options you gave it. The spread-out numbers are a hint; nothing in the answer says “none of these”.',
  },
]
