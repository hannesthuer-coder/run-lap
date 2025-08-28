import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('get-mapbox-token function called at:', new Date().toISOString());
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const mapboxToken = Deno.env.get('MAPBOX_ACCESS_TOKEN');
    
    console.log('Checking for MAPBOX_ACCESS_TOKEN:', mapboxToken ? 'Token found' : 'Token not found');
    
    if (!mapboxToken) {
      console.error('MAPBOX_ACCESS_TOKEN environment variable is not set');
      throw new Error('Mapbox token not configured');
    }

    return new Response(JSON.stringify({ 
      success: true, 
      token: mapboxToken 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error getting Mapbox token:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});