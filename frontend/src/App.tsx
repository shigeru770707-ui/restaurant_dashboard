import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PeriodProvider } from '@/hooks/usePeriod'
import { StoreProvider } from '@/hooks/useStore'
import { ThemeProvider } from '@/hooks/useTheme'
import Layout from '@/components/layout/Layout'
import Summary from '@/pages/Summary'
import Instagram from '@/pages/Instagram'
import LinePage from '@/pages/Line'
import GA4 from '@/pages/GA4'
import GBP from '@/pages/GBP'
import Settings from '@/pages/Settings'
import Report from '@/pages/Report'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
})

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <PeriodProvider>
      <StoreProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Summary />} />
              <Route path="/instagram" element={<Instagram />} />
              <Route path="/line" element={<LinePage />} />
              <Route path="/ga4" element={<GA4 />} />
              <Route path="/gbp" element={<GBP />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="/report" element={<Report />} />
          </Routes>
        </BrowserRouter>
      </StoreProvider>
      </PeriodProvider>
    </QueryClientProvider>
    </ThemeProvider>
  )
}
