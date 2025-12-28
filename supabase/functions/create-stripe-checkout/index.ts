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

// Rate limit: 10 calls per hour per IP (stricter for checkout)
const RATE_LIMIT = 10;
const RATE_WINDOW_SECONDS = 3600;

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

async function checkRateLimit(supabase: any, ipAddress: string, endpoint: string): Promise<{ allowed: boolean; remaining: number }> {
  const windowStart = new Date(Math.floor(Date.now() / (RATE_WINDOW_SECONDS * 1000)) * (RATE_WINDOW_SECONDS * 1000)).toISOString();
  
  try {
    // Try to get existing rate limit record
    const { data: existing, error: selectError } = await supabase
      .from('rate_limits')
      .select('call_count')
      .eq('ip_address', ipAddress)
      .eq('endpoint', endpoint)
      .eq('window_start', windowStart)
      .single();
    
    if (selectError && selectError.code !== 'PGRST116') {
      console.error('Rate limit check error:', selectError);
      return { allowed: true, remaining: RATE_LIMIT };
    }
    
    if (existing) {
      if (existing.call_count >= RATE_LIMIT) {
        return { allowed: false, remaining: 0 };
      }
      
      await supabase
        .from('rate_limits')
        .update({ call_count: existing.call_count + 1 })
        .eq('ip_address', ipAddress)
        .eq('endpoint', endpoint)
        .eq('window_start', windowStart);
      
      return { allowed: true, remaining: RATE_LIMIT - existing.call_count - 1 };
    } else {
      await supabase
        .from('rate_limits')
        .insert({
          ip_address: ipAddress,
          endpoint: endpoint,
          call_count: 1,
          window_start: windowStart
        });
      
      return { allowed: true, remaining: RATE_LIMIT - 1 };
    }
  } catch (error) {
    console.error('Rate limit error:', error);
    return { allowed: true, remaining: RATE_LIMIT };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                    req.headers.get('x-real-ip') || 
                    'unknown';

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role for rate limiting
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Check rate limit
    const { allowed, remaining } = await checkRateLimit(supabaseAdmin, ipAddress, 'create-stripe-checkout');
    
    if (!allowed) {
      logStep("Rate limit exceeded", { ipAddress });
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': '0',
            'Retry-After': String(RATE_WINDOW_SECONDS)
          } 
        }
      );
    }

    const { email, plan = 'monthly' } = await req.json();
    logStep("Request received", { email: email ? '[redacted]' : null, plan });
    
    // Validate email input
    if (!email || typeof email !== 'string') {
      throw new Error('Email is required');
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || email.length > 255) {
      throw new Error('Invalid email format');
    }

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
      subscription_data: {
        trial_period_days: 14,
      },
      success_url: `${req.headers.get('origin')}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin')}/?canceled=true`,
      metadata: {
        email,
        plan,
      },
    });
    
    logStep("Checkout session created", { sessionId: session.id });
    
    return new Response(
      JSON.stringify({ sessionUrl: session.url }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': String(remaining)
        } 
      }
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
