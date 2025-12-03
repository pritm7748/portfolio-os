import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { usePortfolio } from '@/context/portfolio-context'

// --- Type Definitions ---
export type Transaction = {
    id: number
    date: string
    transaction_type: string
    price: number
    quantity: number
    total_value: number
    realised_pnl: number | null
    portfolio_id: number
    asset_id: number // Added explicit type for join logic
    assets: {
        ticker: string
        name: string
        asset_type: string
    }
}

export type WatchlistItem = {
    id: number
    ticker: string
    name: string
    asset_type: string
    created_at: string
}

export type PriceAlert = {
    id: number
    ticker: string
    target_price: number
    condition: 'above' | 'below'
    is_active: boolean
    created_at: string
    triggered_at: string | null
}

// --- 1. Transactions Hook (Core Data) ---
export function useTransactions() {
  const { selectedPortfolio } = usePortfolio()
  const supabase = createClient()

  return useQuery({
    // Auto-refetch when portfolio ID changes
    queryKey: ['transactions', selectedPortfolio.id],
    
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

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
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })
}

// --- 2. Live Prices Hook (Auto-Refresh) ---
export function useLivePrices(tickers: string[]) {
    // Sort tickers to ensure the cache key is stable
    const sortedTickers = tickers.slice().sort()

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
        
        enabled: tickers.length > 0,
        refetchInterval: 60 * 1000, // Refresh every 60s automatically
        staleTime: 30 * 1000 
    })
}

// --- 3. Dividends Hook ---
export function useDividends(tickers: string[]) {
    const sortedTickers = tickers.slice().sort()
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
        staleTime: 24 * 60 * 60 * 1000 // Dividends rarely change, cache for 24h
    })
}

// --- 4. Watchlist Hook (New) ---
export function useWatchlist() {
    const supabase = createClient()
    
    return useQuery({
        queryKey: ['watchlist'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('No user')
            
            const { data, error } = await supabase
                .from('watchlist')
                .select('*')
                .order('created_at', { ascending: false })
            
            if (error) throw error
            return data as WatchlistItem[]
        },
        staleTime: 10 * 60 * 1000 // Cache for 10 mins
    })
}

// --- 5. Market History Hook (For Sparkline Charts) ---
export function useMarketHistory(tickers: string[], range: string = '1d') {
    const sortedTickers = tickers.slice().sort()
    
    return useQuery({
        queryKey: ['marketHistory', sortedTickers.join(','), range],
        queryFn: async () => {
            if (tickers.length === 0) return {}
            const res = await fetch('/api/history', { 
                method: 'POST', 
                body: JSON.stringify({ tickers, range, detailed: true }) 
            })
            if (!res.ok) throw new Error('History fetch failed')
            return res.json()
        },
        enabled: tickers.length > 0,
        refetchInterval: 5 * 60 * 1000, 
        staleTime: 2 * 60 * 1000
    })
}

// --- NEW: Alerts Hook ---
export function useAlerts() {
    const supabase = createClient()
    
    return useQuery({
        queryKey: ['alerts'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('No user')
            
            const { data, error } = await supabase
                .from('price_alerts')
                .select('*')
                .order('created_at', { ascending: false })
            
            if (error) throw error
            return data as PriceAlert[]
        },
        staleTime: 1 * 60 * 1000 // Cache for 1 minute
    })
}

export function useProfile() {
    const supabase = createClient()
    return useQuery({
        queryKey: ['profile'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('No user')
            
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single()
            
            if (error) throw error
            return { user, profile }
        },
        staleTime: Infinity, // User profile rarely changes, cache until reload
    })
}

// --- 8. News Preferences Hook ---
export function useNewsPreferences() {
    const supabase = createClient()
    return useQuery({
        queryKey: ['newsPreferences'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('No user')
            
            const { data } = await supabase
                .from('news_settings')
                .select('*')
                .eq('user_id', user.id)
            
            const map: Record<string, { is_muted: boolean, is_favorite: boolean }> = {}
            data?.forEach((row: any) => {
                map[row.ticker] = { is_muted: row.is_muted, is_favorite: row.is_favorite }
            })
            return map
        },
        staleTime: Infinity 
    })
}

// --- 9. News Fetcher Hook ---
export function useNews(names: string[]) {
    const queryKey = names.slice().sort().join(',')
    return useQuery({
        queryKey: ['news', queryKey],
        queryFn: async () => {
            if (names.length === 0) return { items: [] }
            const res = await fetch('/api/news', {
                method: 'POST',
                body: JSON.stringify({ queries: names })
            })
            return res.json()
        },
        enabled: names.length > 0,
        staleTime: 15 * 60 * 1000, // 15 minutes
        refetchOnWindowFocus: false
    })
}