// Email receipt sender Edge Function
// Sends donation confirmation and receipt emails

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0"

interface EmailRequest {
  donation_id: string
  type: 'confirmation' | 'receipt' | 'refund'
  custom_message?: string
}

interface DonationDetails {
  id: string
  amount: number
  currency_code: string
  donor_email: string
  donor_name: string
  message?: string
  created_at: string
  completed_at?: string
  campaign: {
    title: string
    organization: {
      name: string
      tax_id?: string
      is_tax_exempt: boolean
    }
  }
}

serve(async (req: Request) => {
  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401 })
    }
    
    const payload: EmailRequest = await req.json()
    
    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing')
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Get donation details
    const { data: donation, error: donationError } = await supabase
      .from('donations')
      .select(`
        id,
        amount,
        currency_code,
        donor_email,
        donor_name,
        message,
        created_at,
        completed_at,
        campaign:campaigns(
          title,
          organization:organizations(
            name,
            tax_id,
            is_tax_exempt
          )
        )
      `)
      .eq('id', payload.donation_id)
      .single()
    
    if (donationError || !donation) {
      throw new Error(`Donation not found: ${donationError?.message}`)
    }
    
    // Skip if no email address
    if (!donation.donor_email) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No email address provided, skipping email' 
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    // Generate email content based on type
    const emailContent = generateEmailContent(payload.type, donation as DonationDetails, payload.custom_message)
    
    // Send email using your preferred email service
    // This example uses a generic email API endpoint
    const emailServiceUrl = Deno.env.get('EMAIL_SERVICE_URL')
    const emailApiKey = Deno.env.get('EMAIL_API_KEY')
    
    if (!emailServiceUrl || !emailApiKey) {
      // Log but don't fail if email service not configured
      console.warn('Email service not configured, skipping email send')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Email service not configured' 
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    const emailResponse = await fetch(emailServiceUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${emailApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: donation.donor_email,
        from: 'donations@example.org',
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        replyTo: 'support@example.org',
        tags: ['donation', payload.type]
      })
    })
    
    if (!emailResponse.ok) {
      const error = await emailResponse.text()
      throw new Error(`Email service error: ${error}`)
    }
    
    // Log email sent
    console.log(`Sent ${payload.type} email for donation ${payload.donation_id} to ${donation.donor_email}`)
    
    // Record email sent in database
    const { error: logError } = await supabase
      .from('email_logs')
      .insert({
        recipient: donation.donor_email,
        type: `donation_${payload.type}`,
        subject: emailContent.subject,
        donation_id: payload.donation_id,
        sent_at: new Date().toISOString()
      })
    
    if (logError) {
      console.error('Failed to log email:', logError)
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        email_sent_to: donation.donor_email,
        type: payload.type
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )
    
  } catch (error) {
    console.error('Email sending error:', error)
    
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

function generateEmailContent(
  type: 'confirmation' | 'receipt' | 'refund',
  donation: DonationDetails,
  customMessage?: string
): { subject: string; html: string; text: string } {
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(amount)
  }
  
  const formattedAmount = formatCurrency(donation.amount, donation.currency_code)
  const donorName = donation.donor_name || 'Valued Donor'
  
  switch (type) {
    case 'confirmation':
      return {
        subject: `Thank you for your donation to ${donation.campaign.title}`,
        html: `
          <h2>Thank you for your generosity!</h2>
          <p>Dear ${donorName},</p>
          <p>We've received your donation of <strong>${formattedAmount}</strong> to <strong>${donation.campaign.title}</strong>.</p>
          <p>Your donation is being processed and you'll receive a receipt once it's complete.</p>
          ${donation.message ? `<p>Your message: <em>"${donation.message}"</em></p>` : ''}
          ${customMessage ? `<p>${customMessage}</p>` : ''}
          <p>Thank you for supporting ${donation.campaign.organization.name}!</p>
          <hr>
          <p><small>Donation ID: ${donation.id}</small></p>
        `,
        text: `Thank you for your donation!\n\nDear ${donorName},\n\nWe've received your donation of ${formattedAmount} to ${donation.campaign.title}.\n\nYour donation is being processed and you'll receive a receipt once it's complete.\n\n${donation.message ? `Your message: "${donation.message}"\n\n` : ''}Thank you for supporting ${donation.campaign.organization.name}!\n\nDonation ID: ${donation.id}`
      }
      
    case 'receipt':
      const receiptDate = new Date(donation.completed_at || donation.created_at).toLocaleDateString()
      const taxInfo = donation.campaign.organization.is_tax_exempt 
        ? `<p><strong>Tax Information:</strong> ${donation.campaign.organization.name} is a tax-exempt organization. Tax ID: ${donation.campaign.organization.tax_id || 'N/A'}</p>`
        : ''
        
      return {
        subject: `Receipt for your donation to ${donation.campaign.title}`,
        html: `
          <h2>Donation Receipt</h2>
          <p>Dear ${donorName},</p>
          <p>Thank you for your generous donation!</p>
          <h3>Donation Details</h3>
          <table style="border-collapse: collapse; width: 100%;">
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Amount:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${formattedAmount}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Date:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${receiptDate}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Campaign:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${donation.campaign.title}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Organization:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${donation.campaign.organization.name}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Transaction ID:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${donation.id}</td></tr>
          </table>
          ${taxInfo}
          ${customMessage ? `<p>${customMessage}</p>` : ''}
          <p>Please keep this receipt for your records.</p>
          <hr>
          <p><small>This is an official receipt for your donation.</small></p>
        `,
        text: `Donation Receipt\n\nDear ${donorName},\n\nThank you for your generous donation!\n\nDonation Details:\n- Amount: ${formattedAmount}\n- Date: ${receiptDate}\n- Campaign: ${donation.campaign.title}\n- Organization: ${donation.campaign.organization.name}\n- Transaction ID: ${donation.id}\n\n${donation.campaign.organization.is_tax_exempt ? `Tax Information: ${donation.campaign.organization.name} is a tax-exempt organization. Tax ID: ${donation.campaign.organization.tax_id || 'N/A'}\n\n` : ''}Please keep this receipt for your records.\n\nThis is an official receipt for your donation.`
      }
      
    case 'refund':
      return {
        subject: `Refund processed for your donation to ${donation.campaign.title}`,
        html: `
          <h2>Refund Notification</h2>
          <p>Dear ${donorName},</p>
          <p>Your donation of <strong>${formattedAmount}</strong> to <strong>${donation.campaign.title}</strong> has been refunded.</p>
          <p>The refund should appear in your account within 5-10 business days.</p>
          ${customMessage ? `<p>Reason: ${customMessage}</p>` : ''}
          <p>If you have any questions, please contact our support team.</p>
          <hr>
          <p><small>Transaction ID: ${donation.id}</small></p>
        `,
        text: `Refund Notification\n\nDear ${donorName},\n\nYour donation of ${formattedAmount} to ${donation.campaign.title} has been refunded.\n\nThe refund should appear in your account within 5-10 business days.\n\n${customMessage ? `Reason: ${customMessage}\n\n` : ''}If you have any questions, please contact our support team.\n\nTransaction ID: ${donation.id}`
      }
      
    default:
      throw new Error(`Unknown email type: ${type}`)
  }
}