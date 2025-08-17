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
    const targetDistanceMeters = unit === 'km' ? distance * 1000 : distance * 1609.34
    
    // Function to generate waypoints with given radius
    const generateWaypoints = (radius) => {
      const numWaypoints = 4 // Fewer waypoints for simpler routes
      const waypoints = []
      
      for (let i = 0; i < numWaypoints; i++) {
        const angle = (i / numWaypoints) * 2 * Math.PI
        // Add some variation for natural routes
        const radiusVariation = radius * (0.8 + Math.random() * 0.4)
        const lat = startLat + radiusVariation * Math.cos(angle)
        const lng = startLng + radiusVariation * Math.sin(angle)
        waypoints.push([lng, lat])
      }
      
      // Add start point at the end to complete the loop
      waypoints.push([startLng, startLat])
      return waypoints
    }
    
    // Function to fetch route from Mapbox
    const fetchRoute = async (waypoints) => {
      const coordinates = `${startLng},${startLat};` + waypoints.map(w => `${w[0]},${w[1]}`).join(';')
      const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinates}?geometries=geojson&access_token=${MAPBOX_TOKEN}&overview=full&steps=true`
      
      const response = await fetch(directionsUrl)
      const data = await response.json()
      
      if (!data.routes || data.routes.length === 0) {
        return null
      }
      
      return data.routes[0]
    }
    
    // Iterative approach to find the right distance
    let bestRoute = null
    let bestWaypoints = null
    let bestDistanceDiff = Infinity
    const tolerance = targetDistanceMeters * 0.15 // 15% tolerance
    
    // Conservative initial radius (roughly distance / (2 * pi) in degrees)
    let radius = (targetDistanceMeters / (2 * Math.PI)) * 0.000009 // Convert meters to degrees
    const maxAttempts = 8
    
    console.log(`Target distance: ${targetDistanceMeters}m, Starting radius: ${radius}`)
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const waypoints = generateWaypoints(radius)
      const route = await fetchRoute(waypoints)
      
      if (!route) {
        console.log(`Attempt ${attempt + 1}: No route found`)
        radius *= 0.8 // Try smaller radius
        continue
      }
      
      const routeDistance = route.distance
      const distanceDiff = Math.abs(routeDistance - targetDistanceMeters)
      
      console.log(`Attempt ${attempt + 1}: Route distance: ${routeDistance}m, Target: ${targetDistanceMeters}m, Diff: ${distanceDiff}m`)
      
      // Keep track of the best route so far
      if (distanceDiff < bestDistanceDiff) {
        bestRoute = route
        bestWaypoints = waypoints
        bestDistanceDiff = distanceDiff
      }
      
      // If we're within tolerance, use this route
      if (distanceDiff <= tolerance) {
        console.log(`Found acceptable route on attempt ${attempt + 1}`)
        break
      }
      
      // Adjust radius for next attempt
      if (routeDistance < targetDistanceMeters) {
        radius *= 1.3 // Increase radius if route is too short
      } else {
        radius *= 0.7 // Decrease radius if route is too long
      }
    }
    
    if (!bestRoute) {
      throw new Error('Could not generate a suitable route')
    }
    
    console.log(`Final route distance: ${bestRoute.distance}m vs target: ${targetDistanceMeters}m`)
    const route = bestRoute
    const waypoints = bestWaypoints
    
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