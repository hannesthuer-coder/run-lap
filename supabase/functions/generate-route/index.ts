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
    
    const MAPBOX_TOKEN = "pk.eyJ1IjoiaGFubmVzdGh1ciIsImEiOiJjbWVmaTB3eHMxMHkyMmxzZnUxb3hhM2NuIn0.HXWWHQcsYrtdkiw5cCwNhQ"
    
    // Convert distance to meters
    const distanceInMeters = unit === 'km' ? distance * 1000 : distance * 1609.34
    
    // Generate waypoints for a loop route
    const numWaypoints = 4
    const radius = Math.sqrt(distanceInMeters / (2 * Math.PI)) * 0.01 // Rough conversion to degrees
    
    const waypoints = []
    for (let i = 0; i < numWaypoints; i++) {
      const angle = (i / numWaypoints) * 2 * Math.PI
      const lat = startLat + radius * Math.cos(angle)
      const lng = startLng + radius * Math.sin(angle)
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