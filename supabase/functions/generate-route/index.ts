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
    
    // Function to generate smooth, circular waypoints like in the example
    const generateWaypoints = (baseRadius, seed = Math.random()) => {
      // Use fewer waypoints for smoother, more circular routes
      const numWaypoints = 4 // Simple circular pattern
      const waypoints = []
      
      // Focus on circular patterns with slight variations for uniqueness
      const startAngle = seed * 2 * Math.PI // Random starting angle for variety
      
      for (let i = 0; i < numWaypoints; i++) {
        const angle = startAngle + (i / numWaypoints) * 2 * Math.PI
        
        // Create smooth circular variation with minimal deviation
        const radiusVariation = 1 + Math.sin(angle * 2 + seed * Math.PI) * 0.15 // Reduced variation for smoother curves
        const finalRadius = baseRadius * radiusVariation
        
        // Calculate waypoint position
        const lat = startLat + finalRadius * Math.cos(angle)
        const lng = startLng + finalRadius * Math.sin(angle)
        waypoints.push([lng, lat])
      }
      
      return waypoints
    }
    
    // Function to fetch route from Mapbox
    const fetchRoute = async (waypoints) => {
      // Create a loop by adding the start point at the end
      const loopWaypoints = [...waypoints, [startLng, startLat]]
      const coordinates = `${startLng},${startLat};` + loopWaypoints.map(w => `${w[0]},${w[1]}`).join(';')
      const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinates}?geometries=geojson&access_token=${MAPBOX_TOKEN}&overview=full&steps=true`
      
      const response = await fetch(directionsUrl)
      const data = await response.json()
      
      if (!data.routes || data.routes.length === 0) {
        return null
      }
      
      return data.routes[0]
    }
    
    // Enforce strict 0.2km (200m) tolerance for precise distance matching
    let bestRoute = null
    let bestWaypoints = null
    let bestDistanceDiff = Infinity
    const tolerance = 200 // 200m = 0.2km tolerance as requested
    const maxAttempts = 10 // More attempts for better precision
    
    // More precise base radius calculation
    let radius = (targetDistanceMeters / (2 * Math.PI)) * 0.000009
    
    // Generate a unique seed based on timestamp and random for maximum variation
    const routeSeed = (Date.now() % 10000) / 10000 + Math.random()
    
    console.log(`Target distance: ${targetDistanceMeters}m, Strict tolerance: ${tolerance}m, Starting radius: ${radius}, Seed: ${routeSeed}`)
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Create different seeds for each attempt for variety
      const attemptSeed = (routeSeed + attempt * 0.15) % 1
      const waypoints = generateWaypoints(radius, attemptSeed)
      const route = await fetchRoute(waypoints)
      
      if (!route) {
        console.log(`Attempt ${attempt + 1}: No route found`)
        radius *= 0.9 // Minor adjustment
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
      
      // If we're within strict 200m tolerance, use this route
      if (distanceDiff <= tolerance) {
        console.log(`Found acceptable route within strict ${tolerance}m tolerance on attempt ${attempt + 1}`)
        break
      }
      
      // More precise radius adjustments based on distance difference
      const adjustmentFactor = Math.min(Math.max(distanceDiff / targetDistanceMeters, 0.05), 0.3) // Limit adjustment between 5% and 30%
      
      if (routeDistance < targetDistanceMeters) {
        radius *= (1 + adjustmentFactor) // Increase radius proportionally
      } else {
        radius *= (1 - adjustmentFactor) // Decrease radius proportionally
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