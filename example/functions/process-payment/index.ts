// Payment processing Edge Function
// Handles payment intent creation and processing via Stripe

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

interface PaymentRequest {
  donation_id: string;
  amount: number;
  currency: string;
  campaign_id: string;
  donor_email?: string;
  donor_name?: string;
  payment_method_id?: string;
}

serve(async (req: Request) => {
  // Enable CORS for browser requests
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response("Unauthorized", { status: 401 });
    }

    const payload: PaymentRequest = await req.json();

    // Validate required fields
    if (!payload.donation_id || !payload.amount || !payload.campaign_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("Stripe configuration missing");
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
      typescript: true,
    });

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get campaign details for metadata
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("title, organization_id")
      .eq("id", payload.campaign_id)
      .single();

    if (campaignError) {
      throw new Error(`Campaign not found: ${campaignError.message}`);
    }

    // Create or retrieve customer
    let customer;
    if (payload.donor_email) {
      const customers = await stripe.customers.list({
        email: payload.donor_email,
        limit: 1,
      });

      if (customers.data.length > 0) {
        customer = customers.data[0];
      } else {
        customer = await stripe.customers.create({
          email: payload.donor_email,
          name: payload.donor_name,
          metadata: {
            donation_id: payload.donation_id,
            campaign_id: payload.campaign_id,
          },
        });
      }
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(payload.amount * 100), // Convert to cents
      currency: payload.currency || "usd",
      customer: customer?.id,
      payment_method: payload.payment_method_id,
      confirmation_method: "automatic",
      confirm: !!payload.payment_method_id,
      metadata: {
        donation_id: payload.donation_id,
        campaign_id: payload.campaign_id,
        campaign_title: campaign.title,
        organization_id: campaign.organization_id,
      },
      description: `Donation to ${campaign.title}`,
      statement_descriptor_suffix: "DONATION",
    });

    // Update donation record with payment intent ID
    const { error: updateError } = await supabase
      .from("donations")
      .update({
        payment_intent_id: paymentIntent.id,
        status: "processing",
        processed_at: new Date().toISOString(),
      })
      .eq("id", payload.donation_id);

    if (updateError) {
      // Log error but don't fail the payment
      console.error("Failed to update donation record:", updateError);
    }

    // Return client secret for frontend confirmation
    return new Response(
      JSON.stringify({
        success: true,
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error) {
    console.error("Payment processing error:", error);

    // Check if it's a Stripe error
    if (error.type === "StripeCardError") {
      return new Response(
        JSON.stringify({
          error: error.message,
          type: "card_error",
          code: error.code,
          decline_code: error.decline_code,
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // Generic error response
    return new Response(
      JSON.stringify({
        error: error.message || "Payment processing failed",
        type: "api_error",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
});
