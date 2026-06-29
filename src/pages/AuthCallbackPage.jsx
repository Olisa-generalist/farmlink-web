// src/pages/AuthCallbackPage.jsx
// ─────────────────────────────────────────────
// Handles Google OAuth redirect.
//
// Race condition fix:
// We set a sessionStorage flag BEFORE saving the profile so
// AuthContext knows to wait for us to finish before reading.
// ─────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [status, setStatus] = useState('Completing sign-in...')

  useEffect(() => {
    async function handleCallback() {
      // Check for OAuth errors first
      const params = new URLSearchParams(location.search)
      const error = params.get('error')
      if (error) {
        const message = error === 'bad_oauth_state'
          ? 'Sign-in session expired. Please try again.'
          : params.get('error_description')?.replace(/\+/g, ' ') || 'Sign-in failed.'
        toast.error(message)
        navigate('/login')
        return
      }

      // Tell AuthContext to wait — we are about to write the profile
      sessionStorage.setItem('naagora_callback_in_progress', 'true')

      setStatus('Getting your account...')
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session) {
        sessionStorage.removeItem('naagora_callback_in_progress')
        toast.error('Could not complete sign-in. Please try again.')
        navigate('/login')
        return
      }

      const user = session.user
      setStatus('Setting up your profile...')

      // Get intended role from all possible sources
      const cookieRole  = getCookie('naagora_pending_role')
      const localRole   = localStorage.getItem('pendingRole')
      const sessionRole = sessionStorage.getItem('pendingRole')

      // Clean up
      deleteCookie('naagora_pending_role')
      localStorage.removeItem('pendingRole')

      const intendedRole = cookieRole || localRole || sessionRole

      // Check existing profile
      const { data: existing } = await supabase
        .from('users')
        .select('id, role, full_name')
        .eq('id', user.id)
        .single()

      // Decide final role:
      // - If we have an intended role from cookie/storage → use it (new signup)
      // - If existing profile has a real role (not buyer from a bad save) → keep it
      // - Otherwise default to buyer
      let finalRole = 'buyer'
      if (intendedRole && intendedRole !== 'buyer') {
        // User specifically chose farmer or provider → always honour it
        finalRole = intendedRole
      } else if (existing?.role && existing.role !== 'buyer') {
        // Returning user with real role already set → keep it
        finalRole = existing.role
      } else if (intendedRole === 'buyer') {
        // User explicitly chose buyer
        finalRole = 'buyer'
      }

      // Save profile with correct role
      const profileData = {
        id: user.id,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0],
        email: user.email,
        role: finalRole,
      }

      await supabase.from('users').upsert(profileData)

      // Create wallet for farmer/provider
      if (finalRole === 'farmer' || finalRole === 'provider') {
        await supabase.from('wallets').upsert({ user_id: user.id, balance: 0 })
      }

      // Done — clear the flag so AuthContext can now read the profile
      sessionStorage.removeItem('naagora_callback_in_progress')
      sessionStorage.removeItem('pendingRole')

      toast.success(existing?.full_name ? 'Welcome back!' : 'Welcome to Naagora!')
      navigate('/')
    }

    handleCallback()
  }, [])

  return (
    <div style={{
      height: '100dvh', display: 'flex',
      flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16
    }}>
      <div className="spinner" />
      <p style={{ color: 'var(--text-3)', fontSize: 14 }}>{status}</p>
    </div>
  )
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? match[2] : null
}

function deleteCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`
}

export function setCookie(name, value, minutes = 10) {
  const expires = new Date(Date.now() + minutes * 60 * 1000).toUTCString()
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`
}
