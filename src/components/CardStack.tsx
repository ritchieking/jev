import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'

export type StackCard = { id: string; label: string; content: ReactNode }

type Props = {
  cards: StackCard[]
  /** Index of the card on top. */
  current: number
  onChange: (index: number) => void
  /** What the cards are, for screen readers: "Pitches". */
  label: string
}

// Each card keeps its own slight tilt wherever it sits in the pile; the one on top lies straight.
const TILTS = [-3.6, 2.9, -1.9, 4.3, -4.8, 2.3]
const OFF_LEFT = 'translateX(-112%) rotate(-9deg)'
const SLIDE_MS = 220
const FADE_MS = 160

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * A pile of cards with one on top. Going forward, the top card slides off to the
 * left and turns up at the bottom of the pile; going back, the bottom card slides
 * in from the left onto the top.
 */
export function CardStack({ cards, current, onChange, label }: Props) {
  const elements = useRef(new Map<string, HTMLElement>())
  const busy = useRef(false)
  /** The second half of a move, run once React has re-ordered the pile. */
  const afterMove = useRef<(() => void) | null>(null)

  useLayoutEffect(() => {
    afterMove.current?.()
    afterMove.current = null
  }, [current])

  function go(target: number) {
    const count = cards.length
    target = ((target % count) + count) % count
    if (target === current || busy.current) return
    if (reducedMotion()) return onChange(target)

    const forward = target === (current + 1) % count || (target > current && target !== (current - 1 + count) % count)
    const moving = elements.current.get(cards[forward ? current : target]!.id)
    if (!moving) return onChange(target)
    busy.current = true
    const done = () => {
      moving.style.transition = ''
      busy.current = false
    }
    // The moving card is animated by hand, so it must not also ease between its old and new slots.
    moving.style.transition = 'none'

    if (forward) {
      const leave = moving.animate([{ transform: OFF_LEFT, opacity: 0, offset: 1 }], {
        duration: SLIDE_MS,
        easing: 'cubic-bezier(0.4, 0, 1, 1)',
        fill: 'forwards',
      })
      leave.onfinish = () => {
        afterMove.current = () => {
          leave.cancel()
          moving.animate([{ opacity: 0, offset: 0 }], { duration: FADE_MS, easing: 'ease-out' }).onfinish = done
        }
        onChange(target)
      }
    } else {
      afterMove.current = () => {
        moving.animate([{ transform: OFF_LEFT, opacity: 0, offset: 0 }], {
          duration: SLIDE_MS,
          easing: 'cubic-bezier(0, 0, 0.2, 1)',
        }).onfinish = done
      }
      onChange(target)
    }
  }

  return (
    <div className="card-stack">
      <div className="pile" role="group" aria-roledescription="carousel" aria-label={label}>
        {cards.map((card, index) => {
          const depth = (index - current + cards.length) % cards.length
          const onTop = depth === 0
          const style = {
            zIndex: cards.length - depth,
            '--tilt': `${onTop ? 0 : TILTS[index % TILTS.length]}deg`,
            '--drop': `${Math.min(depth, 3) * 5}px`,
          } as CSSProperties
          return (
            <article
              key={card.id}
              ref={(element) => {
                if (element) elements.current.set(card.id, element)
                else elements.current.delete(card.id)
              }}
              className={onTop ? 'pile-card on-top' : 'pile-card'}
              style={style}
              aria-roledescription="slide"
              aria-label={`${card.label}, ${index + 1} of ${cards.length}`}
              aria-hidden={!onTop}
              inert={!onTop}
            >
              {card.content}
            </article>
          )
        })}
      </div>
      <div className="pile-controls">
        <button type="button" className="round" aria-label="Previous card" onClick={() => go(current - 1)}>
          ←
        </button>
        <ol className="dots">
          {cards.map((card, index) => (
            <li key={card.id}>
              <button
                type="button"
                aria-label={`${card.label}, ${index + 1} of ${cards.length}`}
                aria-current={index === current ? 'true' : undefined}
                onClick={() => go(index)}
              />
            </li>
          ))}
        </ol>
        <button type="button" className="round" aria-label="Next card" onClick={() => go(current + 1)}>
          →
        </button>
      </div>
    </div>
  )
}
