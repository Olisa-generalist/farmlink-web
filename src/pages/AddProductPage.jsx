// src/pages/AddProductPage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import toast from 'react-hot-toast'

const CATEGORIES = [
  { id: 'vegetable', label: '🥬 Vegetables' },
  { id: 'tuber',     label: '🍠 Tubers' },
  { id: 'fruit',     label: '🍅 Fruits' },
  { id: 'grain',     label: '🌾 Grains' },
  { id: 'livestock', label: '🐄 Livestock' },
  { id: 'other',     label: '📦 Other' },
]

const UNITS = ['kg', 'bag', 'crate', 'bunch', 'piece', 'litre', 'ton', 'carton']

const STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo',
  'Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa',
  'Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba',
  'Yobe','Zamfara'
]

// Adds a NAAGORA watermark to a photo before uploading
// Returns a blob of the watermarked image
async function addWatermark(file) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')

      // Draw original image
      ctx.drawImage(img, 0, 0)

      // Watermark settings
      const text = 'NAAGORA'
      const fontSize = Math.max(24, img.width * 0.06)
      ctx.font = `bold ${fontSize}px Arial`
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)'
      ctx.lineWidth = 2
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      // Rotate and place watermark in center
      ctx.save()
      ctx.translate(img.width / 2, img.height / 2)
      ctx.rotate(-Math.PI / 6) // -30 degrees
      ctx.strokeText(text, 0, 0)
      ctx.fillText(text, 0, 0)
      ctx.restore()

      URL.revokeObjectURL(url)
      canvas.toBlob(resolve, file.type || 'image/jpeg', 0.92)
    }
    img.src = url
  })
}

export default function AddProductPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photos, setPhotos] = useState([]) // [{url, path}]
  const [form, setForm] = useState({
    name: '', description: '', category: '',
    price_per_unit: '', unit: 'kg',
    quantity_available: '', min_order_quantity: '1',
    state: '', lga: '', harvest_date: '',
  })

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })) }

  async function handlePhotoUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Photo must be under 5MB'); return }
    if (photos.length >= 5) { toast.error('Maximum 5 photos allowed'); return }

    setUploadingPhoto(true)
    toast('Adding watermark...', { icon: '🔒' })

    try {
      // Apply watermark before uploading
      const watermarked = await addWatermark(file)
      const fileName = `${user.id}/${Date.now()}-${file.name}`

      const { error } = await supabase.storage
        .from('product-photos')
        .upload(fileName, watermarked, { contentType: file.type || 'image/jpeg' })

      if (error) { toast.error('Photo upload failed. Try again.'); setUploadingPhoto(false); return }

      const { data: urlData } = supabase.storage.from('product-photos').getPublicUrl(fileName)
      setPhotos(prev => [...prev, { url: urlData.publicUrl, path: fileName }])
      toast.success('Photo added with watermark!')
    } catch (err) {
      toast.error('Could not process photo. Try again.')
    }
    setUploadingPhoto(false)
    e.target.value = '' // reset input
  }

  async function removePhoto(index) {
    const photo = photos[index]
    await supabase.storage.from('product-photos').remove([photo.path])
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e) {
    e.preventDefault()

    // Require minimum 3 photos
    if (photos.length < 3) {
      toast.error(`Please add at least 3 photos. You have ${photos.length} so far.`)
      return
    }
    if (!form.name || !form.price_per_unit || !form.quantity_available || !form.category) {
      toast.error('Please fill in all required fields')
      return
    }

    setLoading(true)

    // is_available = false until admin approves
    // is_verified = false until admin approves
    const { error } = await supabase.from('products').insert({
      farmer_id: user.id,
      name: form.name,
      description: form.description || null,
      category: form.category,
      price_per_unit: Number(form.price_per_unit),
      unit: form.unit,
      quantity_available: Number(form.quantity_available),
      min_order_quantity: Number(form.min_order_quantity) || 1,
      state: form.state || null,
      lga: form.lga || null,
      harvest_date: form.harvest_date || null,
      photos: photos.map(p => p.url),
      is_available: false,   // Hidden from buyers until admin approves
      is_verified: false,    // Admin must approve
    })

    if (error) { toast.error('Could not save product. Try again.'); setLoading(false); return }

    toast.success('Product submitted for review! We will notify you once it is approved and goes live.')
    navigate('/dashboard')
  }

  const photosNeeded = Math.max(0, 3 - photos.length)

  return (
    <div className="page">
      <div className="topbar">
        <button onClick={() => navigate('/dashboard')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-2)', padding: '0 8px 0 0' }}>←</button>
        <h1>List a product</h1>
      </div>

      <div className="page-content" style={{ paddingTop: 20 }}>
        <form onSubmit={handleSubmit}>

          {/* Photo upload */}
          <div className="section-label">
            Photos
            <span style={{ color: photos.length >= 3 ? 'var(--green)' : 'var(--red)', fontWeight: 500, marginLeft: 6, textTransform: 'none', fontSize: 12 }}>
              {photos.length}/3 minimum {photos.length >= 3 ? '✓' : `(need ${photosNeeded} more)`}
            </span>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10, lineHeight: 1.6 }}>
            Add at least 3 clear photos of your actual produce. Photos are watermarked with "NAAGORA" to protect your listing. Maximum 5 photos.
          </p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {photos.map((photo, i) => (
              <div key={i} style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
                <img src={photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, border: '0.5px solid var(--border)' }} />
                <button type="button" onClick={() => removePhoto(i)} style={{
                  position: 'absolute', top: -6, right: -6, width: 20, height: 20,
                  borderRadius: '50%', background: '#A32D2D', color: '#fff',
                  border: 'none', cursor: 'pointer', fontSize: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>×</button>
              </div>
            ))}

            {photos.length < 5 && (
              <label style={{
                width: 80, height: 80, borderRadius: 8, cursor: 'pointer',
                border: `1.5px dashed ${photos.length < 3 ? 'var(--red)' : 'var(--border-2)'}`,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: 'var(--text-3)', gap: 4, background: 'var(--surface-2)'
              }}>
                {uploadingPhoto
                  ? <div className="spinner" style={{ width: 20, height: 20 }} />
                  : <><span style={{ fontSize: 22 }}>📷</span>Add photo</>}
                <input type="file" accept="image/*" onChange={handlePhotoUpload}
                  style={{ display: 'none' }} disabled={uploadingPhoto} />
              </label>
            )}
          </div>

          {/* Admin approval notice */}
          <div style={{
            background: '#E6F1FB', borderRadius: 10,
            padding: '10px 14px', marginBottom: 16,
            fontSize: 12, color: '#0C447C', lineHeight: 1.6
          }}>
            ℹ️ After submission, Naagora admin will review your product to ensure it meets quality standards before it goes live to buyers. This usually takes 24 hours.
          </div>

          {/* Product details */}
          <div className="section-label">Product details</div>

          <div className="input-group">
            <label>Product name *</label>
            <input placeholder="e.g. Fresh Tomatoes" value={form.name} onChange={set('name')} required />
          </div>

          <div className="input-group">
            <label>Category *</label>
            <select value={form.category} onChange={set('category')} required>
              <option value="">Select category</option>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          <div className="input-group">
            <label>Description</label>
            <textarea placeholder="Tell buyers about your produce — variety, freshness, how it was grown..."
              value={form.description} onChange={set('description')} rows={3} />
          </div>

          <div className="section-label">Pricing & quantity</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="input-group">
              <label>Price (₦) *</label>
              <input type="number" placeholder="4500" value={form.price_per_unit} onChange={set('price_per_unit')} min="1" required />
            </div>
            <div className="input-group">
              <label>Per (unit) *</label>
              <select value={form.unit} onChange={set('unit')}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="input-group">
              <label>Quantity available *</label>
              <input type="number" placeholder="50" value={form.quantity_available} onChange={set('quantity_available')} min="1" required />
            </div>
            <div className="input-group">
              <label>Minimum order</label>
              <input type="number" placeholder="1" value={form.min_order_quantity} onChange={set('min_order_quantity')} min="1" />
            </div>
          </div>

          <div className="section-label">Farm location</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="input-group">
              <label>State</label>
              <select value={form.state} onChange={set('state')}>
                <option value="">Select state</option>
                {STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>LGA / Area</label>
              <input placeholder="e.g. Ifo" value={form.lga} onChange={set('lga')} />
            </div>
          </div>

          <div className="input-group">
            <label>Harvest date</label>
            <input type="date" value={form.harvest_date} onChange={set('harvest_date')} />
          </div>

          <div style={{ background: 'var(--green-light)', borderRadius: 10, padding: '12px 14px', marginBottom: 20, fontSize: 12, color: 'var(--green-dark)', lineHeight: 1.6 }}>
            🔒 Naagora holds buyer payment safely until they confirm delivery — then releases it to your wallet within 24 hours.
          </div>

          <button className="btn btn-primary btn-full" disabled={loading || photos.length < 3}>
            {loading ? 'Submitting for review...' : photos.length < 3 ? `Add ${photosNeeded} more photo${photosNeeded > 1 ? 's' : ''} to continue` : 'Submit for admin review'}
          </button>
        </form>
      </div>
    </div>
  )
}
