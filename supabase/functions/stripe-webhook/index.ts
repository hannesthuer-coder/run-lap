import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import Stripe from 'https://esm.sh/stripe@14.21.0';

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')!;
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
  
  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret);
    
    // Check for duplicate event processing (replay protection)
    const { data: existingEvent } = await supabase
      .from('processed_webhook_events')
      .select('id')
      .eq('stripe_event_id', event.id)
      .single();
    
    if (existingEvent) {
      console.log(`Duplicate webhook event detected: ${event.id}`);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Validate event timestamp (reject events older than 5 minutes)
    const eventAge = Date.now() / 1000 - event.created;
    if (eventAge > 300) {
      console.warn(`Rejecting old webhook event: ${event.id} (age: ${eventAge}s)`);
      return new Response(JSON.stringify({ received: true, rejected: 'event_too_old' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Record event as being processed
    const { error: insertError } = await supabase
      .from('processed_webhook_events')
      .insert({ 
        stripe_event_id: event.id, 
        event_type: event.type,
        processed_at: new Date().toISOString() 
      });
    
    if (insertError) {
      // If insert fails due to unique constraint, it's a race condition duplicate
      if (insertError.code === '23505') {
        console.log(`Race condition duplicate detected: ${event.id}`);
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      console.error('Error recording webhook event:', insertError);
    }
    
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const email = session.customer_details?.email || session.metadata?.email;
        
        if (!email) break;
        
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email,
          email_confirm: true,
        });
        
        if (authError && !authError.message.includes('already registered')) {
          console.error('Error creating user:', authError);
          break;
        }
        
        const userId = authData?.user?.id;
        
        await supabase.from('profiles').upsert({
          id: userId,
          email,
          subscription_status: 'premium',
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          subscription_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
        
        break;
      }
      
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_subscription_id', subscription.id)
          .single();
        
        if (profile) {
          const status = subscription.status === 'active' ? 'premium' : 'expired';
          await supabase
            .from('profiles')
            .update({
              subscription_status: status,
              subscription_expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
            })
            .eq('id', profile.id);
        }
        
        break;
      }
    }
    
    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { status: 400 }
    );
  }
});
