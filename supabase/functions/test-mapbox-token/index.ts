import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Test function called');
    
    const MAPBOX_TOKEN = Deno.env.get('MAPBOX_ACCESS_TOKEN')
    console.log('Token exists:', !!MAPBOX_TOKEN);
    console.log('Token prefix:', MAPBOX_TOKEN?.substring(0, 10));
    
    if (!MAPBOX_TOKEN) {
      console.error('MAPBOX_ACCESS_TOKEN not found in environment');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Token not configured',
          envVars: Object.keys(Deno.env.toObject()).filter(key => key.includes('MAPBOX'))
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        tokenExists: true,
        tokenPrefix: MAPBOX_TOKEN.substring(0, 10),
        message: 'Token configured successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
    
  } catch (error) {
    console.error('Error in test function:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})