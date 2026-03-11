'use client'

type Props = { data: any }

const fmtCr = (n: number) => {
    if (!n) return '—'
    const abs = Math.abs(n)
    if (abs >= 1e12) return '₹' + (n / 1e12).toFixed(2) + 'T'
    if (abs >= 1e10) return '₹' + (n / 1e10).toFixed(2) + 'K Cr'
    if (abs >= 1e7) return '₹' + (n / 1e7).toFixed(2) + ' Cr'
    if (abs >= 1e5) return '₹' + (n / 1e5).toFixed(2) + ' L'
    return '₹' + n.toLocaleString('en-IN')
}

const fmtPct = (n: number) => n ? n.toFixed(2) + '%' : '—'
const fmtNum = (n: number) => n ? n.toFixed(2) : '—'

type MetricCard = { label: string; value: string; color: string; highlight?: boolean; subtext?: string }

function getColor(label: string, n: number): string {
    const rules: Record<string, (v: number) => string> = {
        'P/E': v => v < 15 ? 'text-green-600 dark:text-green-400' : v < 30 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400',
        'Forward P/E': v => v < 15 ? 'text-green-600 dark:text-green-400' : v < 30 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400',
        'P/B': v => v < 2 ? 'text-green-600 dark:text-green-400' : v < 4 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400',
        'EV/EBITDA': v => v < 12 ? 'text-green-600 dark:text-green-400' : v < 25 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400',
        'PEG': v => v < 1 ? 'text-green-600 dark:text-green-400' : v < 2 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400',
        'ROE': v => v > 15 ? 'text-green-600 dark:text-green-400' : v > 8 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400',
        'ROCE': v => v > 15 ? 'text-green-600 dark:text-green-400' : v > 8 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400',
        'D/E': v => v < 0.5 ? 'text-green-600 dark:text-green-400' : v < 1.5 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400',
        'Div Yield': v => v > 2 ? 'text-green-600 dark:text-green-400' : v > 0.5 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300',
        'Promoter': v => v > 60 ? 'text-green-600 dark:text-green-400' : v > 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400',
        'Pledged': v => v === 0 ? 'text-green-600 dark:text-green-400' : v < 10 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400',
        'Rev Growth': v => v > 10 ? 'text-green-600 dark:text-green-400' : v > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400',
        'OPM': v => v > 15 ? 'text-green-600 dark:text-green-400' : v > 5 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400',
        'NPM': v => v > 10 ? 'text-green-600 dark:text-green-400' : v > 2 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400',
    }
    const fn = rules[label]
    if (fn && n) return fn(n)
    return 'text-slate-800 dark:text-white'
}

// Sector-specific metrics to highlight
const sectorHighlights: Record<string, string[]> = {
    'Financial Services': ['P/B', 'ROE'],
    'Technology': ['P/S', 'Rev Growth'],
    'Banks': ['P/B', 'ROE'],
    'Energy': ['EV/EBITDA', 'D/E'],
    'Consumer': ['P/E', 'OPM'],
}

export default function ValuationTab({ data }: Props) {
    if (!data) return <p className="text-sm text-slate-400 py-8 text-center">No data available</p>

    const sector = data.sector || ''
    const highlights = sectorHighlights[sector] || []

    const metrics: MetricCard[] = [
        { label: 'Market Cap', value: fmtCr(data.marketCap), color: 'text-slate-800 dark:text-white' },
        { label: 'P/E', value: fmtNum(data.peRatio), color: getColor('P/E', data.peRatio), highlight: highlights.includes('P/E') },
        { label: 'Forward P/E', value: fmtNum(data.forwardPE), color: getColor('Forward P/E', data.forwardPE) },
        { label: 'P/B', value: fmtNum(data.pbRatio), color: getColor('P/B', data.pbRatio), highlight: highlights.includes('P/B') },
        { label: 'EV/EBITDA', value: fmtNum(data.evEbitda), color: getColor('EV/EBITDA', data.evEbitda), highlight: highlights.includes('EV/EBITDA') },
        { label: 'P/S', value: fmtNum(data.priceToSales), color: 'text-slate-800 dark:text-white', highlight: highlights.includes('P/S') },
        { label: 'PEG', value: fmtNum(data.pegRatio), color: getColor('PEG', data.pegRatio) },
        { label: 'ROE', value: fmtPct(data.roe), color: getColor('ROE', data.roe), highlight: highlights.includes('ROE') },
        { label: 'ROCE', value: fmtPct(data.roce), color: getColor('ROCE', data.roce) },
        { label: 'D/E', value: fmtNum(data.debtToEquity), color: getColor('D/E', data.debtToEquity), highlight: highlights.includes('D/E') },
        { label: 'Div Yield', value: fmtPct(data.divYield * 100), color: getColor('Div Yield', data.divYield * 100) },
        { label: 'Rev Growth', value: fmtPct(data.revenueGrowth), color: getColor('Rev Growth', data.revenueGrowth), highlight: highlights.includes('Rev Growth') },
        { label: 'OPM', value: fmtPct(data.operatingMargin), color: getColor('OPM', data.operatingMargin), highlight: highlights.includes('OPM') },
        { label: 'NPM', value: fmtPct(data.profitMargin), color: getColor('NPM', data.profitMargin) },
        { label: 'Promoter', value: fmtPct(data.promoterHolding), color: getColor('Promoter', data.promoterHolding) },
        { label: 'Pledged', value: fmtPct(data.pledgedPercent), color: getColor('Pledged', data.pledgedPercent) },
        { label: 'Beta', value: fmtNum(data.beta), color: 'text-slate-800 dark:text-white' },
        { label: 'FCF', value: fmtCr(data.freeCashFlow), color: data.freeCashFlow > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400' },
    ]

    const price52High = data.high52 || 0
    const price52Low = data.low52 || 0
    const currentPrice = data.currentPrice || 0
    const pctFromHigh = price52High > 0 ? ((currentPrice - price52High) / price52High * 100) : 0
    const range52Pct = price52High > price52Low ? ((currentPrice - price52Low) / (price52High - price52Low)) * 100 : 50

    return (
        <div className="space-y-6">
            {/* Price & 52W Range */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                <div className="flex items-end justify-between mb-4">
                    <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Current Price</p>
                        <p className="text-3xl font-bold text-slate-900 dark:text-white">₹{currentPrice.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-slate-500">{data.sector} · {data.industry}</p>
                        <p className={`text-sm font-semibold ${pctFromHigh < -20 ? 'text-red-500' : pctFromHigh < -5 ? 'text-amber-500' : 'text-green-500'}`}>
                            {pctFromHigh.toFixed(1)}% from 52W High
                        </p>
                    </div>
                </div>
                <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>₹{price52Low.toLocaleString('en-IN')}</span>
                        <span>52 Week Range</span>
                        <span>₹{price52High.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 relative">
                        <div className="absolute h-2 rounded-full bg-gradient-to-r from-red-400 via-amber-400 to-green-400 inset-0" />
                        <div
                            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-indigo-600 rounded-full shadow"
                            style={{ left: `${Math.min(Math.max(range52Pct, 2), 98)}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {metrics.map(m => (
                    <div
                        key={m.label}
                        className={`rounded-xl border p-3.5 transition ${
                            m.highlight
                                ? 'border-indigo-300 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-900/10 ring-1 ring-indigo-200 dark:ring-indigo-800'
                                : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                        }`}
                    >
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1 flex items-center gap-1">
                            {m.label}
                            {m.highlight && <span className="text-[8px] bg-indigo-600 text-white px-1 rounded">KEY</span>}
                        </p>
                        <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
                    </div>
                ))}
            </div>

            {/* Analyst Target */}
            {data.targetMeanPrice > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                    <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Analyst Targets</h4>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-xs text-slate-500">Low</p>
                            <p className="text-lg font-bold text-red-500">₹{data.targetLowPrice?.toLocaleString('en-IN')}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">Mean ({data.numberOfAnalysts} analysts)</p>
                            <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">₹{data.targetMeanPrice?.toLocaleString('en-IN')}</p>
                            <p className={`text-xs font-semibold ${data.targetMeanPrice > currentPrice ? 'text-green-500' : 'text-red-500'}`}>
                                {((data.targetMeanPrice - currentPrice) / currentPrice * 100).toFixed(1)}% upside
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">High</p>
                            <p className="text-lg font-bold text-green-500">₹{data.targetHighPrice?.toLocaleString('en-IN')}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
