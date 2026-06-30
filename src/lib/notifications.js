// src/lib/notifications.js
// ─────────────────────────────────────────────
// Helper functions to create in-app notifications.
// Called whenever an order status changes — payment made,
// dispatched, delivered, product approved, etc.
//
// Email notifications use Supabase's built-in email via
// a database webhook (configured separately) OR can be
// extended later with Resend/SendGrid for richer emails.
// ─────────────────────────────────────────────

import { supabase } from './supabase'

/**
 * Creates a notification for a specific user.
 */
export async function notify(userId, title, body, type = null, orderId = null) {
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    title,
    body,
    type,
    order_id: orderId,
  })
  if (error) console.error('Notification creation failed:', error)
}

/**
 * Notifies all parties involved in an order when payment is confirmed.
 */
export async function notifyOrderPaid(orderId) {
  const { data: legs } = await supabase
    .from('order_legs')
    .select('provider_id, leg_type')
    .eq('order_id', orderId)

  if (!legs) return

  for (const leg of legs) {
    const message = leg.leg_type === 'product'
      ? 'A buyer has paid for your product. Please review and confirm the order.'
      : 'A buyer has paid for your logistics service. Please review and confirm the job.'

    await notify(
      leg.provider_id,
      leg.leg_type === 'product' ? 'New paid order 🌾' : 'New paid job 🚚',
      message,
      'order_paid',
      orderId
    )
  }
}

/**
 * Notifies the buyer when a leg status changes (dispatched, en route, etc.)
 */
export async function notifyBuyerOfLegUpdate(orderId, legType, newStatus) {
  const { data: order } = await supabase
    .from('orders').select('buyer_id').eq('id', orderId).single()
  if (!order) return

  const messages = {
    confirmed: legType === 'product' ? 'The farmer confirmed your order.' : 'The logistics provider accepted your job.',
    in_progress: legType === 'product' ? 'Your order has been dispatched by the farmer.' : 'Your delivery is now en route.',
    completed: 'Delivery confirmed — thank you for using Naagora!',
  }

  if (messages[newStatus]) {
    await notify(order.buyer_id, 'Order update', messages[newStatus], 'order_' + newStatus, orderId)
  }
}

/**
 * Notifies a provider when their wallet is credited.
 */
export async function notifyPayoutReleased(userId, amount) {
  await notify(
    userId,
    'Payment released! 🎉',
    `₦${Number(amount).toLocaleString()} has been added to your Naagora wallet.`,
    'payment_released'
  )
}

/**
 * Notifies a farmer/provider when their product or service is approved/rejected.
 */
export async function notifyListingDecision(userId, itemName, approved, reason = null) {
  if (approved) {
    await notify(userId, 'Listing approved! ✅', `"${itemName}" is now live on Naagora.`, 'product_approved')
  } else {
    await notify(userId, 'Listing needs changes', `"${itemName}" was not approved. Reason: ${reason}`, 'product_rejected')
  }
}
