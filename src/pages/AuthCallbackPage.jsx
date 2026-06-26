// src/pages/AuthCallbackPage.jsx
// ─────────────────────────────────────────────────────
// Google redirects users back to /auth/callback after login.
// This page picks them up, saves their profile if new,
// then sends them to the home screen.
// ─────────────────────────────────────────────────────
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    async function handleCallback() {
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session) {
        toast.error('Sign-in failed. Please try again.')
        navigate('/login')
        return
      }

      const user = session.user

      // Check if they already have a profile (returning Google user)
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .single()

      if (!existing) {
        // New Google user — create their profile
        // Role comes from localStorage (set before Google redirect)
        const role = localStorage.getItem('pendingRole') || 'buyer'
        localStorage.removeItem('pendingRole')

        await supabase.from('users').upsert({
          id: user.id,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
          email: user.email,
          role,
        })

        // Wallet for farmers and providers
        if (role === 'farmer' || role === 'provider') {
          await supabase.from('wallets').upsert({ user_id: user.id, balance: 0 })
        }

        toast.success('Welcome to Naagora!')
      } else {
        toast.success('Welcome back!')
      }

      navigate('/')
    }

    handleCallback()
  }, [navigate])

  return (
    <div style={{
      height: '100dvh', display: 'flex',
      flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16
    }}>
      <div className="spinner" />
      <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Signing you in...</p>
    </div>
  )
}
