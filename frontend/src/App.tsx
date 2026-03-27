import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect, useRef } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PeriodProvider } from '@/hooks/usePeriod'
import { StoreProvider } from '@/hooks/useStore'
import { ThemeProvider } from '@/hooks/useTheme'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import Layout from '@/components/layout/Layout'
import Login from '@/pages/Login'
import Summary from '@/pages/Summary'

const Instagram = lazy(() => import('@/pages/Instagram'))
const LinePage = lazy(() => import('@/pages/Line'))
const GA4 = lazy(() => import('@/pages/GA4'))
const GBP = lazy(() => import('@/pages/GBP'))
const Admin = lazy(() => import('@/pages/Admin'))
const Report = lazy(() => import('@/pages/Report'))

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

function AuthGate() {
  const { isAuthenticated, canAccessAdmin, canExportReport } = useAuth()

  if (!isAuthenticated) {
    return <Login />
  }

  const fallback = (
    <div className="flex items-center justify-center h-64">
      <div className="size-8 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
    </div>
  )

  return (
    <>
      <ScrollToTop />
      <Suspense fallback={fallback}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Summary />} />
            <Route path="/instagram" element={<Instagram />} />
            <Route path="/line" element={<LinePage />} />
            <Route path="/ga4" element={<GA4 />} />
            <Route path="/gbp" element={<GBP />} />
            {canAccessAdmin && <Route path="/admin" element={<Admin />} />}
            <Route path="/settings" element={<Navigate to="/admin" replace />} />
            <Route path="/accounts" element={<Navigate to="/admin" replace />} />
          </Route>
          {canExportReport && <Route path="/report" element={<Report />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  )
}

function useDismissLoadingScreen() {
  const dismissed = useRef(false)
  useEffect(() => {
    if (dismissed.current) return
    dismissed.current = true
    const el = document.getElementById('loading-screen')
    if (!el) return
    // Minimum display time to let the animation play
    const minTime = 800
    const start = performance.timing?.navigationStart || performance.now()
    const elapsed = performance.now() - start
    const delay = Math.max(0, minTime - elapsed)
    setTimeout(() => {
      el.classList.add('fade-out')
      setTimeout(() => el.remove(), 400)
    }, delay)
  }, [])
}

export default function App() {
  useDismissLoadingScreen()
  return (
    <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <PeriodProvider>
      <StoreProvider>
        <AuthProvider>
          <BrowserRouter>
            <AuthGate />
          </BrowserRouter>
        </AuthProvider>
      </StoreProvider>
      </PeriodProvider>
    </QueryClientProvider>
    </ThemeProvider>
  )
}
