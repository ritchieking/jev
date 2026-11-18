import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

// Links a JSON field to the part of a chart it produces: anything rendered with
// the same key lights up together when one of them is hovered.

type Highlight = { active: string | null; setActive: (key: string | null) => void }

const HighlightContext = createContext<Highlight>({ active: null, setActive: () => {} })

export function HighlightProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<string | null>(null)
  const value = useMemo(() => ({ active, setActive }), [active])
  return <HighlightContext.Provider value={value}>{children}</HighlightContext.Provider>
}

/** Spread the result onto an element. With no key the element is left alone. */
export function useLink(key: string | undefined) {
  const { active, setActive } = useContext(HighlightContext)
  if (!key) return {}
  return {
    'data-lit': active === key ? '' : undefined,
    onMouseEnter: () => setActive(key),
    onMouseLeave: () => setActive(null),
  }
}

export const optionKey = (questionId: string, option: string | number) => `${questionId}/opt/${option}`
export const valueKey = (questionId: string) => `${questionId}/value`
