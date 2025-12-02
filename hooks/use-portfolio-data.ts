import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { usePortfolio } from '@/context/portfolio-context'

// TYPE DEFINITIONS (Shared)
export type Transaction = {
    id: number
    date: string
    transaction_type: string
    price: number
    quantity: number
    total_value: number
    realised_pnl: number | null
    portfolio_id: number
    assets: {
        ticker: string
        name: string
        asset_type: string
    }
}

export function useTransactions() {
  const { selectedPortfolio } = usePortfolio()
  const supabase = createClient()

  return useQuery({
    // Key depends on selectedPortfolio.id -> Auto-refetches on switch!
    queryKey: ['transactions', selectedPortfolio.id],
    
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user')

      let query = supabase
        .from('transactions')
        .select(`*, assets ( ticker, name, asset_type )`)
        .order('date', { ascending: true })

      if (selectedPortfolio.id !== 'all') {
        query = query.eq('portfolio_id', selectedPortfolio.id)
      }

      const { data, error } = await query
      if (error) throw error
      return data as Transaction[]
    },
    staleTime: 5 * 60 * 1000, // 5 Minutes Cache for Transactions (They don't change often)
  })
}

export function useLivePrices(tickers: string[]) {
    // Sort tickers to ensure the key is stable (['A', 'B'] is same as ['B', 'A'])
    const sortedTickers = tickers.sort()

    return useQuery({
        queryKey: ['prices', sortedTickers.join(',')],
        
        queryFn: async () => {
            if (tickers.length === 0) return {}
            const res = await fetch('/api/prices', { 
                method: 'POST', 
                body: JSON.stringify({ tickers, detailed: true }) 
            })
            if (!res.ok) throw new Error('Price fetch failed')
            return res.json()
        },
        
        enabled: tickers.length > 0, // Don't run if list is empty
        refetchInterval: 60 * 1000, // Auto-refresh prices every 60 seconds
        staleTime: 30 * 1000 // Considered fresh for 30 seconds
    })
}

// Helper for Dividend Fetching
export function useDividends(tickers: string[]) {
    const sortedTickers = tickers.sort()
    return useQuery({
        queryKey: ['dividends', sortedTickers.join(',')],
        queryFn: async () => {
            if (tickers.length === 0) return {}
            const res = await fetch('/api/dividends', { 
                method: 'POST', 
                body: JSON.stringify({ tickers }) 
            })
            return res.json()
        },
        enabled: tickers.length > 0,
        staleTime: 24 * 60 * 60 * 1000 // Cache dividends for 24 hours (they rarely change)
    })
}