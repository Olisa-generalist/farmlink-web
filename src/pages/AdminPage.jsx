// src/pages/AdminPage.jsx
// Admin review panel — separate tabs for Products and Services
// Access: naagora.vercel.app/admin (role must be 'admin')

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const MAIN_TABS = ['products', 'services']

const STATUS_TABS = [
  { id: 'pending',  label: 'Pending review' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
]

export default function AdminPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [mainTab, setMainTab]     = useState('products') // products | services
  const [statusTab, setStatusTab] = useState('pending')
  const [items, setItems]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState(null) // full detail view
  const [lightbox, setLightbox]   = useState(null) // photo lightbox url

  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      toast.error('Access denied')
      navigate('/')
    }
  }, [profile])

  useEffect(() => {
    setSelected(null)
    fetchItems()
  }, [mainTab, statusTab])

  async function fetchItems() {
    setLoading(true)
    if (mainTab === 'products') {
      await fetchProducts()
    } else {
      await fetchServices()
    }
    setLoading(false)
  }

  async function fetchProducts() {
    let query = supabase
      .from('products')
      .select(`*, users ( id, full_name, email, profile_photo )`)
      .order('created_at', { ascending: false })

    if (statusTab === 'pending')  query = query.eq('is_verified', false).eq('is_available', false).is('admin_rejected', false)
    if (statusTab === 'approved') query = query.eq('is_verified', true).eq('is_available', true)
    if (statusTab === 'rejected') query = query.eq('admin_rejected', true)

    const { data, error } = await query
    if (error) { toast.error('Could not load products'); return }
    setItems(data || [])
  }

  async function fetchServices() {
    let query = supabase
      .from('logistics_services')
      .select(`*, users ( id, full_name, email, profile_photo )`)
      .order('created_at', { ascending: false })

    if (statusTab === 'pending')  query = query.eq('is_verified', false).eq('is_available', false).is('admin_rejected', false)
    if (statusTab === 'approved') query = query.eq('is_verified', true).eq('is_available', true)
    if (statusTab === 'rejected') query = query.eq('admin_rejected', true)

    const { data, error } = await query
    if (error) { toast.error('Could not load services'); return }
    setItems(data || [])
  }

  async function approveItem(id) {
    const table = mainTab === 'products' ? 'products' : 'logistics_services'
    const { error } = await supabase
      .from(table)
      .update({ is_verified: true, is_available: true, admin_rejected: false, rejection_reason: null })
      .eq('id', id)
    if (error) { toast.error('Could not approve'); return }
    toast.success(`${mainTab === 'products' ? 'Product' : 'Service'} approved and now live!`)
    setSelected(null)
    fetchItems()
  }

  async function rejectItem(id) {
    const reason = window.prompt(
      `Reason for rejection (the ${mainTab === 'products' ? 'farmer' : 'provider'} will see this):`
    )
    if (!reason) return
    const table = mainTab === 'products' ? 'products' : 'logistics_services'
    const { error } = await supabase
      .from(table)
      .update({ is_verified: false, is_available: false, admin_rejected: true, rejection_reason: reason })
      .eq('id', id)
    if (error) { toast.error('Could not reject'); return }
    toast.success('Rejected. Provider notified.')
    setSelected(null)
    fetchItems()
  }

  async function removeFromLive(id) {
    const reason = window.prompt('Reason for removal (optional):') || 'Removed by admin'
    const table = mainTab === 'products' ? 'products' : 'logistics_services'
    await supabase.from(table)
      .update({ is_verified: false, is_available: false, admin_rejected: true, rejection_reason: reason })
      .eq('id', id)
    toast.success('Removed from live listings')
    setSelected(null)
    fetchItems()
  }

  // ── DETAIL VIEW ──────────────────────────────────────
  if (selected) {
    const photos = selected.photos || []
    const isProduct = mainTab === 'products'

    return (
      <div className="page">
        {/* Lightbox */}
        {lightbox && (
          <div
            onClick={() => setLightbox(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 100,
              background: 'rgba(0,0,0,0.92)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <img src={lightbox} alt="Full size"
              style={{ maxWidth: '95vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} />
            <button onClick={() => setLightbox(null)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 24, width: 40, height: 40, borderRadius: '50%', cursor: 'pointer' }}>
              ×
            </button>
            <p style={{ position: 'absolute', bottom: 20, color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
              Tap anywhere to close
            </p>
          </div>
        )}

        <div className="topbar">
          <button onClick={() => setSelected(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-2)', padding: '0 8px 0 0' }}>←</button>
          <h1 style={{ fontSize: 15 }}>{isProduct ? 'Product review' : 'Service review'}</h1>
        </div>

        <div className="page-content" style={{ paddingTop: 16 }}>

          {/* Provider info */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--border)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
              {selected.users?.profile_photo
                ? <img src={selected.users.profile_photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : isProduct ? '🌾' : '🚚'}
            </div>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>{selected.users?.full_name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{selected.users?.email}</div>
            </div>
          </div>

          {/* Photos — tappable to open full size */}
          {photos.length > 0 && (
            <>
              <div className="section-label">
                Photos ({photos.length}) — tap to view full size
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {photos.map((url, i) => (
                  <div key={i}
                    onClick={() => setLightbox(url)}
                    style={{
                      width: 100, height: 100, borderRadius: 8,
                      overflow: 'hidden', cursor: 'pointer', flexShrink: 0,
                      border: '0.5px solid var(--border)',
                      position: 'relative'
                    }}
                  >
                    <img src={url} alt={`Photo ${i + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(0,0,0,0)', transition: 'background 0.15s'
                    }}>
                      <span style={{ fontSize: 20, opacity: 0 }}>🔍</span>
                    </div>
                    <div style={{ position: 'absolute', bottom: 3, right: 3, background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 9, padding: '1px 4px', borderRadius: 3 }}>
                      {i + 1}/{photos.length}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Product details */}
          {isProduct && (
            <>
              <div className="section-label">Product details</div>
              <div className="card" style={{ marginBottom: 14 }}>
                <div className="card-body" style={{ padding: '0 14px' }}>
                  {[
                    { label: 'Name', value: selected.name },
                    { label: 'Category', value: selected.category },
                    { label: 'Price', value: `₦${Number(selected.price_per_unit).toLocaleString()} per ${selected.unit}` },
                    { label: 'Quantity', value: `${selected.quantity_available} ${selected.unit}s available` },
                    { label: 'Min order', value: `${selected.min_order_quantity || 1} ${selected.unit}` },
                    { label: 'Location', value: [selected.lga, selected.state].filter(Boolean).join(', ') || 'Not specified' },
                    { label: 'Harvest date', value: selected.harvest_date ? new Date(selected.harvest_date).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not specified' },
                    { label: 'Photos count', value: `${photos.length} photo${photos.length !== 1 ? 's' : ''} ${photos.length >= 3 ? '✓' : '⚠️ minimum 3 required'}` },
                  ].map((row, i, arr) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < arr.length - 1 ? '0.5px solid var(--border)' : 'none', gap: 10 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>{row.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, textAlign: 'right' }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selected.description && (
                <>
                  <div className="section-label">Description</div>
                  <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-2)', marginBottom: 16, background: 'var(--surface-2)', borderRadius: 10, padding: '10px 14px' }}>
                    {selected.description}
                  </div>
                </>
              )}
            </>
          )}

          {/* Service details */}
          {!isProduct && (
            <>
              <div className="section-label">Service details</div>
              <div className="card" style={{ marginBottom: 14 }}>
                <div className="card-body" style={{ padding: '0 14px' }}>
                  {[
                    { label: 'Service name', value: selected.name },
                    { label: 'Vehicle type', value: selected.vehicle_type?.replace(/_/g, ' ') },
                    { label: 'Service type', value: selected.service_type?.replace(/_/g, ' ') || 'Not specified' },
                    { label: 'Base price', value: `₦${Number(selected.base_price).toLocaleString()}` },
                    { label: 'Price per km', value: selected.price_per_km ? `₦${Number(selected.price_per_km).toLocaleString()}` : 'Not specified' },
                    { label: 'Capacity', value: selected.capacity_tons ? `${selected.capacity_tons} tonnes` : 'Not specified' },
                    { label: 'Base state', value: selected.pickup_state || 'Not specified' },
                    { label: 'Coverage states', value: selected.coverage_states?.join(', ') || 'Not specified' },
                    { label: 'Vehicle photos', value: `${photos.length} photo${photos.length !== 1 ? 's' : ''} ${photos.length >= 1 ? '✓' : '⚠️ required'}` },
                  ].map((row, i, arr) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < arr.length - 1 ? '0.5px solid var(--border)' : 'none', gap: 10 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>{row.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, textAlign: 'right', textTransform: 'capitalize' }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selected.description && (
                <>
                  <div className="section-label">Description</div>
                  <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-2)', marginBottom: 16, background: 'var(--surface-2)', borderRadius: 10, padding: '10px 14px' }}>
                    {selected.description}
                  </div>
                </>
              )}
            </>
          )}

          {/* Checklist for admin */}
          <div className="section-label">Admin checklist</div>
          <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
            {(isProduct ? [
              `At least 3 photos uploaded — ${photos.length >= 3 ? '✅' : '❌ only ' + photos.length}`,
              'Photos show actual produce — verify visually above',
              'Price is realistic for the product and quantity',
              'Harvest date is recent and makes sense',
              'Location (state/LGA) is specified',
              'Description is honest and informative',
              'Watermark visible on all photos',
            ] : [
              `At least 1 vehicle photo — ${photos.length >= 1 ? '✅' : '❌ missing'}`,
              'Vehicle photo shows actual vehicle clearly',
              'Vehicle type matches the photo',
              'Base price is realistic for Nigerian market',
              'Coverage states are reasonable',
              'Service description is clear and honest',
              'Watermark visible on vehicle photos',
            ]).map((item, i) => (
              <div key={i} style={{ fontSize: 12, padding: '5px 0', borderBottom: i < 6 ? '0.5px solid var(--border)' : 'none', color: 'var(--text-2)' }}>
                {item}
              </div>
            ))}
          </div>

          {/* Rejection reason if already rejected */}
          {selected.rejection_reason && (
            <div style={{ background: 'var(--red-light)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--red)' }}>
              <strong>Rejection reason:</strong> {selected.rejection_reason}
            </div>
          )}

          {/* Action buttons */}
          {statusTab === 'pending' && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => approveItem(selected.id)}>
                ✓ Approve — go live
              </button>
              <button className="btn" style={{ flex: 1, color: 'var(--red)', borderColor: 'var(--red-light)' }} onClick={() => rejectItem(selected.id)}>
                ✗ Reject
              </button>
            </div>
          )}
          {statusTab === 'approved' && (
            <button className="btn btn-full" style={{ color: 'var(--red)', borderColor: 'var(--red-light)' }} onClick={() => removeFromLive(selected.id)}>
              Remove from live listings
            </button>
          )}
          {statusTab === 'rejected' && (
            <button className="btn btn-primary btn-full" onClick={() => approveItem(selected.id)}>
              Approve now — go live
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── LIST VIEW ─────────────────────────────────────────
  const isProduct = mainTab === 'products'

  return (
    <div className="page">
      <div className="topbar">
        <h1 style={{ fontSize: 16 }}>Admin panel</h1>
      </div>

      {/* Main tabs — Products vs Services */}
      <div style={{ display: 'flex', borderBottom: '0.5px solid var(--border)', background: 'var(--surface)' }}>
        {MAIN_TABS.map(t => (
          <button key={t} onClick={() => setMainTab(t)} style={{
            flex: 1, padding: '11px 0', background: 'none', border: 'none',
            borderBottom: mainTab === t ? '2px solid var(--green)' : '2px solid transparent',
            color: mainTab === t ? 'var(--green)' : 'var(--text-3)',
            fontWeight: mainTab === t ? 600 : 400,
            fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
            textTransform: 'capitalize'
          }}>
            {t === 'products' ? '🌾 Products' : '🚚 Services'}
          </button>
        ))}
      </div>

      {/* Status sub-tabs */}
      <div style={{ display: 'flex', borderBottom: '0.5px solid var(--border)', background: 'var(--surface)' }}>
        {STATUS_TABS.map(t => (
          <button key={t.id} onClick={() => setStatusTab(t.id)} style={{
            flex: 1, padding: '8px 0', background: 'none', border: 'none',
            borderBottom: statusTab === t.id ? '2px solid var(--green)' : '2px solid transparent',
            color: statusTab === t.id ? 'var(--green)' : 'var(--text-3)',
            fontWeight: statusTab === t.id ? 600 : 400,
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
        ) : items.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">{statusTab === 'pending' ? '✅' : statusTab === 'approved' ? '📋' : '🗑️'}</div>
            <h3>Nothing here</h3>
            <p>No {statusTab} {mainTab} right now.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map(item => {
              const photos = item.photos || []
              const firstPhoto = photos[0]
              return (
                <div key={item.id} className="card"
                  onClick={() => setSelected(item)}
                  style={{ cursor: 'pointer', transition: 'border-color 0.15s' }}>
                  <div className="card-body" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>

                    {/* Thumbnail */}
                    <div style={{ width: 72, height: 72, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
                      {firstPhoto
                        ? <img src={firstPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : isProduct ? '📦' : '🚚'}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>{item.name}</div>
                        <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0, marginLeft: 8 }}>
                          {photos.length} photo{photos.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>
                        {item.users?.full_name}
                      </div>
                      {isProduct ? (
                        <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                          ₦{Number(item.price_per_unit).toLocaleString()}/{item.unit} · {item.state || 'Location not set'}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                          ₦{Number(item.base_price).toLocaleString()} · {item.vehicle_type?.replace(/_/g, ' ')} · {item.pickup_state || 'State not set'}
                        </div>
                      )}
                      {item.rejection_reason && (
                        <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>
                          Rejected: {item.rejection_reason}
                        </div>
                      )}
                    </div>

                    {/* Arrow */}
                    <div style={{ color: 'var(--text-3)', fontSize: 16, alignSelf: 'center' }}>→</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
