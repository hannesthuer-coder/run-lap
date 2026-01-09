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
    const MAPBOX_TOKEN = Deno.env.get('MAPBOX_ACCESS_TOKEN')
    
    if (!MAPBOX_TOKEN) {
      console.error('Mapbox token not configured in environment')
      throw new Error('Service configuration error')
    }
    
    console.log('Mapbox token requested')
    
    return new Response(
      JSON.stringify({
        success: true,
        token: MAPBOX_TOKEN
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
    
  } catch (error) {
    console.error('Error getting Mapbox token:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'An error occurred' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
