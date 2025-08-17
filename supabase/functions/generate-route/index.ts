import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { startLng, startLat, distance, unit } = await req.json()
    
    // Get Mapbox token from Supabase secrets
    const MAPBOX_TOKEN = Deno.env.get('MAPBOX_ACCESS_TOKEN')
    if (!MAPBOX_TOKEN) {
      throw new Error('Mapbox access token not configured')
    }
    
    // Convert distance to meters
    const distanceInMeters = unit === 'km' ? distance * 1000 : distance * 1609.34
    
    // Generate more varied waypoints for a realistic loop route
    const numWaypoints = 6
    const baseRadius = Math.sqrt(distanceInMeters / (2 * Math.PI)) * 0.008 // More precise conversion
    
    const waypoints = []
    for (let i = 0; i < numWaypoints; i++) {
      const angle = (i / numWaypoints) * 2 * Math.PI
      // Add some variation to radius for more natural routes
      const radiusVariation = baseRadius * (0.7 + Math.random() * 0.6)
      const lat = startLat + radiusVariation * Math.cos(angle)
      const lng = startLng + radiusVariation * Math.sin(angle)
      waypoints.push([lng, lat])
    }
    
    // Add start point at the end to complete the loop
    waypoints.push([startLng, startLat])
    
    // Build coordinates string for Mapbox Directions API
    const coordinates = `${startLng},${startLat};` + waypoints.map(w => `${w[0]},${w[1]}`).join(';')
    
    // Call Mapbox Directions API
    const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinates}?geometries=geojson&access_token=${MAPBOX_TOKEN}&overview=full&steps=true`
    
    const response = await fetch(directionsUrl)
    const data = await response.json()
    
    if (!data.routes || data.routes.length === 0) {
      throw new Error('No route found')
    }
    
    const route = data.routes[0]
    
    return new Response(
      JSON.stringify({
        success: true,
        route: {
          geometry: route.geometry,
          distance: route.distance,
          duration: route.duration,
          waypoints: waypoints
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
    
  } catch (error) {
    console.error('Error generating route:', error)
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