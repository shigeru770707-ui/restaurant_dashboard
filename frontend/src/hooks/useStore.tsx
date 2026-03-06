import { createContext, useContext, useState, useMemo, type ReactNode } from 'react'

interface StoreContextType {
  /** Selected Instagram store index (-1 = all stores) */
  igStoreIndex: number
  setIgStoreIndex: (index: number) => void
  /** Selected GBP store index (-1 = all stores) */
  gbpStoreIndex: number
  setGbpStoreIndex: (index: number) => void
}

const StoreContext = createContext<StoreContextType | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [igStoreIndex, setIgStoreIndex] = useState(0)
  const [gbpStoreIndex, setGbpStoreIndex] = useState(0)

  const value = useMemo(
    () => ({ igStoreIndex, setIgStoreIndex, gbpStoreIndex, setGbpStoreIndex }),
    [igStoreIndex, gbpStoreIndex],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
