// src/pages/FarmerDashboardPage.jsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import toast from 'react-hot-toast'

export default function FarmerDashboardPage() {
  const { user, profile } = useAuth()
  const [stats, setStats] = useState({ earned: 0, escrow: 0, completed: 0, products: 0 })
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('orders') // 'orders' | 'products'

  useEffect(() => { if (user) fetchAll() }, [user])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchStats(), fetchOrders(), fetchProducts()])
    setLoading(false)
  }

  async function fetchStats() {
    // Wallet balance
    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance, total_earned')
      .eq('user_id', user.id)
      .single()

    // Count completed orders
    const { count: completed } = await supabase
      .from('order_legs')
      .select('*', { count: 'exact', head: true })
      .eq('provider_id', user.id)
      .eq('status', 'completed')

    // Count products
    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('farmer_id', user.id)

    // Sum of escrow (paid_held legs)
    const { data: escrowLegs } = await supabase
      .from('order_legs')
      .select('leg_amount')
      .eq('provider_id', user.id)
      .eq('status', 'paid_held')

    const escrow = escrowLegs?.reduce((sum, l) => sum + Number(l.leg_amount), 0) || 0

    setStats({
      earned: wallet?.total_earned || 0,
      balance: wallet?.balance || 0,
      escrow,
      completed: completed || 0,
      products: productCount || 0,
    })
  }

  async function fetchOrders() {
    const { data } = await supabase
      .from('order_legs')
      .select(`
        id, status, leg_amount, leg_payout, quantity, created_at,
        products ( name, unit, photos ),
        orders ( delivery_address, delivery_state, buyer_id,
          users!orders_buyer_id_fkey ( full_name )
        )
      `)
      .eq('provider_id', user.id)
      .eq('leg_type', 'product')
      .order('created_at', { ascending: false })
      .limit(20)
    setOrders(data || [])
  }

  async function fetchProducts() {
    const { data } = await supabase
      .from('products')
      .select('id, name, price_per_unit, unit, quantity_available, is_available, photos, category')
      .eq('farmer_id', user.id)
      .order('created_at', { ascending: false })
    setProducts(data || [])
  }

  async function toggleAvailability(product) {
    const { error } = await supabase
      .from('products')
      .update({ is_available: !product.is_available })
      .eq('id', product.id)
    if (error) { toast.error('Could not update product'); return }
    setProducts(prev => prev.map(p =>
      p.id === product.id ? { ...p, is_available: !p.is_available } : p
    ))
    toast.success(product.is_available ? 'Product hidden from buyers' : 'Product now visible to buyers')
  }

  async function dispatchOrder(legId) {
    const { error } = await supabase
      .from('order_legs')
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .eq('id', legId)
    if (error) { toast.error('Could not update order'); return }
    toast.success('Order marked as dispatched! Buyer has been notified.')
    fetchOrders()
  }

  async function confirmOrder(legId) {
    const { error } = await supabase
      .from('order_legs')
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
      .eq('id', legId)
    if (error) { toast.error('Could not confirm order'); return }
    toast.success('Order confirmed!')
    fetchOrders()
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

  return (
    <div className="page">
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <div className="topbar-logo">Naagora</div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>
            Welcome, {firstName}
          </p>
        </div>
        <Link to="/add-product" className="btn btn-primary btn-sm">+ Add product</Link>
      </div>

      <div className="page-content">

        {/* Stats */}
        <div style={{ marginTop: 16 }} className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">Wallet balance</div>
            <div className="stat-value green">₦{Number(stats.balance).toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">In escrow</div>
            <div className="stat-value">₦{Number(stats.escrow).toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total earned</div>
            <div className="stat-value">₦{Number(stats.earned).toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Orders completed</div>
            <div className="stat-value">{stats.completed}</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginTop: 20, borderBottom: '0.5px solid var(--border)' }}>
          {['orders', 'products'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '10px 0', background: 'none', border: 'none',
                borderBottom: tab === t ? '2px solid var(--green)' : '2px solid transparent',
                color: tab === t ? 'var(--green)' : 'var(--text-3)',
                fontWeight: tab === t ? 600 : 400,
                fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
                textTransform: 'capitalize'
              }}
            >
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
              <p>Orders from buyers will appear here once your products are listed.</p>
            </div>
          ) : (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {orders.map(leg => {
                const status = STATUS_LABEL[leg.status] || { label: leg.status, cls: 'badge-gray' }
                const product = leg.products
                const buyer = leg.orders?.users
                return (
                  <div key={leg.id} className="card">
                    <div className="card-body">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 14 }}>{product?.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                            {leg.quantity} {product?.unit} · Buyer: {buyer?.full_name || 'Unknown'}
                          </div>
                        </div>
                        <span className={`badge ${status.cls}`}>{status.label}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10 }}>
                        <span style={{ color: 'var(--text-3)' }}>
                          {leg.orders?.delivery_state || 'Delivery address not set'}
                        </span>
                        <span style={{ fontWeight: 600, color: 'var(--green)' }}>
                          ₦{Number(leg.leg_payout).toLocaleString()}
                        </span>
                      </div>

                      {/* Action buttons based on status */}
                      {leg.status === 'paid_held' && (
                        <button className="btn btn-primary btn-full btn-sm"
                          onClick={() => confirmOrder(leg.id)}>
                          Confirm this order
                        </button>
                      )}
                      {leg.status === 'confirmed' && (
                        <button className="btn btn-primary btn-full btn-sm"
                          onClick={() => dispatchOrder(leg.id)}>
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
                          ✓ Payment of ₦{Number(leg.leg_payout).toLocaleString()} released to your wallet
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
                {products.map(p => (
                  <div key={p.id} className="card">
                    <div className="card-body" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: 8,
                        background: 'var(--surface-2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 24, flexShrink: 0, overflow: 'hidden'
                      }}>
                        {p.photos?.[0]
                          ? <img src={p.photos[0]} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : '📦'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                          ₦{Number(p.price_per_unit).toLocaleString()}/{p.unit} · {p.quantity_available} available
                        </div>
                      </div>
                      {/* Toggle availability switch */}
                      <div
                        onClick={() => toggleAvailability(p)}
                        title={p.is_available ? 'Hide from buyers' : 'Show to buyers'}
                        style={{
                          width: 36, height: 20, borderRadius: 10, flexShrink: 0,
                          background: p.is_available ? 'var(--green)' : 'var(--border-2)',
                          position: 'relative', cursor: 'pointer', transition: 'background 0.2s'
                        }}
                      >
                        <div style={{
                          position: 'absolute', width: 16, height: 16,
                          background: '#fff', borderRadius: '50%',
                          top: 2, transition: 'left 0.2s',
                          left: p.is_available ? 18 : 2
                        }} />
                      </div>
                    </div>
                  </div>
                ))}
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
