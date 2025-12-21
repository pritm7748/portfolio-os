'use client'

import { useEffect, useState, memo } from 'react'
import DesktopChart from './charts/desktop-chart'
import MobileChart from './charts/mobile-chart'
import { Loader2 } from 'lucide-react'

type Props = {
    symbol: string
}

function TechnicalChart({ symbol }: Props) {
  const [isMobile, setIsMobile] = useState<boolean | null>(null)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile() // Check on mount
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  if (isMobile === null) {
      return <div className="w-full h-[500px] flex items-center justify-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800"><Loader2 className="animate-spin text-indigo-500" /></div>
  }

  return isMobile ? <MobileChart symbol={symbol} /> : <DesktopChart symbol={symbol} />
}

export default memo(TechnicalChart)