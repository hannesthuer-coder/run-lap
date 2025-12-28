import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, updating unsubscribed state");
      // Sync profiles table - mark as free
      await supabaseClient
        .from('profiles')
        .update({
          subscription_status: 'free',
          stripe_customer_id: null,
          stripe_subscription_id: null,
          subscription_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Check for both active and trialing subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 10,
    });
    
    // Find active or trialing subscription
    const activeSubscription = subscriptions.data.find(
      sub => sub.status === "active" || sub.status === "trialing"
    );
    
    const hasActiveSub = !!activeSubscription;
    let productId = null;
    let subscriptionEnd = null;
    let stripeSubscriptionId = null;
    let isTrialing = false;
    let trialEndsAt = null;

    if (hasActiveSub && activeSubscription) {
      const subscription = activeSubscription;
      stripeSubscriptionId = subscription.id;
      isTrialing = subscription.status === "trialing";
      
      // Handle trial end date
      if (isTrialing && subscription.trial_end) {
        try {
          trialEndsAt = new Date(subscription.trial_end * 1000).toISOString();
        } catch (e) {
          logStep("Warning: Could not parse trial end date", { raw: subscription.trial_end });
        }
      }
      
      // Safely handle subscription end date - current_period_end is a Unix timestamp
      if (subscription.current_period_end) {
        try {
          subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
        } catch (e) {
          logStep("Warning: Could not parse subscription end date", { raw: subscription.current_period_end });
        }
      }
      
      logStep("Subscription found", { 
        subscriptionId: subscription.id, 
        status: subscription.status,
        isTrialing,
        trialEndsAt,
        endDate: subscriptionEnd 
      });
      
      productId = subscription.items.data[0].price.product as string;
      logStep("Determined subscription tier", { productId });
      
      // Sync profiles table with premium status (trialing counts as premium)
      const { error: updateError } = await supabaseClient
        .from('profiles')
        .update({
          subscription_status: 'premium',
          stripe_customer_id: customerId,
          stripe_subscription_id: stripeSubscriptionId,
          subscription_expires_at: isTrialing ? trialEndsAt : subscriptionEnd,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      
      if (updateError) {
        logStep("Warning: Failed to sync profile", { error: updateError.message });
      } else {
        logStep("Profile synced with premium status");
      }
    } else {
      logStep("No active subscription found");
      // Sync profiles table - mark as free
      await supabaseClient
        .from('profiles')
        .update({
          subscription_status: 'free',
          stripe_customer_id: customerId,
          stripe_subscription_id: null,
          subscription_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      product_id: productId,
      subscription_end: subscriptionEnd,
      is_trialing: isTrialing,
      trial_ends_at: trialEndsAt
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
