'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

type Props = { data: any }

const CAP_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#94a3b8']
const SECTOR_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1']

function getRating(score: number): { label: string; color: string } {
    if (score >= 80) return { label: 'Highly Diversified', color: 'text-emerald-600 dark:text-emerald-400' }
    if (score >= 60) return { label: 'Well Diversified', color: 'text-blue-600 dark:text-blue-400' }
    if (score >= 40) return { label: 'Moderately Concentrated', color: 'text-amber-600 dark:text-amber-400' }
    return { label: 'Highly Concentrated', color: 'text-red-500' }
}

export default function AllocationTab({ data }: Props) {
    const { allocation } = data
    const { marketCap, sectors, concentration } = allocation || {}

    // Prepare market cap data for pie
    const capData = Object.entries(marketCap || {})
        .filter(([_, v]) => (v as number) > 0)
        .map(([name, value]) => ({ name, value: +(value as number).toFixed(1) }))

    // Diversification score (inverse of HHI, normalized)
    const hhi = concentration?.hhi || 0
    const maxHHI = 10000 // single stock
    const diversityScore = Math.max(0, Math.min(100, Math.round((1 - hhi / maxHHI) * 100)))
    const rating = getRating(diversityScore)

    // Top sectors
    const topSectors = (sectors || []).slice(0, 10)

    return (
        <div className="space-y-6">
            {/* Diversification Score Hero */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-800/30 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Diversification Score</h3>
                    <span className={`text-sm font-bold ${rating.color}`}>{rating.label}</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                    <div
                        className="h-3 rounded-full transition-all duration-700 bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500"
                        style={{ width: `${diversityScore}%` }}
                    />
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-slate-400">
                    <span>Concentrated</span>
                    <span className="font-bold text-slate-600 dark:text-slate-300">{diversityScore}/100</span>
                    <span>Diversified</span>
                </div>
            </div>

            {/* Concentration Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Total Stocks', value: concentration?.totalStocks || 0, suffix: '' },
                    { label: 'Top 5 Weight', value: concentration?.top5?.toFixed(1) || '0', suffix: '%' },
                    { label: 'Top 10 Weight', value: concentration?.top10?.toFixed(1) || '0', suffix: '%' },
                    { label: 'HHI Index', value: Math.round(hhi), suffix: '' },
                ].map(m => (
                    <div key={m.label} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-center">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{m.label}</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{m.value}{m.suffix}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Market Cap Donut */}
                {capData.length > 0 && (
                    <div>
                        <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Market Cap Allocation</h3>
                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4">
                            <div className="h-[240px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={capData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value"
                                            label={({ name, value }) => `${name}: ${value}%`}
                                        >
                                            {capData.map((_, i) => <Cell key={i} fill={CAP_COLORS[i % CAP_COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip formatter={(v: number) => `${v}%`} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex flex-wrap gap-3 mt-2 justify-center">
                                {capData.map((d, i) => (
                                    <div key={d.name} className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CAP_COLORS[i % CAP_COLORS.length] }} />
                                        <span className="text-xs text-slate-600 dark:text-slate-400">{d.name} ({d.value}%)</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Sector Allocation */}
                {topSectors.length > 0 && (
                    <div>
                        <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Sector Allocation</h3>
                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4">
                            <div className="h-[240px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={topSectors} layout="vertical" margin={{ left: 0, right: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.1} />
                                        <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `${v}%`} />
                                        <YAxis dataKey="sector" type="category" width={110} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                        <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', fontSize: '12px', color: '#fff' }} />
                                        <Bar dataKey="weight" radius={[0, 4, 4, 0]}>
                                            {topSectors.map((_: any, i: number) => <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            {/* Sector concentration callout */}
                            <div className="mt-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-900/30 text-xs text-slate-500">
                                Top 3 sectors make up <span className="font-bold text-slate-700 dark:text-slate-300">
                                    {topSectors.slice(0, 3).reduce((a: number, s: any) => a + s.weight, 0).toFixed(1)}%
                                </span> of the portfolio
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
