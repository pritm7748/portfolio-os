// context/portfolio-context.tsx
'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

type Portfolio = {
  id: number | 'all'
  name: string
}

type PortfolioContextType = {
  portfolios: Portfolio[]
  selectedPortfolio: Portfolio
  selectPortfolio: (portfolio: Portfolio) => void
  refreshPortfolios: () => void
  loading: boolean
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined)

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio>({ id: 'all', name: 'All Portfolios' })
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchPortfolios = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('portfolios')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) throw error

      // Transform data to match our Type
      const items: Portfolio[] = data.map(p => ({ id: p.id, name: p.name }))
      setPortfolios(items)
      
      // Default to "Main Portfolio" if available, else "All"
      if (items.length > 0 && selectedPortfolio.id === 'all') {
         // Optional: Default to the first portfolio instead of 'All'
         // setSelectedPortfolio(items[0]) 
      }
    } catch (err) {
      console.error('Error fetching portfolios:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPortfolios()
  }, [])

  return (
    <PortfolioContext.Provider value={{ 
      portfolios, 
      selectedPortfolio, 
      selectPortfolio: setSelectedPortfolio,
      refreshPortfolios: fetchPortfolios,
      loading 
    }}>
      {children}
    </PortfolioContext.Provider>
  )
}

// This export is crucial!
export function usePortfolio() {
  const context = useContext(PortfolioContext)
  if (context === undefined) {
    throw new Error('usePortfolio must be used within a PortfolioProvider')
  }
  return context
}