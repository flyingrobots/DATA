// Webhook handler for donation events
// This Edge Function processes donation-related webhooks and updates the database

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0"

interface WebhookPayload {
  event_type: 'donation.created' | 'donation.completed' | 'donation.failed' | 'donation.refunded'
  donation_id: string
  campaign_id: string
  amount: number
  donor_email?: string
  metadata?: Record<string, any>
}

serve(async (req: Request) => {
  try {
    // Verify webhook signature (if configured)
    const signature = req.headers.get('x-webhook-signature')
    if (signature && !await verifySignature(req, signature)) {
      return new Response('Invalid signature', { status: 401 })
    }

    const payload: WebhookPayload = await req.json()
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration')
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Process webhook based on event type
    let result
    switch (payload.event_type) {
      case 'donation.created':
        // Log new donation
        console.log(`New donation created: ${payload.donation_id}`)
        
        // Send confirmation email (via another Edge Function)
        await fetch(`${supabaseUrl}/functions/v1/send-receipt`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            donation_id: payload.donation_id,
            type: 'confirmation'
          })
        })
        break
        
      case 'donation.completed':
        // Update donation status and campaign totals
        const { data, error } = await supabase.rpc('complete_donation', {
          p_donation_id: payload.donation_id,
          p_net_amount: payload.amount * 0.97 // 3% platform fee
        })
        
        if (error) throw error
        result = data
        
        // Trigger receipt email
        await fetch(`${supabaseUrl}/functions/v1/send-receipt`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            donation_id: payload.donation_id,
            type: 'receipt'
          })
        })
        break
        
      case 'donation.failed':
        // Update donation status to failed
        const { error: failError } = await supabase
          .from('donations')
          .update({ 
            status: 'failed',
            failed_at: new Date().toISOString(),
            metadata: payload.metadata
          })
          .eq('id', payload.donation_id)
        
        if (failError) throw failError
        break
        
      case 'donation.refunded':
        // Process refund
        const { data: refundData, error: refundError } = await supabase.rpc('refund_donation', {
          p_donation_id: payload.donation_id,
          p_refund_amount: payload.amount,
          p_reason: payload.metadata?.reason || 'Customer requested'
        })
        
        if (refundError) throw refundError
        result = refundData
        break
        
      default:
        return new Response(
          JSON.stringify({ error: 'Unknown event type' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
    }
    
    // Log successful processing
    console.log(`Processed ${payload.event_type} for donation ${payload.donation_id}`)
    
    return new Response(
      JSON.stringify({ 
        success: true,
        event_type: payload.event_type,
        donation_id: payload.donation_id,
        result
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )
    
  } catch (error) {
    console.error('Webhook processing error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})

// Helper function to verify webhook signatures
async function verifySignature(req: Request, signature: string): Promise<boolean> {
  const secret = Deno.env.get('WEBHOOK_SECRET')
  if (!secret) return true // Skip verification if no secret configured
  
  const body = await req.text()
  const encoder = new TextEncoder()
  const data = encoder.encode(body)
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
  
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, data)
  const computedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
  
  return computedSignature === signature
}