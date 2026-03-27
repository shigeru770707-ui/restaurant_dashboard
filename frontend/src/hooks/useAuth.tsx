import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

export type Role = 'hq' | 'pr' | 'manager' | 'staff'

export interface AuthUser {
  id: number
  username: string
  role: Role
  store_id: number | null
  display_name: string
}

interface AuthContextType {
  isAuthenticated: boolean
  user: AuthUser | null
  token: string | null
  login: (username: string, password: string) => Promise<string | null>
  logout: () => void
  /** ロールが指定リストに含まれるか */
  hasRole: (...roles: Role[]) => boolean
  /** 設定ページにアクセスできるか */
  canAccessSettings: boolean
  /** アカウント管理ができるか */
  canManageUsers: boolean
  /** レポートを出力できるか */
  canExportReport: boolean
  /** 管理画面にアクセスできるか（HQ or 広報） */
  canAccessAdmin: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

const AUTH_KEY = 'restaurant_dashboard_auth'

interface StoredAuth {
  token: string
  user: AuthUser
  expiry: number
}

function loadStored(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    const stored: StoredAuth = JSON.parse(raw)
    if (stored.expiry <= Date.now()) {
      localStorage.removeItem(AUTH_KEY)
      return null
    }
    return stored
  } catch {
    localStorage.removeItem(AUTH_KEY)
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<StoredAuth | null>(loadStored)

  const isAuthenticated = stored !== null
  const user = stored?.user ?? null
  const token = stored?.token ?? null

  useEffect(() => {
    if (stored && stored.expiry <= Date.now()) {
      setStored(null)
      localStorage.removeItem(AUTH_KEY)
    }
  }, [stored])

  const login = useCallback(async (username: string, password: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (!res.ok) return 'ユーザー名またはパスワードが正しくありません'
      const data = await res.json()
      if (data.success && data.token && data.user) {
        const newStored: StoredAuth = {
          token: data.token,
          user: data.user,
          expiry: Date.now() + 24 * 60 * 60 * 1000,
        }
        localStorage.setItem(AUTH_KEY, JSON.stringify(newStored))
        setStored(newStored)
        return null // success
      }
      return 'ログインに失敗しました'
    } catch {
      return 'サーバーに接続できません'
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY)
    setStored(null)
  }, [])

  const hasRole = useCallback((...roles: Role[]) => {
    return user !== null && roles.includes(user.role)
  }, [user])

  const canAccessSettings = user?.role === 'hq'
  const canManageUsers = user?.role === 'hq' || user?.role === 'pr'
  const canExportReport = user?.role !== 'staff'
  const canAccessAdmin = canAccessSettings || canManageUsers

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      user,
      token,
      login,
      logout,
      hasRole,
      canAccessSettings,
      canManageUsers,
      canExportReport,
      canAccessAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
