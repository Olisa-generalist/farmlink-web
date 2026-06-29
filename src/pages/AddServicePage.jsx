// src/pages/AddServicePage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import toast from 'react-hot-toast'

const VEHICLE_TYPES = [
  // Small / personal vehicles
  { id: 'saloon_hatchback', label: '🚗 Saloon / Hatchback car', desc: 'Small loads, documents, last-mile' },
  { id: 'sienna_wagon',     label: '🚙 Sienna / Station wagon', desc: 'Medium loads, market runs' },
  { id: 'suv',              label: '🚐 SUV / Jeep', desc: 'Medium loads, off-road routes' },

  // Vans & buses
  { id: 'minivan',          label: '🚐 Minivan (Hiace type)', desc: 'Cargo van, high capacity' },
  { id: 'minibus',          label: '🚌 Minibus / Bus', desc: 'Large volume, market goods' },

  // Trucks
  { id: 'pickup',           label: '🛻 Pickup truck', desc: 'Open bed, versatile' },
  { id: 'flatbed',          label: '🚚 Flatbed truck', desc: 'Heavy or oversized loads' },
  { id: 'truck_5t',         label: '🚛 Truck (5 tonnes)', desc: 'Medium haulage' },
  { id: 'truck_10t',        label: '🚛 Truck (10 tonnes)', desc: 'Large haulage' },
  { id: 'truck_20t',        label: '🚛 Truck (20 tonnes)', desc: 'Heavy haulage' },
  { id: 'truck_30t',        label: '🚛 Truck (30+ tonnes)', desc: 'Industrial scale' },

  // Specialty
  { id: 'refrigerated',     label: '❄️ Refrigerated van/truck', desc: 'Perishables, cold chain' },
  { id: 'motorcycle',       label: '🏍️ Motorcycle / Okada', desc: 'Quick delivery, tight areas' },
  { id: 'tricycle',         label: '🛺 Tricycle / Keke', desc: 'Local delivery, market areas' },
]

const SERVICE_TYPES = [
  { id: 'haulage',          label: 'Long-distance haulage' },
  { id: 'last_mile',        label: 'Last-mile delivery' },
  { id: 'cold_chain',       label: 'Cold chain / perishables' },
  { id: 'farm_pickup',      label: 'Farm pickup' },
  { id: 'market_delivery',  label: 'Market delivery' },
  { id: 'interstate',       label: 'Interstate transport' },
]

const STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo',
  'Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa',
  'Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba',
  'Yobe','Zamfara'
]


// Adds a NAAGORA watermark to vehicle photos before uploading
async function addWatermark(file) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const text = 'NAAGORA'
      const fontSize = Math.max(24, img.width * 0.06)
      ctx.font = `bold ${fontSize}px Arial`
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)'
      ctx.lineWidth = 2
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.save()
      ctx.translate(img.width / 2, img.height / 2)
      ctx.rotate(-Math.PI / 6)
      ctx.strokeText(text, 0, 0)
      ctx.fillText(text, 0, 0)
      ctx.restore()
      URL.revokeObjectURL(url)
      canvas.toBlob(resolve, file.type || 'image/jpeg', 0.92)
    }
    img.src = url
  })
}

export default function AddServicePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [uploadingVehiclePhoto, setUploadingVehiclePhoto] = useState(false)
  const [vehiclePhotos, setVehiclePhotos] = useState([])
  const [selectedStates, setSelectedStates] = useState([])
  const [form, setForm] = useState({
    name: '', description: '', vehicle_type: '',
    service_type: '', capacity_tons: '',
    base_price: '', price_per_km: '', base_state: '',
  })

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })) }

  function toggleState(state) {
    setSelectedStates(prev =>
      prev.includes(state) ? prev.filter(s => s !== state) : [...prev, state]
    )
  }

  async function handleVehiclePhotoUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Photo must be under 5MB'); return }
    if (vehiclePhotos.length >= 3) { toast.error('Maximum 3 vehicle photos'); return }
    setUploadingVehiclePhoto(true)
    toast('Adding watermark...', { icon: '🔒' })
    try {
      const watermarked = await addWatermark(file)
      const fileName = `vehicles/${user.id}/${Date.now()}-${file.name}`
      const { error } = await supabase.storage.from('product-photos').upload(fileName, watermarked, { contentType: file.type || 'image/jpeg' })
      if (error) { toast.error('Upload failed. Try again.'); setUploadingVehiclePhoto(false); return }
      const { data: urlData } = supabase.storage.from('product-photos').getPublicUrl(fileName)
      setVehiclePhotos(prev => [...prev, { url: urlData.publicUrl, path: fileName }])
      toast.success('Vehicle photo added with watermark!')
    } catch (err) {
      toast.error('Could not process photo. Try again.')
    }
    setUploadingVehiclePhoto(false)
    e.target.value = ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name || !form.vehicle_type || !form.base_price || !form.base_state) {
      toast.error('Please fill in all required fields'); return
    }
    if (vehiclePhotos.length < 1) {
      toast.error('Please add at least 1 photo of your vehicle'); return
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
      coverage_states: selectedStates.length > 0 ? selectedStates : [form.base_state],
      photos: vehiclePhotos.map(p => p.url),
      is_available: false,   // Hidden until admin approves
      is_verified: false,    // Admin must approve
    })
    if (error) { toast.error('Could not save service. Try again.'); setLoading(false); return }
    toast.success('Service submitted for review! We will notify you once it is approved and goes live.')
    navigate('/dashboard')
  }

  return (
    <div className="page">
      <div className="topbar">
        <button onClick={() => navigate('/dashboard')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-2)', padding: '0 8px 0 0' }}>←</button>
        <h1>List a service</h1>
      </div>

      <div className="page-content" style={{ paddingTop: 20 }}>
        <form onSubmit={handleSubmit}>

          {/* Vehicle photos */}
          <div className="section-label">
            Vehicle photos *
            <span style={{ color: vehiclePhotos.length >= 1 ? 'var(--green)' : 'var(--red)', fontWeight: 500, marginLeft: 6, textTransform: 'none', fontSize: 12 }}>
              {vehiclePhotos.length}/1 minimum {vehiclePhotos.length >= 1 ? '✓' : '(required)'}
            </span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10, lineHeight: 1.6 }}>
            Add clear photos of your actual vehicle. Buyers want to see what will carry their goods. Up to 3 photos.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {vehiclePhotos.map((photo, i) => (
              <div key={i} style={{ position: 'relative', width: 80, height: 80 }}>
                <img src={photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, border: '0.5px solid var(--border)' }} />
                <button type="button" onClick={async () => {
                  await supabase.storage.from('product-photos').remove([photo.path])
                  setVehiclePhotos(prev => prev.filter((_, j) => j !== i))
                }} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#A32D2D', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
            ))}
            {vehiclePhotos.length < 3 && (
              <label style={{ width: 80, height: 80, borderRadius: 8, cursor: 'pointer', border: `1.5px dashed ${vehiclePhotos.length < 1 ? 'var(--red)' : 'var(--border-2)'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text-3)', gap: 4, background: 'var(--surface-2)' }}>
                {uploadingVehiclePhoto ? <div className="spinner" style={{ width: 20, height: 20 }} /> : <><span style={{ fontSize: 22 }}>🚗</span>Add photo</>}
                <input type="file" accept="image/*" onChange={handleVehiclePhotoUpload} style={{ display: 'none' }} disabled={uploadingVehiclePhoto} />
              </label>
            )}
          </div>

          {/* Service details */}
          <div className="section-label">Service details</div>

          <div className="input-group">
            <label>Service name *</label>
            <input placeholder="e.g. Lagos–Ibadan yam haulage" value={form.name} onChange={set('name')} required />
          </div>

          <div className="input-group">
            <label>Vehicle type *</label>
            <select value={form.vehicle_type} onChange={set('vehicle_type')} required>
              <option value="">Select your vehicle</option>
              {VEHICLE_TYPES.map(v => (
                <option key={v.id} value={v.id}>{v.label} — {v.desc}</option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label>Service type</label>
            <select value={form.service_type} onChange={set('service_type')}>
              <option value="">Select service type</option>
              {SERVICE_TYPES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>

          <div className="input-group">
            <label>Description</label>
            <textarea placeholder="Describe your service — what you carry, your experience, routes you know well, anything buyers should know..." value={form.description} onChange={set('description')} rows={3} />
          </div>

          <div className="input-group">
            <label>Capacity (tonnes) — optional</label>
            <input type="number" placeholder="e.g. 5" value={form.capacity_tons} onChange={set('capacity_tons')} min="0" step="0.5" />
          </div>

          {/* Pricing */}
          <div className="section-label">Pricing</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="input-group">
              <label>Base price (₦) *</label>
              <input type="number" placeholder="45000" value={form.base_price} onChange={set('base_price')} min="1" required />
            </div>
            <div className="input-group">
              <label>Per km (₦) optional</label>
              <input type="number" placeholder="150" value={form.price_per_km} onChange={set('price_per_km')} min="0" />
            </div>
          </div>
          <div style={{ background: 'var(--amber-light)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--amber)', marginBottom: 16, lineHeight: 1.6 }}>
            💡 Base price is what buyers see upfront. If you charge extra per km, mention it in your description so buyers know the final cost may vary by distance.
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

          <div className="section-label">States you cover (tap to select)</div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>Select all states you deliver to or pick up from.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
            {STATES.map(s => (
              <button key={s} type="button" onClick={() => toggleState(s)}
                className={`chip ${selectedStates.includes(s) ? 'active' : ''}`}>{s}</button>
            ))}
          </div>

          <div style={{ background: 'var(--green-light)', borderRadius: 10, padding: '12px 14px', marginBottom: 20, fontSize: 12, color: 'var(--green-dark)', lineHeight: 1.6 }}>
            🔒 Naagora holds payment securely. Once the buyer confirms delivery, your payout is released to your wallet automatically. You keep 95% of every job.
          </div>

          <button className="btn btn-primary btn-full" disabled={loading || vehiclePhotos.length < 1}>
            {loading ? 'Submitting for review...' : vehiclePhotos.length < 1 ? 'Add a vehicle photo to continue' : 'Submit service for admin review'}
          </button>
        </form>
      </div>
    </div>
  )
}
