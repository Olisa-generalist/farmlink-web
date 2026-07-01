// api/approve-transfer.js
// ─────────────────────────────────────────────
// Paystack Transfer Approval URL endpoint.
// Paystack calls this BEFORE processing any transfer from
// your Naagora Paystack balance. We verify the transfer
// actually corresponds to a real, legitimate withdrawal
// request in our database — if yes, we return 200 and
// Paystack proceeds. If no match found, we return 400
// and Paystack rejects the transfer entirely.
//
// Setup in Paystack Dashboard:
// Settings → Preferences → Transfer Approval → paste:
// https://naagora.vercel.app/api/approve-transfer
// ─────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  // Verify this request genuinely came from Paystack by checking
  // the signature they include in the header
  const paystackSignature = req.headers['x-paystack-signature']
  if (paystackSignature) {
    const hash = crypto
      .createHmac('sha512', PAYSTACK_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex')

    if (hash !== paystackSignature) {
      console.error('Invalid Paystack signature — possible spoofed request')
      return res.status(400).json({ message: 'Invalid signature' })
    }
  }

  const { reference, amount, recipient } = req.body

  if (!reference) {
    return res.status(400).json({ message: 'No reference provided' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    // Check if this transfer reference exists in our withdrawals table
    // as a legitimate, pending withdrawal we actually initiated
    const { data: withdrawal, error } = await supabase
      .from('withdrawals')
      .select('id, amount, status, user_id')
      .eq('paystack_reference', reference)
      .single()

    if (error || !withdrawal) {
      // No matching withdrawal found — this transfer was NOT initiated
      // by our system. Reject it to protect against unauthorized transfers.
      console.error('SECURITY: Transfer approval rejected — no matching withdrawal', { reference, amount })
      return res.status(400).json({ message: 'Transfer not recognized' })
    }

    if (withdrawal.status === 'success') {
      // Already processed — don't double-approve
      console.warn('Transfer already processed', { reference })
      return res.status(400).json({ message: 'Transfer already completed' })
    }

    // Transfer is legitimate — approve it
    console.log('Transfer approved', { reference, amount: withdrawal.amount })
    return res.status(200).json({ message: 'Transfer approved' })

  } catch (err) {
    console.error('Approval endpoint error:', err)
    // Return 400 on errors to be safe — don't approve if uncertain
    return res.status(400).json({ message: 'Could not verify transfer' })
  }
}
