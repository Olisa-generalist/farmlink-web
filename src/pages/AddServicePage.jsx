// src/pages/AddServicePage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import toast from 'react-hot-toast'

const VEHICLE_TYPES = [
  { id: 'motorcycle',      label: '🏍️ Motorcycle / Okada' },
  { id: 'pickup',          label: '🛻 Pickup truck' },
  { id: 'minivan',         label: '🚐 Minivan' },
  { id: 'truck_5t',        label: '🚛 Truck (5 tonnes)' },
  { id: 'truck_10t',       label: '🚛 Truck (10 tonnes)' },
  { id: 'truck_20t',       label: '🚛 Truck (20 tonnes)' },
  { id: 'refrigerated',    label: '❄️ Refrigerated van' },
  { id: 'flatbed',         label: '🚚 Flatbed truck' },
]

const SERVICE_TYPES = [
  { id: 'haulage',         label: 'Long-distance haulage' },
  { id: 'last_mile',       label: 'Last-mile delivery' },
  { id: 'cold_chain',      label: 'Cold chain / perishables' },
  { id: 'farm_pickup',     label: 'Farm pickup' },
  { id: 'market_delivery', label: 'Market delivery' },
]

const STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo',
  'Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa',
  'Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba',
  'Yobe','Zamfara'
]

export default function AddServicePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [selectedCoverageStates, setSelectedCoverageStates] = useState([])
  const [form, setForm] = useState({
    name: '',
    description: '',
    vehicle_type: '',
    service_type: '',
    capacity_tons: '',
    base_price: '',
    price_per_km: '',
    base_state: '',
  })

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  function toggleCoverageState(state) {
    setSelectedCoverageStates(prev =>
      prev.includes(state) ? prev.filter(s => s !== state) : [...prev, state]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name || !form.vehicle_type || !form.base_price || !form.base_state) {
      toast.error('Please fill in all required fields')
      return
    }
    setLoading(true)

    const { error } = await supabase.from('logistics_services').insert({
      provider_id: user.id,
      name: form.name,
      description: form.description || null,
      vehicle_type: form.vehicle_type,
      capacity_tons: form.capacity_tons ? Number(form.capacity_tons) : null,
      base_price: Number(form.base_price),
      price_per_km: form.price_per_km ? Number(form.price_per_km) : null,
      pickup_state: form.base_state,
      coverage_states: selectedCoverageStates.length > 0 ? selectedCoverageStates : [form.base_state],
      is_available: true,
    })

    if (error) {
      toast.error('Could not save service. Try again.')
      console.error(error)
      setLoading(false)
      return
    }

    toast.success('Service listed! Buyers can now hire you.')
    navigate('/dashboard')
  }

  return (
    <div className="page">
      <div className="topbar">
        <button
          onClick={() => navigate('/dashboard')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-2)', padding: '0 8px 0 0' }}
          aria-label="Go back"
        >
          ←
        </button>
        <h1>List a service</h1>
      </div>

      <div className="page-content" style={{ paddingTop: 20 }}>
        <form onSubmit={handleSubmit}>

          {/* Service basics */}
          <div className="section-label">Service details</div>

          <div className="input-group">
            <label>Service name *</label>
            <input
              placeholder="e.g. Lagos–Ibadan refrigerated haulage"
              value={form.name} onChange={set('name')} required
            />
          </div>

          <div className="input-group">
            <label>Vehicle type *</label>
            <select value={form.vehicle_type} onChange={set('vehicle_type')} required>
              <option value="">Select vehicle</option>
              {VEHICLE_TYPES.map(v => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label>Service type</label>
            <select value={form.service_type} onChange={set('service_type')}>
              <option value="">Select service type</option>
              {SERVICE_TYPES.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label>Description</label>
            <textarea
              placeholder="Describe your service — what you carry, your experience, anything buyers should know..."
              value={form.description} onChange={set('description')} rows={3}
            />
          </div>

          <div className="input-group">
            <label>Capacity (tonnes)</label>
            <input
              type="number" placeholder="e.g. 5"
              value={form.capacity_tons} onChange={set('capacity_tons')} min="0"
            />
          </div>

          {/* Pricing */}
          <div className="section-label">Pricing</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="input-group">
              <label>Base price (₦) *</label>
              <input
                type="number" placeholder="45000"
                value={form.base_price} onChange={set('base_price')} min="1" required
              />
            </div>
            <div className="input-group">
              <label>Per km (₦) optional</label>
              <input
                type="number" placeholder="150"
                value={form.price_per_km} onChange={set('price_per_km')} min="0"
              />
            </div>
          </div>

          <div style={{
            background: 'var(--amber-light)', borderRadius: 8,
            padding: '10px 12px', fontSize: 12, color: 'var(--amber)',
            marginBottom: 16, lineHeight: 1.6
          }}>
            💡 Base price is what buyers see and pay upfront. If you also charge per km, mention it in your description so buyers know the final cost may vary.
          </div>

          {/* Location */}
          <div className="section-label">Your base location *</div>

          <div className="input-group">
            <label>Home state *</label>
            <select value={form.base_state} onChange={set('base_state')} required>
              <option value="">Where are you based?</option>
              {STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Coverage states */}
          <div className="section-label">States you cover (tap to select)</div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
            Select all states you are willing to deliver to or pick up from.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
            {STATES.map(s => (
              <button
                key={s} type="button"
                onClick={() => toggleCoverageState(s)}
                className={`chip ${selectedCoverageStates.includes(s) ? 'active' : ''}`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Escrow reminder */}
          <div style={{
            background: 'var(--green-light)', borderRadius: 10,
            padding: '12px 14px', marginBottom: 20,
            fontSize: 12, color: 'var(--green-dark)', lineHeight: 1.6
          }}>
            🔒 Naagora holds payment securely. Once the buyer confirms delivery, your payout is released to your wallet automatically. You keep 95% of every job.
          </div>

          <button className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Listing service...' : 'List service for hire'}
          </button>
        </form>
      </div>
    </div>
  )
}
