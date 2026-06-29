// src/pages/HomePage.jsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { getMarketPrices, getDemandSignals } from '../lib/marketPrices'

const CATEGORIES = [
  { id: null,        label: 'All' },
  { id: 'vegetable', label: 'Vegetables' },
  { id: 'tuber',     label: 'Tubers' },
  { id: 'fruit',     label: 'Fruits' },
  { id: 'grain',     label: 'Grains' },
  { id: 'livestock', label: 'Livestock' },
]

const EMOJI_MAP = {
  vegetable: '🥬', tuber: '🍠', fruit: '🍅',
  grain: '🌾', livestock: '🐄', default: '📦'
}

export default function HomePage() {
  const { profile } = useAuth()
  const [products, setProducts] = useState([])
  const [prices, setPrices] = useState([])
  const [demand, setDemand] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [loadingPrices, setLoadingPrices] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(null)

  const role = profile?.role || 'buyer'
  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const isFarmer = role === 'farmer'
  const isProvider = role === 'provider'

  useEffect(() => {
    fetchProducts()
    fetchMarketData()
  }, [search, category])

  async function fetchProducts() {
    setLoadingProducts(true)
    let query = supabase
      .from('products')
      .select(`id, name, price_per_unit, unit, quantity_available, category, photos, state, users ( full_name )`)
      .eq('is_available', true)
      .gt('quantity_available', 0)
      .order('created_at', { ascending: false })
      .limit(40)

    if (category) query = query.eq('category', category)
    if (search.length > 1) query = query.ilike('name', `%${search}%`)

    const { data } = await query
    setProducts(data || [])
    setLoadingProducts(false)
  }

  async function fetchMarketData() {
    setLoadingPrices(true)
    const [priceData, demandData] = await Promise.all([
      getMarketPrices(),
      getDemandSignals()
    ])
    setPrices(priceData)
    setDemand(demandData)
    setLoadingPrices(false)
  }

  return (
    <div className="page">
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <div className="topbar-logo">Naagora</div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>
            {`Good day, ${firstName}`}
          </p>
        </div>
        <Link to="/profile" style={{ color: 'var(--text-2)', textDecoration: 'none', fontSize: 22 }}>
          👤
        </Link>
      </div>

      <div className="page-content">

        {/* ── MARKET PRICES TICKER ── */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div className="section-label" style={{ margin: 0 }}>Live market prices</div>
            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
              {loadingPrices ? 'Fetching...' : prices[0]?.fromPlatform ? 'From Naagora orders' : 'Baseline estimates'}
            </span>
          </div>

          {loadingPrices ? (
            <div style={{ display: 'flex', gap: 8, overflow: 'hidden' }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{
                  width: 90, height: 70, borderRadius: 10, flexShrink: 0,
                  background: 'var(--surface-2)', border: '0.5px solid var(--border)'
                }} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {prices.map((p, i) => (
                <div key={i} style={{
                  background: 'var(--surface-2)',
                  border: '0.5px solid var(--border)',
                  borderRadius: 10, padding: '8px 10px',
                  flexShrink: 0, minWidth: 88
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                    ₦{p.price.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 2 }}>
                    per {p.unit}
                  </div>
                  {p.change !== null && (
                    <div style={{ fontSize: 10, color: p.trend === 'up' ? '#0F6E56' : '#A32D2D' }}>
                      {p.trend === 'up' ? '↑' : '↓'} {Math.abs(p.change)}% this week
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 5 }}>
            {prices[0]?.fromPlatform
              ? 'Average from completed Naagora orders this week'
              : 'Estimates — will update as orders complete on Naagora'}
          </p>
        </div>

        {/* ── DEMAND SIGNALS ── shown to farmers and all users */}
        <div style={{ marginTop: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div className="section-label" style={{ margin: 0 }}>
              {isFarmer ? 'What buyers want right now' : 'In high demand'}
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
              {demand[0]?.fromPlatform ? 'From Naagora activity' : 'General trends'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {demand.slice(0, 4).map((d, i) => (
              <div key={i} style={{
                background: 'var(--surface-2)',
                border: '0.5px solid var(--border)',
                borderRadius: 10, padding: 10
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)' }}>{d.name}</div>
                  <span style={{
                    fontSize: 9, fontWeight: 500, padding: '2px 6px', borderRadius: 10,
                    background: d.level === 'hot' ? '#FAECE7' : '#FAEEDA',
                    color: d.level === 'hot' ? '#993C1D' : '#854F0B'
                  }}>
                    {d.level === 'hot' ? '🔥 Hot' : '↑ Rising'}
                  </span>
                </div>
                <div style={{
                  height: 4, background: 'var(--border)', borderRadius: 2, marginBottom: 4
                }}>
                  <div style={{
                    height: 4, borderRadius: 2,
                    width: `${d.barPercent}%`,
                    background: d.level === 'hot' ? '#D85A30' : '#BA7517',
                    transition: 'width 0.8s ease'
                  }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-3)' }}>
                  {d.fromPlatform
                    ? `${d.count} orders this week on Naagora`
                    : `High demand across Nigerian markets`}
                </div>
              </div>
            ))}
          </div>

          {/* Farmer tip — only show to farmers */}
          {isFarmer && demand.length > 0 && (
            <div style={{
              background: '#E1F5EE', borderRadius: 10,
              padding: '10px 12px', marginTop: 8,
              fontSize: 12, color: '#085041', lineHeight: 1.6
            }}>
              💡 <strong>{demand[0]?.name}</strong> is most in demand right now. If you have it, list it — buyers are actively searching.
            </div>
          )}
        </div>

        {/* ── PRODUCT SEARCH + BROWSE ── */}
        <div className="search-bar" style={{ marginTop: 16 }}>
          <span className="search-icon">🔍</span>
          <input
            placeholder="Search tomatoes, yam, pepper..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-3)', fontSize: 16, padding: 0
            }}>×</button>
          )}
        </div>

        <div className="chips">
          {CATEGORIES.map(c => (
            <button
              key={c.label}
              className={`chip ${category === c.id ? 'active' : ''}`}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>

        {loadingProducts ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div className="spinner" />
          </div>
        ) : products.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🌱</div>
            <h3>Nothing here yet</h3>
            <p>{search ? `No products matching "${search}"` : 'No products in this category yet'}</p>
            {isFarmer && (
              <Link to="/add-product" className="btn btn-primary" style={{ marginTop: 8 }}>
                Be the first to list
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="section-label">{products.length} products available</div>
            <div className="product-grid">
              {products.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ProductCard({ product: p }) {
  const photo = p.photos?.[0]
  const emoji = EMOJI_MAP[p.category] || EMOJI_MAP.default
  const farmerName = p.users?.full_name || 'Unknown farmer'

  return (
    <Link to={`/product/${p.id}`} className="product-card">
      <div className="product-card-img">
        {photo ? <img src={photo} alt={p.name} loading="lazy" /> : emoji}
      </div>
      <div className="product-card-body">
        <div className="product-card-name">{p.name}</div>
        <div className="product-card-farmer">{farmerName} · {p.state || 'Nigeria'}</div>
        <div className="product-card-footer">
          <div>
            <div className="product-card-price">₦{Number(p.price_per_unit).toLocaleString()}</div>
            <div className="product-card-unit">per {p.unit}</div>
          </div>
          <span className="badge badge-green">{Math.floor(p.quantity_available)} left</span>
        </div>
      </div>
    </Link>
  )
}
