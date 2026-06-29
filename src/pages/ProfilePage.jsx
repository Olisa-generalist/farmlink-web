// src/pages/ProfilePage.jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import toast from 'react-hot-toast'

const ROLE_LABELS = {
  buyer: { label: 'Buyer', icon: '🛒', color: '#185FA5', bg: '#E6F1FB' },
  farmer: { label: 'Farmer', icon: '🌾', color: '#085041', bg: '#E1F5EE' },
  provider: { label: 'Logistics Provider', icon: '🚚', color: '#633806', bg: '#FAEEDA' },
}

export default function ProfilePage() {
  const { profile, signOut, refreshProfile } = useAuth()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(profile?.full_name || '')
  const [loading, setLoading] = useState(false)

  const role = profile?.role || 'buyer'
  const roleInfo = ROLE_LABELS[role] || ROLE_LABELS.buyer

  async function handleSaveName(e) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    const { error } = await supabase
      .from('users')
      .update({ full_name: name.trim() })
      .eq('id', profile.id)
    if (error) {
      toast.error('Could not update name')
    } else {
      toast.success('Name updated!')
      await refreshProfile()
      setEditing(false)
    }
    setLoading(false)
  }

  return (
    <div className="page">
      <div className="topbar"><h1>My Profile</h1></div>

      <div className="page-content" style={{ paddingTop: 20 }}>

        {/* Avatar + role */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: roleInfo.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, marginBottom: 10
          }}>
            {roleInfo.icon}
          </div>
          <div style={{ fontWeight: 600, fontSize: 17, marginBottom: 4 }}>
            {profile?.full_name}
          </div>
          <span style={{
            background: roleInfo.bg, color: roleInfo.color,
            fontSize: 12, fontWeight: 500,
            padding: '3px 10px', borderRadius: 20
          }}>
            {roleInfo.label}
          </span>
        </div>

        {/* Edit name */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-body">
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
              Account details
            </div>
            {editing ? (
              <form onSubmit={handleSaveName}>
                <div className="input-group">
                  <label>Full name</label>
                  <input value={name} onChange={e => setName(e.target.value)} autoFocus required />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                    {loading ? 'Saving...' : 'Save'}
                  </button>
                  <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Full name</div>
                  <div style={{ fontSize: 14, marginTop: 2 }}>{profile?.full_name}</div>
                </div>
                <button className="btn btn-sm" onClick={() => { setName(profile?.full_name || ''); setEditing(true) }}>
                  Edit
                </button>
              </div>
            )}

            <hr className="divider" />
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Email</div>
              <div style={{ fontSize: 14, marginTop: 2 }}>{profile?.email || 'Not set'}</div>
            </div>

            <hr className="divider" />
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Account type</div>
              <div style={{ fontSize: 14, marginTop: 2 }}>{roleInfo.label}</div>
            </div>
          </div>
        </div>

        {/* Role-specific quick links */}
        {role === 'farmer' && (
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-body">
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                Farmer tools
              </div>
              <Link to="/dashboard" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit', padding: '8px 0', borderBottom: '0.5px solid var(--border)' }}>
                <span style={{ fontSize: 14 }}>📦 My products</span>
                <span style={{ color: 'var(--text-3)' }}>→</span>
              </Link>
              <Link to="/add-product" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit', padding: '8px 0', borderBottom: '0.5px solid var(--border)' }}>
                <span style={{ fontSize: 14 }}>➕ Add new product</span>
                <span style={{ color: 'var(--text-3)' }}>→</span>
              </Link>
              <Link to="/dashboard" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit', padding: '8px 0' }}>
                <span style={{ fontSize: 14 }}>💰 Earnings & wallet</span>
                <span style={{ color: 'var(--text-3)' }}>→</span>
              </Link>
            </div>
          </div>
        )}

        {role === 'provider' && (
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-body">
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                Logistics tools
              </div>
              <Link to="/dashboard" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit', padding: '8px 0', borderBottom: '0.5px solid var(--border)' }}>
                <span style={{ fontSize: 14 }}>🚚 My services</span>
                <span style={{ color: 'var(--text-3)' }}>→</span>
              </Link>
              <Link to="/add-service" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit', padding: '8px 0', borderBottom: '0.5px solid var(--border)' }}>
                <span style={{ fontSize: 14 }}>➕ Add new service</span>
                <span style={{ color: 'var(--text-3)' }}>→</span>
              </Link>
              <Link to="/dashboard" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit', padding: '8px 0' }}>
                <span style={{ fontSize: 14 }}>💰 Earnings & wallet</span>
                <span style={{ color: 'var(--text-3)' }}>→</span>
              </Link>
            </div>
          </div>
        )}

        {role === 'buyer' && (
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-body">
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                Buyer tools
              </div>
              <Link to="/orders" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit', padding: '8px 0', borderBottom: '0.5px solid var(--border)' }}>
                <span style={{ fontSize: 14 }}>📦 My orders</span>
                <span style={{ color: 'var(--text-3)' }}>→</span>
              </Link>
              <Link to="/" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit', padding: '8px 0' }}>
                <span style={{ fontSize: 14 }}>🛒 Browse marketplace</span>
                <span style={{ color: 'var(--text-3)' }}>→</span>
              </Link>
            </div>
          </div>
        )}

        {/* Role notice for farmers/providers */}
        {(role === 'farmer' || role === 'provider') && (
          <div style={{
            background: 'var(--surface-2)', borderRadius: 10,
            padding: '10px 14px', fontSize: 12,
            color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 12
          }}>
            💡 As a {roleInfo.label.toLowerCase()}, you can also browse and purchase from the marketplace using this same account.
            {role === 'farmer'
              ? ' If you run a logistics business, register it with a separate email.'
              : ' If you run a farm, register it with a separate email.'}
          </div>
        )}

        {/* Sign out */}
        <button
          className="btn btn-full"
          onClick={signOut}
          style={{ color: 'var(--red)', borderColor: 'var(--red-light)' }}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
