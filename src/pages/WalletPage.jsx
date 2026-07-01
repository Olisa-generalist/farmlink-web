// src/pages/WalletPage.jsx
// Wallet page for farmers and logistics providers.
// Shows balance, total earned, total withdrawn, transaction
// history, and a withdraw-to-bank flow using Paystack Transfer API
// (handled securely via /api/withdraw serverless function).

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import toast from 'react-hot-toast'

export default function WalletPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [wallet, setWallet] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showWithdraw, setShowWithdraw] = useState(false)

  useEffect(() => { if (user) fetchAll() }, [user])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchWallet(), fetchTransactions()])
    setLoading(false)
  }

  async function fetchWallet() {
    const { data } = await supabase
      .from('wallets')
      .select('balance, total_earned, total_withdrawn')
      .eq('user_id', user.id)
      .single()
    setWallet(data)
  }

  async function fetchTransactions() {
    // Combine completed leg payouts (credits) and withdrawals (debits)
    // into one chronological transaction history
    const { data: legs } = await supabase
      .from('order_legs')
      .select(`id, leg_payout, completed_at, payout_released_at, leg_type,
        products ( name ), logistics_services ( name )`)
      .eq('provider_id', user.id)
      .eq('status', 'completed')
      .eq('payout_released', true)
      .order('completed_at', { ascending: false })
      .limit(20)

    const { data: withdrawals } = await supabase
      .from('withdrawals')
      .select('id, amount, status, bank_name, account_number, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    const credits = (legs || []).map(l => ({
      type: 'credit',
      id: l.id,
      amount: l.leg_payout,
      label: l.leg_type === 'product' ? (l.products?.name || 'Product sale') : (l.logistics_services?.name || 'Delivery job'),
      date: l.payout_released_at || l.completed_at,
    }))

    const debits = (withdrawals || []).map(w => ({
      type: 'debit',
      id: w.id,
      amount: w.amount,
      label: `Withdrawal to ${w.bank_name} ****${w.account_number?.slice(-4)}`,
      date: w.created_at,
      status: w.status,
    }))

    const all = [...credits, ...debits].sort((a, b) => new Date(b.date) - new Date(a.date))
    setTransactions(all)
  }

  if (loading) return (
    <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div className="page">
      <div className="topbar">
        <button onClick={() => navigate('/dashboard')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-2)', padding: '0 8px 0 0' }}>←</button>
        <h1>Wallet</h1>
      </div>

      <div className="page-content" style={{ paddingTop: 20 }}>

        {/* Balance card */}
        <div style={{
          background: 'linear-gradient(135deg, #0F6E56, #085041)',
          borderRadius: 16, padding: '24px 20px', marginBottom: 16, color: '#fff'
        }}>
          <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>Available balance</div>
          <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 16 }}>
            ₦{Number(wallet?.balance || 0).toLocaleString()}
          </div>
          <button
            onClick={() => setShowWithdraw(true)}
            disabled={!wallet?.balance || wallet.balance <= 0}
            style={{
              background: '#fff', color: '#0F6E56', border: 'none',
              borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600,
              cursor: wallet?.balance > 0 ? 'pointer' : 'not-allowed',
              opacity: wallet?.balance > 0 ? 1 : 0.5
            }}
          >
            Withdraw to bank
          </button>
        </div>

        {/* Stats */}
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Total earned</div>
            <div className="stat-value">₦{Number(wallet?.total_earned || 0).toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total withdrawn</div>
            <div className="stat-value">₦{Number(wallet?.total_withdrawn || 0).toLocaleString()}</div>
          </div>
        </div>

        {/* Transaction history */}
        <div className="section-label">Transaction history</div>
        {transactions.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">💳</div>
            <h3>No transactions yet</h3>
            <p>Your earnings and withdrawals will appear here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {transactions.map((t, i) => (
              <div key={t.type + t.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 0', borderBottom: i < transactions.length - 1 ? '0.5px solid var(--border)' : 'none'
              }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: t.type === 'credit' ? 'var(--green-light)' : 'var(--red-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0
                  }}>
                    {t.type === 'credit' ? '↓' : '↑'}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{t.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {new Date(t.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {t.status && t.status !== 'success' && ` · ${t.status}`}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: t.type === 'credit' ? 'var(--green)' : 'var(--red)' }}>
                  {t.type === 'credit' ? '+' : '−'}₦{Number(t.amount).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showWithdraw && (
        <WithdrawModal
          balance={wallet?.balance || 0}
          onClose={() => setShowWithdraw(false)}
          onSuccess={() => { setShowWithdraw(false); fetchAll() }}
        />
      )}
    </div>
  )
}

function WithdrawModal({ balance, onClose, onSuccess }) {
  const { user, profile } = useAuth()
  const [banks, setBanks] = useState([])
  const [loadingBanks, setLoadingBanks] = useState(true)
  const [bankCode, setBankCode] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { fetchBanks() }, [])

  async function fetchBanks() {
    setLoadingBanks(true)
    try {
      const res = await fetch('/api/list-banks')
      const data = await res.json()
      setBanks(data.banks || [])
    } catch (err) {
      toast.error('Could not load bank list')
    }
    setLoadingBanks(false)
  }

  async function verifyAccount() {
    if (!bankCode || accountNumber.length !== 10) return
    setVerifying(true)
    setAccountName('')
    try {
      const res = await fetch(`/api/verify-bank-account?accountNumber=${accountNumber}&bankCode=${bankCode}`)
      const data = await res.json()
      if (data.accountName) {
        setAccountName(data.accountName)
      } else {
        toast.error(data.error || 'Could not verify account')
      }
    } catch (err) {
      toast.error('Verification failed. Try again.')
    }
    setVerifying(false)
  }

  useEffect(() => {
    if (bankCode && accountNumber.length === 10) verifyAccount()
  }, [bankCode, accountNumber])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!accountName) { toast.error('Please verify your account first'); return }
    const amt = Number(amount)
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }
    if (amt > balance) { toast.error('Amount exceeds your available balance'); return }

    setSubmitting(true)
    try {
      const selectedBank = banks.find(b => b.code === bankCode)
      const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amount: amt,
          bankCode,
          accountNumber,
          accountName,
          bankName: selectedBank?.name || '',
        })
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Withdrawal failed');
        setSubmitting(false)
        return
      }

      // Save bank details for next time
      await supabase.from('users').update({
        bank_name: selectedBank?.name,
        bank_account_number: accountNumber,
        bank_account_name: accountName,
      }).eq('id', user.id)

      toast.success('Withdrawal initiated! Funds will arrive shortly.')
      onSuccess()
    } catch (err) {
      console.error(err)
      toast.error('Something went wrong. Try again.')
    }
    setSubmitting(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end'
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: '20px 20px 0 0',
        width: '100%', maxWidth: 480, margin: '0 auto',
        maxHeight: '85vh', overflowY: 'auto', padding: 20
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17 }}>Withdraw to bank</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-3)' }}>×</button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>
          Available: <strong style={{ color: 'var(--green)' }}>₦{Number(balance).toLocaleString()}</strong>
        </p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Bank</label>
            {loadingBanks ? (
              <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Loading banks...</div>
            ) : (
              <select value={bankCode} onChange={e => { setBankCode(e.target.value); setAccountName('') }} required>
                <option value="">Select your bank</option>
                {banks.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
              </select>
            )}
          </div>

          <div className="input-group">
            <label>Account number</label>
            <input
              type="text" maxLength={10} placeholder="0123456789"
              value={accountNumber}
              onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ''))}
              required
            />
          </div>

          {verifying && <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>Verifying account...</p>}
          {accountName && (
            <div style={{ background: 'var(--green-light)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 13, color: 'var(--green-dark)' }}>
              ✓ {accountName}
            </div>
          )}

          <div className="input-group">
            <label>Amount to withdraw</label>
            <input
              type="number" placeholder="0.00"
              value={amount} onChange={e => setAmount(e.target.value)}
              min="100" max={balance} required
            />
          </div>

          <button className="btn btn-primary btn-full" disabled={submitting || !accountName} style={{ height: 50 }}>
            {submitting ? 'Processing...' : `Withdraw ₦${amount ? Number(amount).toLocaleString() : '0'}`}
          </button>
        </form>
      </div>
    </div>
  )
}
