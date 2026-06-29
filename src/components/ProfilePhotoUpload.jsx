// src/components/ProfilePhotoUpload.jsx
// Reusable profile picture upload component
// Used on farmer, buyer, and logistics provider profiles

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import toast from 'react-hot-toast'

export default function ProfilePhotoUpload({ currentPhoto, onUploadComplete }) {
  const { user, refreshProfile } = useAuth()
  const [uploading, setUploading] = useState(false)

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { toast.error('Photo must be under 3MB'); return }

    setUploading(true)
    const fileName = `profiles/${user.id}/avatar-${Date.now()}.${file.name.split('.').pop()}`

    const { error } = await supabase.storage
      .from('product-photos')
      .upload(fileName, file, { upsert: true })

    if (error) { toast.error('Upload failed. Try again.'); setUploading(false); return }

    const { data: urlData } = supabase.storage.from('product-photos').getPublicUrl(fileName)
    const photoUrl = urlData.publicUrl

    // Save to users table
    await supabase.from('users').update({ profile_photo: photoUrl }).eq('id', user.id)
    await refreshProfile()

    toast.success('Profile photo updated!')
    if (onUploadComplete) onUploadComplete(photoUrl)
    setUploading(false)
    e.target.value = ''
  }

  return (
    <label style={{ position: 'relative', cursor: 'pointer', display: 'inline-block' }}>
      {/* Photo circle */}
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        overflow: 'hidden', border: '2px solid var(--green)',
        background: 'var(--surface-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 32, position: 'relative'
      }}>
        {currentPhoto
          ? <img src={currentPhoto} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : '👤'}

        {/* Upload overlay */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'rgba(0,0,0,0.45)', padding: '4px 0',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {uploading
            ? <div className="spinner" style={{ width: 14, height: 14, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
            : <span style={{ fontSize: 12, color: '#fff' }}>📷</span>}
        </div>
      </div>
      <input type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} disabled={uploading} />
    </label>
  )
}
