import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, request } from './api.js'
import { AuthContext } from './authContext.js'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refreshUser = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setUser(await request('/api/auth/me'))
    } catch (cause) {
      setUser(null)
      if (!(cause instanceof ApiError) || cause.status !== 401) {
        setError(cause.message)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    request('/api/auth/me')
      .then((authenticatedUser) => {
        if (active) setUser(authenticatedUser)
      })
      .catch((cause) => {
        if (!active) return
        setUser(null)
        if (!(cause instanceof ApiError) || cause.status !== 401) {
          setError(cause.message)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const signIn = useCallback((authenticatedUser) => {
    setError('')
    setUser(authenticatedUser)
  }, [])

  const signOut = useCallback(async () => {
    await request('/api/auth/logout', { method: 'POST' })
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, error, refreshUser, signIn, signOut }),
    [user, loading, error, refreshUser, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
