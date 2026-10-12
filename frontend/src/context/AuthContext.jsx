import { createContext, useContext, useEffect, useState } from 'react'
import { login as apiLogin, getMe } from '../api/endpoints'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('attendify_token')
    if (!token) {
      setLoading(false)
      return
    }
    getMe()
      .then((u) => setUser(u))
      .catch(() => {
        localStorage.removeItem('attendify_token')
        localStorage.removeItem('attendify_user')
      })
      .finally(() => setLoading(false))
  }, [])

  const login = async (email, password) => {
    setError(null)
    try {
      const data = await apiLogin(email, password)
      localStorage.setItem('attendify_token', data.access_token)
      localStorage.setItem('attendify_user', JSON.stringify(data.user))
      setUser(data.user)
      return data.user
    } catch (err) {
      const message = err.response?.data?.detail || 'Login failed. Please try again.'
      setError(message)
      throw new Error(message)
    }
  }

  const logout = () => {
    localStorage.removeItem('attendify_token')
    localStorage.removeItem('attendify_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
