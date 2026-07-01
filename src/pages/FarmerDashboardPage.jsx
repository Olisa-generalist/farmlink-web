// src/pages/FarmerDashboardPage.jsx
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import toast from 'react-hot-toast'
import { notifyBuyerOfLegUpdate } from '../lib/notifications'

export default function FarmerDashboardPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ earned: 0, escrow: 0, completed: 0, products: 0 })
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('orders')
  const [editingProduct, setEditingProduct] = useState(null)

  useEffect(() => { if (user) fetchAll() }, [user])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchStats(), fetchOrders(), fetchProducts()])
    setLoading(false)
  }

  async function fetchStats() {
    const { data: wallet } = await supabase
      .from('wallets').select('balance, total_earned').eq('user_id', user.id).single()
    const { count: completed } = await supabase
      .from('order_legs').select('*', { count: 'exact', head: true })
      .eq('provider_id', user.id).eq('status', 'completed')
    const { data: escrowLegs } = await supabase
      .from('order_legs').select('leg_amount').eq('provider_id', user.id).eq('status', 'paid_held')
    const escrow = escrowLegs?.reduce((sum, l) => sum + Number(l.leg_amount), 0) || 0
    setStats({ earned: wallet?.total_earned || 0, balance: wallet?.balance || 0, escrow, completed: completed || 0 })
  }

  async function fetchOrders() {
    // Split into separate non-nested queries — nested joins through
    // multiple foreign keys can silently fail. See ProviderDashboardPage
    // for the same pattern.
    const { data: rawLegs, error: legsError } = await supabase
      .from('order_legs')
      .select('*')
      .eq('provider_id', user.id)
      .eq('leg_type', 'product')
      .order('created_at', { ascending: false })
      .limit(20)

    if (legsError) {
      console.error('Fetch orders error:', legsError)
      setOrders([])
      return
    }
    if (!rawLegs || rawLegs.length === 0) { setOrders([]); return }

    const productIds = [...new Set(rawLegs.map(l => l.product_id).filter(Boolean))]
    const { data: products } = productIds.length
      ? await supabase.from('products').select('id, name, unit, photos').in('id', productIds)
      : { data: [] }

    const orderIds = [...new Set(rawLegs.map(l => l.order_id).filter(Boolean))]
    const { data: ordersData } = orderIds.length
      ? await supabase.from('orders').select('id, delivery_address, delivery_state, buyer_id').in('id', orderIds)
      : { data: [] }

    const buyerIds = [...new Set((ordersData || []).map(o => o.buyer_id).filter(Boolean))]
    const { data: buyers } = buyerIds.length
      ? await supabase.from('users').select('id, full_name').in('id', buyerIds)
      : { data: [] }

    const enriched = rawLegs.map(leg => {
      const product = products?.find(p => p.id === leg.product_id)
      const orderRow = ordersData?.find(o => o.id === leg.order_id)
      const buyer = buyers?.find(b => b.id === orderRow?.buyer_id)
      return {
        ...leg,
        products: product || null,
        orders: orderRow ? { ...orderRow, users: buyer || null } : null,
      }
    })

    setOrders(enriched)
  }

  async function fetchProducts() {
    const { data } = await supabase
      .from('products')
      .select('id, name, price_per_unit, unit, quantity_available, is_available, is_verified, admin_rejected, rejection_reason, photos, category, description, state, lga, harvest_date, min_order_quantity')
      .eq('farmer_id', user.id)
      .order('created_at', { ascending: false })
    setProducts(data || [])
  }

  async function toggleAvailability(product) {
    // Only allow toggling if product is approved
    if (!product.is_verified) {
      toast.error('Product must be approved by admin before you can toggle availability')
      return
    }
    const { error } = await supabase
      .from('products').update({ is_available: !product.is_available }).eq('id', product.id)
    if (error) { toast.error('Could not update product'); return }
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_available: !p.is_available } : p))
    toast.success(product.is_available ? 'Product hidden from buyers' : 'Product now visible to buyers')
  }

  async function dispatchOrder(legId) {
    const leg = orders.find(o => o.id === legId)
    const { error } = await supabase
      .from('order_legs').update({ status: 'in_progress', started_at: new Date().toISOString() }).eq('id', legId)
    if (error) { toast.error('Could not update order'); return }

    // Get order_id for this leg to notify buyer
    const { data: legData } = await supabase.from('order_legs').select('order_id').eq('id', legId).single()
    if (legData) await notifyBuyerOfLegUpdate(legData.order_id, 'product', 'in_progress')

    toast.success('Order marked as dispatched! Buyer has been notified.')
    fetchOrders()
  }

  async function confirmOrder(legId) {
    const { error } = await supabase
      .from('order_legs').update({ status: 'confirmed', confirmed_at: new Date().toISOString() }).eq('id', legId)
    if (error) { toast.error('Could not confirm order'); return }

    const { data: legData } = await supabase.from('order_legs').select('order_id').eq('id', legId).single()
    if (legData) await notifyBuyerOfLegUpdate(legData.order_id, 'product', 'confirmed')

    toast.success('Order confirmed!')
    fetchOrders()
  }

  // Resubmit a rejected product for admin review
  async function resubmitProduct(productId) {
    const { error } = await supabase
      .from('products')
      .update({ admin_rejected: false, rejection_reason: null, is_available: false, is_verified: false })
      .eq('id', productId)
    if (error) { toast.error('Could not resubmit'); return }
    toast.success('Product resubmitted for admin review!')
    setEditingProduct(null)
    fetchProducts()
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'Farmer'

  const STATUS_LABEL = {
    pending:     { label: 'Pending payment', cls: 'badge-gray' },
    paid_held:   { label: 'Paid — confirm it', cls: 'badge-amber' },
    confirmed:   { label: 'Confirmed', cls: 'badge-green' },
    in_progress: { label: 'Dispatched', cls: 'badge-green' },
    completed:   { label: 'Completed', cls: 'badge-green' },
    disputed:    { label: 'Disputed', cls: 'badge-red' },
    refunded:    { label: 'Refunded', cls: 'badge-red' },
  }

  // Product status helper
  function getProductStatus(p) {
    if (p.admin_rejected) return { label: 'Rejected', cls: 'badge-red', icon: '❌' }
    if (p.is_verified && p.is_available) return { label: 'Live', cls: 'badge-green', icon: '✅' }
    if (p.is_verified && !p.is_available) return { label: 'Hidden', cls: 'badge-gray', icon: '👁️' }
    return { label: 'Pending review', cls: 'badge-amber', icon: '⏳' }
  }

  // Edit product modal (for rejected products)
  if (editingProduct) {
    return (
      <div className="page">
        <div className="topbar">
          <button onClick={() => setEditingProduct(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-2)', padding: '0 8px 0 0' }}>←</button>
          <h1 style={{ fontSize: 15 }}>Fix &amp; resubmit</h1>
        </div>
        <div className="page-content" style={{ paddingTop: 16 }}>

          {/* Show rejection reason clearly */}
          <div style={{ background: 'var(--red-light)', borderRadius: 10, padding: '12px 14px', marginBottom: 20, border: '0.5px solid var(--red)' }}>
            <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--red)', marginBottom: 4 }}>
              ❌ Rejected by Naagora admin
            </div>
            <div style={{ fontSize: 13, color: 'var(--red)', lineHeight: 1.6 }}>
              <strong>Reason:</strong> {editingProduct.rejection_reason}
            </div>
          </div>

          <div style={{ background: '#E6F1FB', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#0C447C', lineHeight: 1.6 }}>
            ℹ️ Fix the issue described above, then tap "Resubmit for review". Our admin team will review it again within 24 hours.
          </div>

          {/* Quick edit fields */}
          <div className="section-label">Update your listing</div>

          <div className="input-group">
            <label>Product name</label>
            <input value={editingProduct.name}
              onChange={e => setEditingProduct(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="input-group">
            <label>Price per {editingProduct.unit} (₦)</label>
            <input type="number" value={editingProduct.price_per_unit}
              onChange={e => setEditingProduct(p => ({ ...p, price_per_unit: e.target.value }))} />
          </div>
          <div className="input-group">
            <label>Quantity available</label>
            <input type="number" value={editingProduct.quantity_available}
              onChange={e => setEditingProduct(p => ({ ...p, quantity_available: e.target.value }))} />
          </div>
          <div className="input-group">
            <label>Description</label>
            <textarea value={editingProduct.description || ''}
              onChange={e => setEditingProduct(p => ({ ...p, description: e.target.value }))}
              rows={3} placeholder="Describe your produce honestly..." />
          </div>
          <div className="input-group">
            <label>Harvest date</label>
            <input type="date" value={editingProduct.harvest_date || ''}
              onChange={e => setEditingProduct(p => ({ ...p, harvest_date: e.target.value }))} />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={async () => {
              // Save edits first
              const { error } = await supabase.from('products').update({
                name: editingProduct.name,
                price_per_unit: Number(editingProduct.price_per_unit),
                quantity_available: Number(editingProduct.quantity_available),
                description: editingProduct.description,
                harvest_date: editingProduct.harvest_date || null,
              }).eq('id', editingProduct.id)
              if (error) { toast.error('Could not save changes'); return }
              await resubmitProduct(editingProduct.id)
            }}>
              Save &amp; resubmit for review
            </button>
            <button className="btn" onClick={() => setEditingProduct(null)}>Cancel</button>
          </div>

          <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 10, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6 }}>
            💡 If the issue is with your photos, go back and delete this product, then create a new listing with better photos. Photos cannot be replaced after submission.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <div className="topbar-logo">Naagora</div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>Welcome, {firstName}</p>
        </div>
        <Link to="/add-product" className="btn btn-primary btn-sm">+ Add product</Link>
      </div>

      <div className="page-content">
        {/* Stats */}
        <div style={{ marginTop: 16 }} className="stat-grid">
          <div className="stat-card" onClick={() => navigate('/wallet')} style={{ cursor: 'pointer' }}><div className="stat-label">Wallet balance →</div><div className="stat-value green">₦{Number(stats.balance).toLocaleString()}</div></div>
          <div className="stat-card"><div className="stat-label">In escrow</div><div className="stat-value">₦{Number(stats.escrow).toLocaleString()}</div></div>
          <div className="stat-card"><div className="stat-label">Total earned</div><div className="stat-value">₦{Number(stats.earned).toLocaleString()}</div></div>
          <div className="stat-card"><div className="stat-label">Orders completed</div><div className="stat-value">{stats.completed}</div></div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', marginTop: 20, borderBottom: '0.5px solid var(--border)' }}>
          {['orders', 'products'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '10px 0', background: 'none', border: 'none',
              borderBottom: tab === t ? '2px solid var(--green)' : '2px solid transparent',
              color: tab === t ? 'var(--green)' : 'var(--text-3)',
              fontWeight: tab === t ? 600 : 400,
              fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize'
            }}>
              {t === 'orders' ? `Orders (${orders.length})` : `Products (${products.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div className="spinner" />
          </div>
        ) : tab === 'orders' ? (
          orders.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">📦</div>
              <h3>No orders yet</h3>
              <p>Orders from buyers will appear here once your products are approved and listed.</p>
            </div>
          ) : (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {orders.map(leg => {
                const status = STATUS_LABEL[leg.status] || { label: leg.status, cls: 'badge-gray' }
                return (
                  <div key={leg.id} className="card" onClick={() => navigate(`/orders/${leg.order_id}`)} style={{ cursor: 'pointer' }}>
                    <div className="card-body">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 14 }}>{leg.products?.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                            {leg.quantity} {leg.products?.unit} · Buyer: {leg.orders?.users?.full_name || 'Unknown'}
                          </div>
                        </div>
                        <span className={`badge ${status.cls}`}>{status.label}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10 }}>
                        <span style={{ color: 'var(--text-3)' }}>{leg.orders?.delivery_state || 'Delivery not set'}</span>
                        <span style={{ fontWeight: 600, color: 'var(--green)' }}>₦{Number(leg.leg_payout).toLocaleString()}</span>
                      </div>
                      {leg.status === 'paid_held' && (
                        <button className="btn btn-primary btn-full btn-sm" onClick={(e) => { e.stopPropagation(); confirmOrder(leg.id) }}>
                          Confirm this order
                        </button>
                      )}
                      {leg.status === 'confirmed' && (
                        <button className="btn btn-primary btn-full btn-sm" onClick={(e) => { e.stopPropagation(); dispatchOrder(leg.id) }}>
                          Mark as dispatched
                        </button>
                      )}
                      {leg.status === 'in_progress' && (
                        <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: '6px 0' }}>
                          Waiting for buyer to confirm delivery
                        </div>
                      )}
                      {leg.status === 'completed' && (
                        <div style={{ fontSize: 12, color: 'var(--green)', textAlign: 'center', padding: '6px 0' }}>
                          ✓ ₦{Number(leg.leg_payout).toLocaleString()} released to your wallet
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : (
          /* Products tab */
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {products.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">🌾</div>
                <h3>No products yet</h3>
                <p>Tap "Add product" to list your first item for buyers to see.</p>
                <Link to="/add-product" className="btn btn-primary" style={{ marginTop: 8 }}>
                  Add your first product
                </Link>
              </div>
            ) : (
              <>
                {products.map(p => {
                  const pStatus = getProductStatus(p)
                  return (
                    <div key={p.id} className="card">
                      <div className="card-body">
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          <div style={{ width: 52, height: 52, borderRadius: 8, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0, overflow: 'hidden' }}>
                            {p.photos?.[0]
                              ? <img src={p.photos[0]} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : '📦'}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                              <div style={{ fontWeight: 500, fontSize: 14 }}>{p.name}</div>
                              <span className={`badge ${pStatus.cls}`} style={{ marginLeft: 8, flexShrink: 0 }}>
                                {pStatus.icon} {pStatus.label}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                              ₦{Number(p.price_per_unit).toLocaleString()}/{p.unit} · {p.quantity_available} available
                            </div>
                          </div>

                          {/* Toggle — only for approved products */}
                          {p.is_verified && (
                            <div onClick={() => toggleAvailability(p)} title={p.is_available ? 'Hide from buyers' : 'Show to buyers'}
                              style={{ width: 36, height: 20, borderRadius: 10, flexShrink: 0, background: p.is_available ? 'var(--green)' : 'var(--border-2)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', marginTop: 4 }}>
                              <div style={{ position: 'absolute', width: 16, height: 16, background: '#fff', borderRadius: '50%', top: 2, transition: 'left 0.2s', left: p.is_available ? 18 : 2 }} />
                            </div>
                          )}
                        </div>

                        {/* Rejection feedback — clearly visible */}
                        {p.admin_rejected && (
                          <div style={{ marginTop: 10, background: 'var(--red-light)', borderRadius: 8, padding: '10px 12px', border: '0.5px solid var(--red)' }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--red)', marginBottom: 4 }}>
                              ❌ Rejected by Naagora admin
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10, lineHeight: 1.5 }}>
                              <strong>Reason:</strong> {p.rejection_reason || 'No reason provided'}
                            </div>
                            <button
                              className="btn btn-sm"
                              style={{ width: '100%', color: 'var(--green)', borderColor: 'var(--green)' }}
                              onClick={() => setEditingProduct(p)}
                            >
                              Fix issue &amp; resubmit for review →
                            </button>
                          </div>
                        )}

                        {/* Pending notice */}
                        {!p.is_verified && !p.admin_rejected && (
                          <div style={{ marginTop: 10, background: 'var(--amber-light)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--amber)' }}>
                            ⏳ Under review — Naagora admin will approve or reject within 24 hours
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                <Link to="/add-product" className="btn btn-full" style={{ marginTop: 4, textAlign: 'center' }}>
                  + Add another product
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
