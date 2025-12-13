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
    // Get authenticated user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract JWT token from Bearer header
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user authentication by passing the token directly
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { fingerprint, sessionId, routeDistance, routeUnit, startLocation } = await req.json();
    
    // Validate inputs - log details server-side, return generic message to client
    if (!fingerprint || !sessionId || !routeDistance || !routeUnit || !startLocation) {
      console.error('Missing required parameters', { fingerprint: !!fingerprint, sessionId: !!sessionId, routeDistance: !!routeDistance, routeUnit: !!routeUnit, startLocation: !!startLocation })
      throw new Error('Invalid request')
    }
    
    if (typeof fingerprint !== 'string' || fingerprint.length < 10 || fingerprint.length > 100) {
      console.error('Invalid fingerprint format')
      throw new Error('Invalid request')
    }
    
    if (typeof sessionId !== 'string' || sessionId.length > 100) {
      console.error('Invalid session ID')
      throw new Error('Invalid request')
    }
    
    if (typeof routeDistance !== 'number' || routeDistance <= 0 || routeDistance > 500) {
      console.error('Invalid route distance:', routeDistance)
      throw new Error('Invalid request')
    }
    
    if (!['km', 'miles'].includes(routeUnit)) {
      console.error('Invalid route unit:', routeUnit)
      throw new Error('Invalid request')
    }
    
    if (typeof startLocation !== 'string' || startLocation.length > 200) {
      console.error('Invalid start location length')
      throw new Error('Invalid request')
    }
    
    const ipAddress = req.headers.get('x-forwarded-for') || 
                      req.headers.get('x-real-ip') || 
                      'unknown';
    
    const userAgent = req.headers.get('user-agent') || 'unknown';
    
    // Use server-verified user.id - RLS will enforce auth.uid() = user_id
    const { error } = await supabase
      .from('route_generations')
      .insert({
        user_id: user.id,
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
