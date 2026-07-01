// api/list-banks.js
// Returns Paystack's list of Nigerian banks with their codes.
// Used to populate the bank dropdown on the withdrawal form.

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const response = await fetch('https://api.paystack.co/bank?country=nigeria', {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` }
    })
    const data = await response.json()

    if (!data.status) {
      return res.status(400).json({ error: 'Could not fetch bank list' })
    }

    // Return only what we need: name + code
    const banks = data.data.map(b => ({ name: b.name, code: b.code }))
    return res.status(200).json({ banks })
  } catch (err) {
    console.error('List banks error:', err)
    return res.status(500).json({ error: 'Could not load banks' })
  }
}
