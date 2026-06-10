import { createContext, useContext, type ReactNode } from 'react'
import { useUserSettings, type UserSettings } from './useUserSettings'

const SettingsContext = createContext<UserSettings | null>(null)

// Provides the signed-in user's preferences to the tree, so deep components
// (e.g. the voice capture modal) can read/write settings without prop drilling.
export function SettingsProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const settings = useUserSettings(userId)
  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>
}

export function useSettings(): UserSettings {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider')
  return ctx
}
