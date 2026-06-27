// src/lib/claude.js
// ─────────────────────────────────────────────
// Claude API client for the Naagora AI assistant.
// Used by the floating chat button on every screen.
//
// The AI can answer questions about:
//   - Current market prices
//   - Delivery cost estimates
//   - Product listing help (writing descriptions)
//   - Order status explanations
//   - Demand trends on the platform
//
// It uses web search to fetch live price data when asked.
// ─────────────────────────────────────────────

const CLAUDE_API = 'https://api.anthropic.com/v1/messages'

// System prompt that gives Claude the Naagora context
const SYSTEM_PROMPT = `You are Naagora AI, a helpful assistant built into the Naagora agricultural marketplace app in Nigeria.

Naagora is a three-sided marketplace connecting:
- Farmers who sell produce (tomatoes, yam, pepper, vegetables, grains etc.)
- Buyers who purchase farm produce
- Logistics providers (3PL) who offer haulage and delivery services

Your job is to help users with:
1. PRICE CHECKS — Tell buyers and farmers if a price is fair based on current Nigerian market rates. Search the web for current AFEX Nigeria prices or other Nigerian commodity price sources when asked.
2. DELIVERY COST ESTIMATES — Estimate realistic haulage costs between Nigerian states based on distance, load, and vehicle type. Use zone-based pricing: same state is cheapest, neighbouring states mid-range, cross-region is premium.
3. PRODUCT LISTING HELP — Write compelling product descriptions for farmers listing produce. Ask for: product name, location, freshness, quantity.
4. DEMAND TRENDS — Explain which produce is in high demand based on platform activity.
5. ORDER QUESTIONS — Explain what order statuses mean and what action the user should take.
6. GENERAL FARMING ADVICE — Basic advice relevant to Nigerian agriculture.

Always respond in clear, simple English. Keep answers short and practical — users are on mobile.
When giving prices, always state they are estimates and market rates change daily.
Never make up specific platform data you don't have — say "based on typical Nigerian market rates" instead.
If someone writes in Pidgin English, respond naturally in a mix of English and Pidgin.`

/**
 * Sends a message to Claude and returns the response.
 * @param {Array} messages - conversation history [{role, content}]
 * @param {boolean} useSearch - whether to enable web search for price data
 * @returns {Promise<string>} Claude's response text
 */
export async function askClaude(messages, useSearch = true) {
  const tools = useSearch ? [{
    type: 'web_search_20250305',
    name: 'web_search'
  }] : []

  const response = await fetch(CLAUDE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages,
      ...(tools.length > 0 ? { tools } : {})
    })
  })

  if (!response.ok) {
    throw new Error('AI request failed. Check your connection and try again.')
  }

  const data = await response.json()

  // Extract text from response — may contain tool_use blocks mixed in
  const text = data.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')

  return text || 'Sorry, I could not generate a response. Please try again.'
}
