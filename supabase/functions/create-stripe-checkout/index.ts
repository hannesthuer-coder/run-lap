import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Price IDs for subscription plans
const PRICE_IDS = {
  monthly: 'price_1SbNQ7AzbZd33OOHHnPiHzBf', // $3/month
  annual: 'price_1SbNQRAzbZd33OOHQpxXXCYL',  // $30/year
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Request received");
    
    // Authenticate user via JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user?.email) {
      logStep("Authentication failed", { error: authError?.message });
      throw new Error('Authentication required');
    }
    
    logStep("User authenticated", { userId: user.id, email: user.email });
    
    // Use the verified email from the authenticated session
    const email = user.email;
    
    // Get plan from request body
    const body = await req.json().catch(() => ({}));
    const plan = body.plan || 'monthly';

    // Validate plan
    if (!['monthly', 'annual'].includes(plan)) {
      throw new Error('Invalid plan. Must be "monthly" or "annual"');
    }
    
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('Stripe not configured');
    }
    logStep("Stripe key verified");
    
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2025-08-27.basil',
    });
    
    let customer;
    const existingCustomers = await stripe.customers.list({ email, limit: 1 });
    
    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
      logStep("Found existing customer", { customerId: customer.id });
    } else {
      customer = await stripe.customers.create({ email });
      logStep("Created new customer", { customerId: customer.id });
    }

    const priceId = PRICE_IDS[plan as keyof typeof PRICE_IDS];
    logStep("Using price", { plan, priceId });
    
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${req.headers.get('origin')}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin')}/?canceled=true`,
      metadata: {
        email,
        plan,
        user_id: user.id,
      },
    });
    
    logStep("Checkout session created", { sessionId: session.id, url: session.url });
    
    return new Response(
      JSON.stringify({ sessionUrl: session.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
