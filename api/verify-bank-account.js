// api/verify-bank-account.js
// ─────────────────────────────────────────────
// Verifies a bank account number + bank code with Paystack
// and returns the real account holder's name. Used so the
// farmer/provider can confirm "is this really my account"
// before submitting a withdrawal request.
// ─────────────────────────────────────────────

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { accountNumber, bankCode } = req.query

  if (!accountNumber || !bankCode) {
    return res.status(400).json({ error: 'Missing account number or bank code' })
  }

  try {
    const response = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    )
    const data = await response.json()

    if (!data.status) {
      return res.status(400).json({ error: data.message || 'Could not verify account' })
    }

    return res.status(200).json({ accountName: data.data.account_name })
  } catch (err) {
    console.error('Bank verification error:', err)
    return res.status(500).json({ error: 'Verification failed. Please try again.' })
  }
}
