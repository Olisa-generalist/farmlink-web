// src/lib/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) fetchProfile(session.user)
        else { setProfile(null); setLoading(false) }
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  // Fetches profile from users table, falls back to auth metadata
  // so name and role are always available even if profile row is incomplete
  async function fetchProfile(authUser, attempt = 1) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (data && data.full_name && data.role) {
      // Profile row exists and is complete — use it
      setProfile(data)
      setLoading(false)
    } else if (attempt < 4) {
      // Row may still be writing — retry after short delay
      setTimeout(() => fetchProfile(authUser, attempt + 1), 600)
    } else {
      // After retries, build profile from auth metadata as fallback
      // This handles cases where profile save failed but auth succeeded
      const meta = authUser.user_metadata || {}
      const fallbackProfile = {
        id: authUser.id,
        full_name: data?.full_name || meta.full_name || meta.name || authUser.email?.split('@')[0] || 'User',
        email: authUser.email,
        role: data?.role || meta.role || 'buyer',
        is_verified: data?.is_verified || false,
      }

      // Try to save/fix the profile row if it was incomplete
      await supabase.from('users').upsert(fallbackProfile)
      setProfile(fallbackProfile)
      setLoading(false)
    }
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
