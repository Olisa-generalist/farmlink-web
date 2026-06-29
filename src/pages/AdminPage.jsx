// src/pages/AdminPage.jsx
// Only accessible to users with role = 'admin'
// You set yourself as admin directly in Supabase:
// Table Editor → users → find your row → change role to 'admin'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

export default function AdminPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('pending') // 'pending' | 'approved' | 'rejected'

  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      toast.error('Access denied')
      navigate('/')
    }
  }, [profile])

  useEffect(() => { fetchProducts() }, [tab])

  async function fetchProducts() {
    setLoading(true)
    let query = supabase
      .from('products')
      .select(`*, users ( full_name, email )`)
      .order('created_at', { ascending: false })

    if (tab === 'pending') query = query.eq('is_verified', false).eq('is_available', false)
    if (tab === 'approved') query = query.eq('is_verified', true).eq('is_available', true)
    if (tab === 'rejected') query = query.eq('is_verified', false).eq('admin_rejected', true)

    const { data } = await query
    setProducts(data || [])
    setLoading(false)
  }

  async function approveProduct(id) {
    const { error } = await supabase
      .from('products')
      .update({ is_verified: true, is_available: true, admin_rejected: false })
      .eq('id', id)
    if (error) { toast.error('Could not approve'); return }
    toast.success('Product approved and live!')
    fetchProducts()
  }

  async function rejectProduct(id) {
    const reason = window.prompt('Reason for rejection (farmer will see this):')
    if (!reason) return
    const { error } = await supabase
      .from('products')
      .update({ is_verified: false, is_available: false, admin_rejected: true, rejection_reason: reason })
      .eq('id', id)
    if (error) { toast.error('Could not reject'); return }
    toast.success('Product rejected. Farmer notified.')
    fetchProducts()
  }

  const TABS = [
    { id: 'pending', label: 'Pending review' },
    { id: 'approved', label: 'Approved' },
    { id: 'rejected', label: 'Rejected' },
  ]

  return (
    <div className="page">
      <div className="topbar">
        <h1>Admin — Product Review</h1>
      </div>

      <div style={{ display: 'flex', borderBottom: '0.5px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '10px 0', background: 'none', border: 'none',
            borderBottom: tab === t.id ? '2px solid var(--green)' : '2px solid transparent',
            color: tab === t.id ? 'var(--green)' : 'var(--text-3)',
            fontWeight: tab === t.id ? 600 : 400,
            fontSize: 12, cursor: 'pointer', fontFamily: 'inherit'
          }}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="page-content" style={{ paddingTop: 14 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div className="spinner" />
          </div>
        ) : products.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">✅</div>
            <h3>Nothing here</h3>
            <p>No {tab} products right now.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {products.map(p => (
              <div key={p.id} className="card">
                <div className="card-body">
                  {/* Photos */}
                  {p.photos?.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto' }}>
                      {p.photos.map((url, i) => (
                        <img key={i} src={url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontWeight: 500, fontSize: 15 }}>{p.name}</div>
                    <div style={{ fontWeight: 600, color: 'var(--green)', fontSize: 14 }}>
                      ₦{Number(p.price_per_unit).toLocaleString()}/{p.unit}
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>
                    By {p.users?.full_name} ({p.users?.email})
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
                    {p.state} · {p.quantity_available} {p.unit}s · {p.category}
                  </div>

                  {p.description && (
                    <p style={{ fontSize: 12, marginBottom: 10, lineHeight: 1.6 }}>{p.description}</p>
                  )}

                  {p.rejection_reason && (
                    <div style={{ background: 'var(--red-light)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>
                      Rejection reason: {p.rejection_reason}
                    </div>
                  )}

                  {tab === 'pending' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => approveProduct(p.id)}>
                        ✓ Approve & go live
                      </button>
                      <button className="btn" style={{ flex: 1, color: 'var(--red)', borderColor: 'var(--red-light)' }} onClick={() => rejectProduct(p.id)}>
                        ✗ Reject
                      </button>
                    </div>
                  )}

                  {tab === 'approved' && (
                    <button className="btn" style={{ width: '100%', color: 'var(--red)', borderColor: 'var(--red-light)' }} onClick={() => rejectProduct(p.id)}>
                      Remove from live
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
