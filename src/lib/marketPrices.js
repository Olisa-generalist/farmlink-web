// src/lib/marketPrices.js
// ─────────────────────────────────────────────
// Fetches and caches Nigerian commodity prices.
//
// Strategy (in order of preference):
//   1. Naagora's own recent completed orders — most accurate
//   2. Cached prices stored in Supabase (updated daily by AI fetch)
//   3. Hardcoded baseline fallback so the UI never shows empty
//
// The AI chat can fetch live web prices on demand when a user
// specifically asks — this file handles the homepage ticker display.
// ─────────────────────────────────────────────

import { supabase } from './supabase'

// Fallback baseline prices (updated manually when needed)
// These show when Supabase has no data yet
const BASELINE_PRICES = [
  { name: 'Tomato',      unit: 'crate',  price: 4800,  change: 6,   trend: 'up' },
  { name: 'Yam',         unit: 'bag',    price: 13500, change: -2,  trend: 'down' },
  { name: 'Pepper',      unit: 'kg',     price: 2900,  change: 11,  trend: 'up' },
  { name: 'Onion',       unit: 'bag',    price: 9200,  change: 3,   trend: 'up' },
  { name: 'Cassava',     unit: 'bag',    price: 5400,  change: -1,  trend: 'down' },
  { name: 'Ugwu',        unit: 'bunch',  price: 800,   change: 5,   trend: 'up' },
  { name: 'Plantain',    unit: 'bunch',  price: 2200,  change: 8,   trend: 'up' },
  { name: 'Sweet Potato',unit: 'bag',    price: 7500,  change: 2,   trend: 'up' },
]

/**
 * Fetches commodity prices — first tries Naagora's own order data,
 * falls back to baseline if not enough data exists yet.
 */
export async function getMarketPrices() {
  try {
    // Try to get average prices from recent completed orders on platform
    const { data: orderPrices } = await supabase
      .from('order_legs')
      .select(`
        unit_price,
        products ( name, unit, category )
      `)
      .eq('status', 'completed')
      .eq('leg_type', 'product')
      .gte('completed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(200)

    if (orderPrices && orderPrices.length >= 10) {
      // Enough real data — compute averages per product name
      const grouped = {}
      orderPrices.forEach(leg => {
        if (!leg.products || !leg.unit_price) return
        const name = leg.products.name
        if (!grouped[name]) grouped[name] = { prices: [], unit: leg.products.unit }
        grouped[name].prices.push(Number(leg.unit_price))
      })

      return Object.entries(grouped).map(([name, data]) => {
        const avg = data.prices.reduce((a, b) => a + b, 0) / data.prices.length
        return {
          name,
          unit: data.unit,
          price: Math.round(avg),
          change: null, // real change needs historical data
          trend: null,
          fromPlatform: true
        }
      }).slice(0, 8)
    }
  } catch (err) {
    // Supabase error — fall through to baseline
    console.warn('Could not fetch platform prices:', err.message)
  }

  // Not enough real orders yet — use baseline
  return BASELINE_PRICES.map(p => ({ ...p, fromPlatform: false }))
}

/**
 * Fetches demand signals — which products buyers are searching
 * and ordering most in the last 7 days on Naagora.
 */
export async function getDemandSignals() {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: recentOrders } = await supabase
      .from('order_legs')
      .select('products ( name, category )')
      .eq('leg_type', 'product')
      .gte('created_at', sevenDaysAgo)
      .limit(500)

    if (recentOrders && recentOrders.length >= 5) {
      // Count orders per product
      const counts = {}
      recentOrders.forEach(leg => {
        if (!leg.products) return
        const name = leg.products.name
        counts[name] = (counts[name] || 0) + 1
      })

      const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)

      const max = sorted[0]?.[1] || 1
      return sorted.map(([name, count], i) => ({
        name,
        count,
        barPercent: Math.round((count / max) * 100),
        level: i < 2 ? 'hot' : 'rising',
        fromPlatform: true
      }))
    }
  } catch (err) {
    console.warn('Could not fetch demand signals:', err.message)
  }

  // Fallback demand data
  return [
    { name: 'Pepper',   count: 38, barPercent: 92, level: 'hot',    fromPlatform: false },
    { name: 'Tomato',   count: 31, barPercent: 85, level: 'hot',    fromPlatform: false },
    { name: 'Ugwu',     count: 22, barPercent: 64, level: 'rising', fromPlatform: false },
    { name: 'Yam',      count: 19, barPercent: 57, level: 'rising', fromPlatform: false },
    { name: 'Plantain', count: 14, barPercent: 42, level: 'rising', fromPlatform: false },
    { name: 'Onion',    count: 11, barPercent: 34, level: 'rising', fromPlatform: false },
  ]
}
