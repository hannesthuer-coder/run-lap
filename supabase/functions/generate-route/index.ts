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
    
    // Function to generate waypoints that create varied, smooth loops
    const generateWaypoints = (baseRadius, seed = Math.random()) => {
      const numWaypoints = 3 + Math.floor(seed * 3) // 3-5 waypoints for smoother routes
      const waypoints = []
      
      // Create multiple possible route patterns
      const patterns = [
        // Circular with variations
        (i, total, radius, seedOffset) => {
          const angle = (seedOffset + i / total) * 2 * Math.PI
          const radiusVar = radius * (0.7 + (Math.sin(angle * 3 + seedOffset * 10) * 0.4))
          return [
            startLng + radiusVar * Math.cos(angle),
            startLat + radiusVar * Math.sin(angle)
          ]
        },
        // Figure-8 pattern
        (i, total, radius, seedOffset) => {
          const t = (i / total) * 2 * Math.PI
          const scale = radius * (0.8 + seedOffset * 0.4)
          return [
            startLng + scale * Math.sin(t),
            startLat + scale * Math.sin(t) * Math.cos(t)
          ]
        },
        // Irregular polygon
        (i, total, radius, seedOffset) => {
          const baseAngle = (i / total) * 2 * Math.PI
          const angleJitter = (Math.sin(seedOffset * 20 + i) * 0.5)
          const angle = baseAngle + angleJitter
          const radiusJitter = radius * (0.6 + Math.abs(Math.sin(seedOffset * 15 + i * 2)) * 0.6)
          return [
            startLng + radiusJitter * Math.cos(angle),
            startLat + radiusJitter * Math.sin(angle)
          ]
        }
      ]
      
      // Select random pattern
      const pattern = patterns[Math.floor(seed * patterns.length)]
      
      // Generate waypoints using selected pattern
      for (let i = 0; i < numWaypoints; i++) {
        const point = pattern(i, numWaypoints, baseRadius, seed)
        waypoints.push(point)
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
    
    // Enforce 200m tolerance as requested
    let bestRoute = null
    let bestWaypoints = null
    let bestDistanceDiff = Infinity
    const tolerance = 200 // 200m tolerance as requested
    const maxAttempts = 6 // More attempts to find good distance match
    
    // Base radius on target distance
    let radius = (targetDistanceMeters / (2 * Math.PI)) * 0.000011
    
    // Generate a unique seed based on timestamp and random for maximum variation
    const routeSeed = (Date.now() % 10000) / 10000 + Math.random()
    
    console.log(`Target distance: ${targetDistanceMeters}m, Tolerance: ${tolerance}m, Starting radius: ${radius}, Seed: ${routeSeed}`)
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Create different seeds for each attempt for variety
      const attemptSeed = (routeSeed + attempt * 0.2) % 1
      const waypoints = generateWaypoints(radius, attemptSeed)
      const route = await fetchRoute(waypoints)
      
      if (!route) {
        console.log(`Attempt ${attempt + 1}: No route found`)
        radius *= 0.85 // Adjust radius
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
      
      // If we're within 200m tolerance, use this route
      if (distanceDiff <= tolerance) {
        console.log(`Found acceptable route within ${tolerance}m tolerance on attempt ${attempt + 1}`)
        break
      }
      
      // Adjust radius based on distance difference
      if (routeDistance < targetDistanceMeters) {
        radius *= 1.2 // Increase radius if route is too short
      } else {
        radius *= 0.8 // Decrease radius if route is too long
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