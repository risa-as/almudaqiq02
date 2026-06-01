'use client'
import { createContext, useContext, useState, useCallback } from 'react'

interface TourContextValue {
  triggerCount: number
  requestTour: () => void
}

const TourContext = createContext<TourContextValue>({ triggerCount: 0, requestTour: () => {} })

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [triggerCount, setTriggerCount] = useState(0)
  const requestTour = useCallback(() => setTriggerCount(n => n + 1), [])
  return <TourContext.Provider value={{ triggerCount, requestTour }}>{children}</TourContext.Provider>
}

export function useTourContext() {
  return useContext(TourContext)
}
