import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Try to get authenticated user (optional for anonymous users)
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    
    if (authHeader) {
      const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } }
      });
      
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (!authError && user) {
        userId = user.id;
        console.log('Recording route for authenticated user:', userId);
      }
    }

    const { fingerprint, sessionId, routeDistance, routeUnit, startLocation } = await req.json();
    
    // Validate inputs
    if (!fingerprint || !sessionId || !routeDistance || !routeUnit || !startLocation) {
      console.error('Missing required parameters', { 
        fingerprint: !!fingerprint, 
        sessionId: !!sessionId, 
        routeDistance: !!routeDistance, 
        routeUnit: !!routeUnit, 
        startLocation: !!startLocation 
      });
      throw new Error('Invalid request');
    }
    
    if (typeof fingerprint !== 'string' || fingerprint.length < 10 || fingerprint.length > 100) {
      console.error('Invalid fingerprint format');
      throw new Error('Invalid request');
    }
    
    if (typeof sessionId !== 'string' || sessionId.length > 100) {
      console.error('Invalid session ID');
      throw new Error('Invalid request');
    }
    
    if (typeof routeDistance !== 'number' || routeDistance <= 0 || routeDistance > 500) {
      console.error('Invalid route distance:', routeDistance);
      throw new Error('Invalid request');
    }
    
    if (!['km', 'miles'].includes(routeUnit)) {
      console.error('Invalid route unit:', routeUnit);
      throw new Error('Invalid request');
    }
    
    if (typeof startLocation !== 'string' || startLocation.length > 200) {
      console.error('Invalid start location length');
      throw new Error('Invalid request');
    }
    
    const ipAddress = req.headers.get('x-forwarded-for') || 
                      req.headers.get('x-real-ip') || 
                      'unknown';
    
    const userAgent = req.headers.get('user-agent') || 'unknown';
    
    // Use service role to bypass RLS for anonymous users
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { error } = await supabaseAdmin
      .from('route_generations')
      .insert({
        user_id: userId, // Can be null for anonymous users
        device_fingerprint: fingerprint,
        ip_address: ipAddress,
        user_agent: userAgent,
        route_distance: routeDistance,
        route_unit: routeUnit,
        start_location: startLocation,
        session_id: sessionId,
      });
    
    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    
    console.log('Route generation recorded successfully', { userId: userId || 'anonymous', fingerprint });
    
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
