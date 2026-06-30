// src/pages/PublicProfilePage.jsx
// ─────────────────────────────────────────────
// Public-facing trust profile — viewable by anyone.
// Shows: name, photo, role badge, verification, rating,
// reviews, time on Naagora, and their other listings.
//
// NEVER shows: phone number, address, email — those stay
// private per Naagora's contact visibility rules, only
// revealed contextually inside an active order.
// ─────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const ROLE_INFO = {
  farmer:   { icon: '🌾', label: 'Farmer', bg: '#E1F5EE', color: '#085041' },
  provider: { icon: '🚚', label: 'Logistics Provider', bg: '#FAEEDA', color: '#633806' },
  buyer:    { icon: '🛒', label: 'Buyer', bg: '#E6F1FB', color: '#0C447C' },
}

export default function PublicProfilePage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [person, setPerson] = useState(null)
  const [reviews, setReviews] = useState([])
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchProfile() }, [userId])

  async function fetchProfile() {
    setLoading(true)

    const { data: userData } = await supabase
      .from('users')
      .select('id, full_name, role, profile_photo, bio, rating, total_reviews, is_verified, created_at')
      .eq('id', userId)
      .single()

    setPerson(userData)

    if (userData) {
      // Fetch their reviews (as reviewee)
      const { data: reviewData } = await supabase
        .from('reviews')
        .select('rating, comment, created_at, reviewer_id')
        .eq('reviewee_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)

      // Get reviewer names separately
      if (reviewData?.length) {
        const reviewerIds = [...new Set(reviewData.map(r => r.reviewer_id))]
        const { data: reviewers } = await supabase
          .from('users').select('id, full_name').in('id', reviewerIds)
        const enrichedReviews = reviewData.map(r => ({
          ...r,
          reviewerName: reviewers?.find(u => u.id === r.reviewer_id)?.full_name || 'Naagora user'
        }))
        setReviews(enrichedReviews)
      }

      // Fetch their other listings (products if farmer, services if provider)
      if (userData.role === 'farmer') {
        const { data: products } = await supabase
          .from('products')
          .select('id, name, price_per_unit, unit, photos, quantity_available')
          .eq('farmer_id', userId)
          .eq('is_available', true)
          .eq('is_verified', true)
          .limit(6)
        setListings((products || []).map(p => ({ ...p, type: 'product' })))
      } else if (userData.role === 'provider') {
        const { data: services } = await supabase
          .from('logistics_services')
          .select('id, name, base_price, vehicle_type, photos')
          .eq('provider_id', userId)
          .eq('is_available', true)
          .eq('is_verified', true)
          .limit(6)
        setListings((services || []).map(s => ({ ...s, type: 'service' })))
      }
    }

    setLoading(false)
  }

  function timeOnPlatform(dateStr) {
    if (!dateStr) return 'New member'
    const months = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24 * 30))
    if (months < 1) return 'Joined this month'
    if (months === 1) return '1 month on Naagora'
    if (months < 12) return `${months} months on Naagora`
    const years = Math.floor(months / 12)
    return `${years} year${years > 1 ? 's' : ''} on Naagora`
  }

  if (loading) return (
    <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  )

  if (!person) return (
    <div className="page"><div className="page-content"><div className="empty"><h3>Profile not found</h3></div></div></div>
  )

  const roleInfo = ROLE_INFO[person.role] || ROLE_INFO.buyer

  return (
    <div className="page">
      <div className="topbar">
        <button onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-2)', padding: '0 8px 0 0' }}>←</button>
        <h1 style={{ fontSize: 15 }}>Profile</h1>
      </div>

      <div className="page-content" style={{ paddingTop: 20 }}>

        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <div style={{
            width: 84, height: 84, borderRadius: '50%', overflow: 'hidden',
            background: roleInfo.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36, marginBottom: 12, border: '2px solid var(--surface)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            {person.profile_photo
              ? <img src={person.profile_photo} alt={person.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : roleInfo.icon}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <div style={{ fontWeight: 600, fontSize: 18 }}>{person.full_name}</div>
            {person.is_verified && <span title="Verified by Naagora" style={{ color: '#185FA5', fontSize: 16 }}>✓</span>}
          </div>

          <span style={{ background: roleInfo.bg, color: roleInfo.color, fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 20, marginBottom: 8 }}>
            {roleInfo.icon} {roleInfo.label}
          </span>

          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{timeOnPlatform(person.created_at)}</div>
        </div>

        {/* Trust stats */}
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Rating</div>
            <div className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {person.rating > 0 ? `${person.rating} ⭐` : 'No ratings yet'}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Reviews</div>
            <div className="stat-value">{person.total_reviews || 0}</div>
          </div>
        </div>

        {/* Verification notice */}
        <div style={{
          background: person.is_verified ? 'var(--green-light)' : 'var(--surface-2)',
          borderRadius: 10, padding: '10px 14px', marginBottom: 20,
          fontSize: 12, color: person.is_verified ? 'var(--green-dark)' : 'var(--text-3)',
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          {person.is_verified ? '✅' : 'ℹ️'}
          {person.is_verified
            ? 'This account has been verified by Naagora admin.'
            : 'This account has not yet been verified by Naagora.'}
        </div>

        {/* Bio */}
        {person.bio && (
          <>
            <div className="section-label">About</div>
            <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>{person.bio}</p>
          </>
        )}

        {/* Their listings */}
        {listings.length > 0 && (
          <>
            <div className="section-label">
              {person.role === 'farmer' ? 'Products from this farmer' : 'Services from this provider'}
            </div>
            <div className="product-grid" style={{ marginBottom: 20 }}>
              {listings.map(item => (
                item.type === 'product' ? (
                  <Link key={item.id} to={`/product/${item.id}`} className="product-card">
                    <div className="product-card-img">
                      {item.photos?.[0]
                        ? <img src={item.photos[0]} alt={item.name} />
                        : '📦'}
                    </div>
                    <div className="product-card-body">
                      <div className="product-card-name">{item.name}</div>
                      <div className="product-card-footer">
                        <div className="product-card-price">₦{Number(item.price_per_unit).toLocaleString()}</div>
                        <span className="badge badge-green">{Math.floor(item.quantity_available)} left</span>
                      </div>
                    </div>
                  </Link>
                ) : (
                  <div key={item.id} className="product-card">
                    <div className="product-card-img">
                      {item.photos?.[0]
                        ? <img src={item.photos[0]} alt={item.name} />
                        : '🚚'}
                    </div>
                    <div className="product-card-body">
                      <div className="product-card-name">{item.name}</div>
                      <div className="product-card-farmer">{item.vehicle_type?.replace(/_/g, ' ')}</div>
                      <div className="product-card-price">₦{Number(item.base_price).toLocaleString()}</div>
                    </div>
                  </div>
                )
              ))}
            </div>
          </>
        )}

        {/* Reviews */}
        <div className="section-label">Reviews ({reviews.length})</div>
        {reviews.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>No reviews yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {reviews.map((r, i) => (
              <div key={i} className="card">
                <div className="card-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{r.reviewerName}</div>
                    <div style={{ color: '#BA7517', fontSize: 13 }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</div>
                  </div>
                  {r.comment && <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{r.comment}</p>}
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
                    {new Date(r.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
