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
    const { fingerprint, sessionId, userId, routeDistance, routeUnit, startLocation } = await req.json();
    
    // Validate inputs
    if (!fingerprint || !sessionId || !routeDistance || !routeUnit || !startLocation) {
      throw new Error('Missing required parameters')
    }
    
    if (typeof fingerprint !== 'string' || fingerprint.length < 10 || fingerprint.length > 100) {
      throw new Error('Invalid fingerprint format')
    }
    
    if (typeof sessionId !== 'string' || sessionId.length > 100) {
      throw new Error('Invalid session ID')
    }
    
    if (typeof routeDistance !== 'number' || routeDistance <= 0 || routeDistance > 500) {
      throw new Error('Invalid route distance')
    }
    
    if (!['km', 'miles'].includes(routeUnit)) {
      throw new Error('Invalid route unit')
    }
    
    if (typeof startLocation !== 'string' || startLocation.length > 200) {
      throw new Error('Invalid start location')
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const ipAddress = req.headers.get('x-forwarded-for') || 
                      req.headers.get('x-real-ip') || 
                      'unknown';
    
    const userAgent = req.headers.get('user-agent') || 'unknown';
    
    const { error } = await supabase
      .from('route_generations')
      .insert({
        user_id: userId,
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
