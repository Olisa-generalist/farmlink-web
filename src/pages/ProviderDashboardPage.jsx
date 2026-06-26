// src/pages/ProviderDashboardPage.jsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import toast from 'react-hot-toast'

export default function ProviderDashboardPage() {
  const { user, profile } = useAuth()
  const [stats, setStats] = useState({ balance: 0, escrow: 0, earned: 0, completed: 0 })
  const [orders, setOrders] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('orders')

  useEffect(() => { if (user) fetchAll() }, [user])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchStats(), fetchOrders(), fetchServices()])
    setLoading(false)
  }

  async function fetchStats() {
    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance, total_earned')
      .eq('user_id', user.id)
      .single()

    const { count: completed } = await supabase
      .from('order_legs')
      .select('*', { count: 'exact', head: true })
      .eq('provider_id', user.id)
      .eq('status', 'completed')

    const { data: escrowLegs } = await supabase
      .from('order_legs')
      .select('leg_amount')
      .eq('provider_id', user.id)
      .in('status', ['paid_held', 'confirmed'])

    const escrow = escrowLegs?.reduce((sum, l) => sum + Number(l.leg_amount), 0) || 0

    setStats({
      balance: wallet?.balance || 0,
      earned: wallet?.total_earned || 0,
      escrow,
      completed: completed || 0,
    })
  }

  async function fetchOrders() {
    const { data } = await supabase
      .from('order_legs')
      .select(`
        id, status, leg_amount, leg_payout, created_at, tracking_info,
        logistics_services ( name, vehicle_type ),
        orders (
          delivery_address, delivery_state,
          pickup_address, pickup_state, buyer_id,
          users!orders_buyer_id_fkey ( full_name )
        )
      `)
      .eq('provider_id', user.id)
      .eq('leg_type', 'logistics')
      .order('created_at', { ascending: false })
      .limit(20)
    setOrders(data || [])
  }

  async function fetchServices() {
    const { data } = await supabase
      .from('logistics_services')
      .select('*')
      .eq('provider_id', user.id)
      .order('created_at', { ascending: false })
    setServices(data || [])
  }

  async function confirmJob(legId) {
    const { error } = await supabase
      .from('order_legs')
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
      .eq('id', legId)
    if (error) { toast.error('Could not confirm job'); return }
    toast.success('Job confirmed! Get ready for pickup.')
    fetchOrders()
  }

  async function startJob(legId) {
    const { error } = await supabase
      .from('order_legs')
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .eq('id', legId)
    if (error) { toast.error('Could not update job'); return }
    toast.success('Job started! Buyer has been notified you are en route.')
    fetchOrders()
  }

  async function toggleService(service) {
    const { error } = await supabase
      .from('logistics_services')
      .update({ is_available: !service.is_available })
      .eq('id', service.id)
    if (error) { toast.error('Could not update service'); return }
    setServices(prev => prev.map(s =>
      s.id === service.id ? { ...s, is_available: !s.is_available } : s
    ))
    toast.success(service.is_available ? 'Service hidden from buyers' : 'Service now visible to buyers')
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'Provider'

  const STATUS_LABEL = {
    pending:     { label: 'Awaiting payment', cls: 'badge-gray' },
    paid_held:   { label: 'Paid — confirm job', cls: 'badge-amber' },
    confirmed:   { label: 'Confirmed', cls: 'badge-green' },
    in_progress: { label: 'En route', cls: 'badge-green' },
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
        <Link to="/add-service" className="btn btn-primary btn-sm">+ Add service</Link>
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
            <div className="stat-label">Jobs completed</div>
            <div className="stat-value">{stats.completed}</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', marginTop: 20, borderBottom: '0.5px solid var(--border)' }}>
          {['orders', 'services'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '10px 0', background: 'none', border: 'none',
              borderBottom: tab === t ? '2px solid var(--green)' : '2px solid transparent',
              color: tab === t ? 'var(--green)' : 'var(--text-3)',
              fontWeight: tab === t ? 600 : 400,
              fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
              textTransform: 'capitalize'
            }}>
              {t === 'orders' ? `Jobs (${orders.length})` : `My services (${services.length})`}
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
              <div className="empty-icon">🚚</div>
              <h3>No jobs yet</h3>
              <p>Delivery jobs from buyers will appear here once you list your services.</p>
              <Link to="/add-service" className="btn btn-primary" style={{ marginTop: 8 }}>
                List your first service
              </Link>
            </div>
          ) : (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {orders.map(leg => {
                const status = STATUS_LABEL[leg.status] || { label: leg.status, cls: 'badge-gray' }
                const buyer = leg.orders?.users
                return (
                  <div key={leg.id} className="card">
                    <div className="card-body">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 14 }}>
                            {leg.logistics_services?.name || 'Delivery job'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                            {leg.logistics_services?.vehicle_type} · Booked by {buyer?.full_name || 'Unknown'}
                          </div>
                        </div>
                        <span className={`badge ${status.cls}`}>{status.label}</span>
                      </div>

                      {/* Route */}
                      <div style={{
                        background: 'var(--surface-2)', borderRadius: 8,
                        padding: '8px 10px', marginBottom: 10, fontSize: 12
                      }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 4 }}>
                          <span style={{ color: 'var(--green)', fontWeight: 600, flexShrink: 0 }}>FROM</span>
                          <span style={{ color: 'var(--text-2)' }}>
                            {leg.orders?.pickup_address || leg.orders?.pickup_state || 'Pickup not specified'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <span style={{ color: 'var(--amber)', fontWeight: 600, flexShrink: 0 }}>TO</span>
                          <span style={{ color: 'var(--text-2)' }}>
                            {leg.orders?.delivery_address || leg.orders?.delivery_state || 'Delivery not specified'}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10 }}>
                        <span style={{ color: 'var(--text-3)' }}>
                          {new Date(leg.created_at).toLocaleDateString('en-NG')}
                        </span>
                        <span style={{ fontWeight: 600, color: 'var(--green)' }}>
                          ₦{Number(leg.leg_payout).toLocaleString()} payout
                        </span>
                      </div>

                      {leg.status === 'paid_held' && (
                        <button className="btn btn-primary btn-full btn-sm"
                          onClick={() => confirmJob(leg.id)}>
                          Accept this job
                        </button>
                      )}
                      {leg.status === 'confirmed' && (
                        <button className="btn btn-primary btn-full btn-sm"
                          onClick={() => startJob(leg.id)}>
                          Start job — mark as en route
                        </button>
                      )}
                      {leg.status === 'in_progress' && (
                        <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: '6px 0' }}>
                          En route — waiting for buyer to confirm delivery
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
          /* Services tab */
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {services.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">🚛</div>
                <h3>No services listed</h3>
                <p>List your trucks and delivery routes so buyers and farmers can hire you.</p>
                <Link to="/add-service" className="btn btn-primary" style={{ marginTop: 8 }}>
                  Add your first service
                </Link>
              </div>
            ) : (
              <>
                {services.map(s => (
                  <div key={s.id} className="card">
                    <div className="card-body" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 8, flexShrink: 0,
                        background: 'var(--surface-2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22
                      }}>
                        🚚
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>{s.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                          {s.vehicle_type} · ₦{Number(s.base_price).toLocaleString()} base price
                        </div>
                      </div>
                      <div
                        onClick={() => toggleService(s)}
                        title={s.is_available ? 'Hide service' : 'Show service'}
                        style={{
                          width: 36, height: 20, borderRadius: 10, flexShrink: 0,
                          background: s.is_available ? 'var(--green)' : 'var(--border-2)',
                          position: 'relative', cursor: 'pointer', transition: 'background 0.2s'
                        }}
                      >
                        <div style={{
                          position: 'absolute', width: 16, height: 16,
                          background: '#fff', borderRadius: '50%', top: 2,
                          transition: 'left 0.2s',
                          left: s.is_available ? 18 : 2
                        }} />
                      </div>
                    </div>
                  </div>
                ))}
                <Link to="/add-service" className="btn btn-full" style={{ marginTop: 4, textAlign: 'center' }}>
                  + Add another service
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
