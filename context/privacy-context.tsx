'use client'

import { createContext, useContext, useState } from 'react'

type PrivacyContextType = {
  isPrivacyMode: boolean
  togglePrivacy: () => void
}

const PrivacyContext = createContext<PrivacyContextType>({
  isPrivacyMode: false,
  togglePrivacy: () => {}
})

export const PrivacyProvider = ({ children }: { children: React.ReactNode }) => {
  const [isPrivacyMode, setIsPrivacyMode] = useState(false)

  return (
    <PrivacyContext.Provider value={{ isPrivacyMode, togglePrivacy: () => setIsPrivacyMode(!isPrivacyMode) }}>
      {children}
    </PrivacyContext.Provider>
  )
}

export const usePrivacy = () => useContext(PrivacyContext)