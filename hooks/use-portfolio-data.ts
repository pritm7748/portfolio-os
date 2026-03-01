import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { usePortfolio } from '@/context/portfolio-context'
import { useMemo } from 'react'

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
    asset_id: number
    assets: {
        ticker: string
        name: string
        asset_type: string
        // NEW FIELDS ADDED HERE
        sector?: string
        industry?: string
    }
}

export type WatchlistItem = {
    id: number
    watchlist_id: number
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

export type WatchlistGroup = {
    id: number
    name: string
    created_at: string
}

// --- 1. Transactions Hook (Core Data) ---
export function useTransactions() {
    const { selectedPortfolio } = usePortfolio()
    const supabase = createClient()

    return useQuery({
        queryKey: ['transactions', selectedPortfolio.id],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('No user found')

            let query = supabase
                .from('transactions')
                // FETCH SECTOR & INDUSTRY
                .select(`*, assets ( ticker, name, asset_type, sector, industry )`)
                .order('date', { ascending: true })

            if (selectedPortfolio.id !== 'all') {
                query = query.eq('portfolio_id', selectedPortfolio.id)
            }

            const { data, error } = await query
            if (error) throw error
            return data as Transaction[]
        },
        staleTime: 5 * 60 * 1000,
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
export function useWatchlist(watchlistId?: number) {
    const supabase = createClient()
    return useQuery({
        queryKey: ['watchlist', watchlistId],
        queryFn: async () => {
            if (!watchlistId) return []

            const { data, error } = await supabase
                .from('watchlist')
                .select('*')
                .eq('watchlist_id', watchlistId)
                .order('created_at', { ascending: false })

            if (error) throw error
            return data as WatchlistItem[]
        },
        enabled: !!watchlistId,
        staleTime: 10 * 60 * 1000
    })
}

// --- NEW: Fetch ALL Watchlist Items for User (for News/Pulse) ---
export function useAllWatchlistItems() {
    const supabase = createClient()

    return useQuery({
        queryKey: ['all_watchlist_items'],
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
        staleTime: 10 * 60 * 1000 // 10 minutes
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

export function usePulse(tickers: string[]) {
    // Stable cache key
    const sortedTickers = tickers.slice().sort().join(',')

    return useQuery({
        queryKey: ['pulse', sortedTickers],
        queryFn: async () => {
            // REMOVED THE EARLY RETURN for empty tickers
            // We want to fetch Macro data even if tickers is empty
            const res = await fetch('/api/pulse', {
                method: 'POST',
                body: JSON.stringify({ tickers: tickers || [] })
            })
            if (!res.ok) throw new Error('Pulse fetch failed')
            return res.json()
        },
        // REMOVED THE ENABLED CHECK
        // enabled: tickers.length > 0, 
        staleTime: 6 * 60 * 60 * 1000, // Cache for 6 hours
        refetchOnWindowFocus: false
    })
}

export function useActiveAssets() {
    const supabase = createClient()
    const { data: watchlistItems } = useAllWatchlistItems()

    // Fetch ALL transactions across ALL portfolios (not portfolio-scoped like useTransactions)
    const { data: transactions } = useQuery({
        queryKey: ['all_transactions_for_active_assets'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('No user')
            const { data, error } = await supabase
                .from('transactions')
                .select(`*, assets ( ticker, name, asset_type, sector, industry )`)
                .order('date', { ascending: true })
            if (error) throw error
            return data as Transaction[]
        },
        staleTime: 5 * 60 * 1000,
    })

    return useMemo(() => {
        const uniqueMap = new Map<string, { ticker: string, name: string, type: 'Holding' | 'Watchlist' }>()
        const soldRoots = new Set<string>()
        const getRoot = (t: string) => t.toUpperCase().replace('.NS', '').replace('.BO', '')

        // 1. Aggregate by ROOT symbol (merges cross-exchange transactions)
        if (transactions) {
            const qtyMap: Record<string, number> = {}
            const metaMap: Record<string, { ticker: string, name: string }> = {}

            transactions.forEach(t => {
                const ticker = t.assets.ticker
                const root = getRoot(ticker)
                const q = Number(t.quantity)

                if (!qtyMap[root]) {
                    qtyMap[root] = 0
                    metaMap[root] = { ticker, name: t.assets.name }
                }

                if (t.transaction_type === 'Buy') qtyMap[root] += q
                else if (t.transaction_type === 'Sell') qtyMap[root] -= q
            })

            Object.entries(qtyMap).forEach(([root, netQty]) => {
                if (netQty > 0.0001) {
                    uniqueMap.set(root, {
                        ticker: metaMap[root].ticker,
                        name: metaMap[root].name,
                        type: 'Holding'
                    })
                } else {
                    soldRoots.add(root)
                }
            })
        }

        // 2. Merge Watchlist Items — skip sold holdings
        if (watchlistItems) {
            watchlistItems.forEach(w => {
                const root = getRoot(w.ticker)
                if (!uniqueMap.has(root) && !soldRoots.has(root)) {
                    uniqueMap.set(root, {
                        ticker: w.ticker,
                        name: w.name,
                        type: 'Watchlist'
                    })
                }
            })
        }

        return Array.from(uniqueMap.values()).sort((a, b) => a.name.localeCompare(b.name))
    }, [transactions, watchlistItems])
}

export function useChartData(symbol: string, interval: string, range: string) {
    return useQuery({
        queryKey: ['chart', symbol, interval, range],
        queryFn: async () => {
            const res = await fetch('/api/chart', {
                method: 'POST',
                body: JSON.stringify({ symbol, interval, range })
            })
            if (!res.ok) throw new Error('Chart fetch failed')
            return res.json()
        },
        enabled: !!symbol,
        staleTime: 1 * 60 * 1000, // Cache 1 minute for intraday
        gcTime: 5 * 60 * 1000,    // Keep unused data for 5 minutes
        refetchOnWindowFocus: false
    })
}

// --- NEW: Watchlist Groups Hook ---
export function useWatchlists() {
    const supabase = createClient()
    return useQuery({
        queryKey: ['watchlists_groups'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('No user')

            const { data, error } = await supabase
                .from('watchlists')
                .select('*')
                .order('created_at', { ascending: true })

            if (error) throw error
            // If no watchlists exist (new user), create default
            if (data.length === 0) {
                const { data: newWl } = await supabase.from('watchlists').insert({ user_id: user.id, name: 'Main Watchlist' }).select().single()
                return [newWl] as WatchlistGroup[]
            }
            return data as WatchlistGroup[]
        },
        staleTime: Infinity
    })
}
