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
    const { startLat, startLng, distance, unit } = await req.json()
    
    // Get Mapbox token from Supabase secrets  
    const MAPBOX_TOKEN = Deno.env.get('MAPBOX_ACCESS_TOKEN')
    if (!MAPBOX_TOKEN) {
      throw new Error('Mapbox access token not configured')
    }
    
    // Convert distance to meters
    const targetDistanceMeters = unit === 'km' ? distance * 1000 : distance * 1609.34
    
    // Function to generate waypoints optimized for running loops
    const generateWaypoints = (baseRadius: number, seed = Math.random()) => {
      const numWaypoints = 3 + Math.floor(seed * 4) // 3-6 waypoints
      const waypoints = []
      
      const clockwise = seed > 0.5
      
      for (let i = 0; i < numWaypoints; i++) {
        const angle = (i / numWaypoints) * 2 * Math.PI * (clockwise ? 1 : -1)
        const radiusVariation = 0.8 + Math.sin(angle * 2 + seed * Math.PI) * 0.4
        const finalRadius = baseRadius * radiusVariation
        
        const lat = startLat + finalRadius * Math.cos(angle)
        const lng = startLng + finalRadius * Math.sin(angle)
        
        waypoints.push([lng, lat])
      }
      
      return waypoints
    }
    
    // Function to fetch route from Mapbox Directions API
    const fetchRoute = async (waypoints: number[][]) => {
      // Create coordinates string: start -> waypoints -> start (for loop)
      const allPoints = [[startLng, startLat], ...waypoints, [startLng, startLat]]
      const coordinates = allPoints.map(point => `${point[0]},${point[1]}`).join(';')
      
      const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinates}?` +
        `geometries=geojson&` +
        `overview=full&` +
        `steps=false&` +
        `access_token=${MAPBOX_TOKEN}`
      
      const response = await fetch(directionsUrl)
      const data = await response.json()
      
      if (!data.routes || data.routes.length === 0) {
        return null
      }
      
      return data.routes[0]
    }
    
    let bestRoute = null
    let bestDistanceDiff = Infinity
    const tolerance = 300 // 300m tolerance for better success rate
    const maxAttempts = 8
    
    // Calculate base radius more effectively for Mapbox
    let radius = Math.sqrt(targetDistanceMeters / Math.PI) * 0.0003
    const routeSeed = (Date.now() % 10000) / 10000 + Math.random()
    
    console.log(`Target distance: ${targetDistanceMeters}m, Starting radius: ${radius}, Seed: ${routeSeed}`)
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const attemptSeed = (routeSeed + attempt * 0.15) % 1
      const waypoints = generateWaypoints(radius, attemptSeed)
      const route = await fetchRoute(waypoints)
      
      if (!route) {
        console.log(`Attempt ${attempt + 1}: No route found`)
        radius *= 0.9
        continue
      }
      
      const routeDistance = route.distance
      const distanceDiff = Math.abs(routeDistance - targetDistanceMeters)
      
      console.log(`Attempt ${attempt + 1}: Route distance: ${routeDistance}m, Target: ${targetDistanceMeters}m, Diff: ${distanceDiff}m`)
      
      if (distanceDiff < bestDistanceDiff) {
        bestRoute = route
        bestDistanceDiff = distanceDiff
      }
      
      if (distanceDiff <= tolerance) {
        console.log(`Found acceptable route within ${tolerance}m tolerance on attempt ${attempt + 1}`)
        break
      }
      
      const adjustmentFactor = Math.min(Math.max(distanceDiff / targetDistanceMeters, 0.05), 0.3)
      
      if (routeDistance < targetDistanceMeters) {
        radius *= (1 + adjustmentFactor)
      } else {
        radius *= (1 - adjustmentFactor)
      }
    }
    
    if (!bestRoute) {
      throw new Error('Could not generate a suitable route')
    }
    
    console.log(`Final route distance: ${bestRoute.distance}m vs target: ${targetDistanceMeters}m`)
    
    return new Response(
      JSON.stringify({
        success: true,
        route: bestRoute
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