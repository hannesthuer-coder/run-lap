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
    
    // Simplified approach - focus on variety over exact distance
    let bestRoute = null
    let bestWaypoints = null
    const maxAttempts = 3 // Fewer attempts, more variety
    
    // Base radius on target distance but allow more flexibility
    let radius = (targetDistanceMeters / (2 * Math.PI)) * 0.000012 // Slightly larger base radius
    
    // Generate a unique seed based on timestamp and random for maximum variation
    const routeSeed = (Date.now() % 10000) / 10000 + Math.random()
    
    console.log(`Target distance: ${targetDistanceMeters}m, Starting radius: ${radius}, Seed: ${routeSeed}`)
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Create significantly different seeds for each attempt
      const attemptSeed = (routeSeed + attempt * 0.3333) % 1
      const waypoints = generateWaypoints(radius, attemptSeed)
      const route = await fetchRoute(waypoints)
      
      if (!route) {
        console.log(`Attempt ${attempt + 1}: No route found`)
        radius *= 0.9 // Slight adjustment
        continue
      }
      
      const routeDistance = route.distance
      console.log(`Attempt ${attempt + 1}: Route distance: ${routeDistance}m, Target: ${targetDistanceMeters}m`)
      
      // Accept any valid route - prioritize variety over exact distance
      bestRoute = route
      bestWaypoints = waypoints
      break // Take the first valid route to ensure variety
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