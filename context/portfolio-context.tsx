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
  // Default to 'All', but we will try to override this in useEffect
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

      const items: Portfolio[] = data.map(p => ({ id: p.id, name: p.name }))
      setPortfolios(items)
      
      // --- PERSISTENCE LOGIC ---
      // Check if we have a saved preference
      const savedId = localStorage.getItem('selectedPortfolioId')
      if (savedId) {
          if (savedId === 'all') {
              setSelectedPortfolio({ id: 'all', name: 'All Portfolios' })
          } else {
              const found = items.find(p => p.id === Number(savedId))
              if (found) setSelectedPortfolio(found)
          }
      }
    } catch (err) {
      console.error('Error fetching portfolios:', err)
    } finally {
      setLoading(false)
    }
  }

  // Initial Load
  useEffect(() => {
    fetchPortfolios()
  }, [])

  // Wrapper to save selection
  const handleSelectPortfolio = (p: Portfolio) => {
      setSelectedPortfolio(p)
      localStorage.setItem('selectedPortfolioId', String(p.id))
  }

  return (
    <PortfolioContext.Provider value={{ 
      portfolios, 
      selectedPortfolio, 
      selectPortfolio: handleSelectPortfolio, // Use wrapper
      refreshPortfolios: fetchPortfolios,
      loading 
    }}>
      {children}
    </PortfolioContext.Provider>
  )
}

export function usePortfolio() {
  const context = useContext(PortfolioContext)
  if (context === undefined) {
    throw new Error('usePortfolio must be used within a PortfolioProvider')
  }
  return context
}