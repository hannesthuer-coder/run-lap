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
    
    // Get Google Maps API key from Supabase secrets
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY')
    if (!GOOGLE_MAPS_API_KEY) {
      throw new Error('Google Maps API key not configured')
    }
    
    // Convert distance to meters
    const targetDistanceMeters = unit === 'km' ? distance * 1000 : distance * 1609.34
    
    // Function to generate waypoints that create true loop circuits
    const generateWaypoints = (baseRadius: number, seed = Math.random()) => {
      const numWaypoints = 4 + Math.floor(seed * 3) // 4-6 waypoints
      const waypoints = []
      
      const clockwise = seed > 0.5
      const startAngle = seed * Math.PI * 0.5
      
      for (let i = 0; i < numWaypoints; i++) {
        const progressionFactor = clockwise ? 1 : -1
        const angle = startAngle + progressionFactor * (i / numWaypoints) * 2 * Math.PI
        
        const radiusVariation = 1 + Math.sin(angle * 1.5 + seed * Math.PI) * 0.2
        const finalRadius = baseRadius * radiusVariation
        
        // Convert to lat/lng (approximate conversion)
        const lat = startLat + finalRadius * Math.cos(angle) * 0.000009
        const lng = startLng + finalRadius * Math.sin(angle) * 0.000009
        
        waypoints.push([lat, lng])
      }
      
      return waypoints
    }
    
    // Function to fetch route from Google Maps Directions API
    const fetchRoute = async (waypoints: number[][]) => {
      const origin = `${startLat},${startLng}`
      const destination = origin // Return to start for loop
      const waypointsStr = waypoints.map(w => `${w[0]},${w[1]}`).join('|')
      
      const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?` +
        `origin=${origin}&` +
        `destination=${destination}&` +
        `waypoints=${waypointsStr}&` +
        `mode=walking&` +
        `key=${GOOGLE_MAPS_API_KEY}`
      
      const response = await fetch(directionsUrl)
      const data = await response.json()
      
      if (!data.routes || data.routes.length === 0 || data.status !== 'OK') {
        return null
      }
      
      const route = data.routes[0]
      const leg = route.legs[0]
      
      // Decode polyline to get coordinates
      const coordinates = decodePolyline(route.overview_polyline.points)
      
      return {
        geometry: { coordinates },
        distance: leg.distance.value,
        duration: leg.duration.value
      }
    }
    
    // Simple polyline decoder
    const decodePolyline = (encoded: string) => {
      const coordinates = []
      let index = 0
      let lat = 0
      let lng = 0
      
      while (index < encoded.length) {
        let b, shift = 0, result = 0
        do {
          b = encoded.charCodeAt(index++) - 63
          result |= (b & 0x1f) << shift
          shift += 5
        } while (b >= 0x20)
        const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1))
        lat += dlat
        
        shift = 0
        result = 0
        do {
          b = encoded.charCodeAt(index++) - 63
          result |= (b & 0x1f) << shift
          shift += 5
        } while (b >= 0x20)
        const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1))
        lng += dlng
        
        coordinates.push([lng * 1e-5, lat * 1e-5])
      }
      
      return coordinates
    }
    
    let bestRoute = null
    let bestDistanceDiff = Infinity
    const tolerance = 200 // 200m tolerance
    const maxAttempts = 10
    
    // Base radius calculation
    let radius = (targetDistanceMeters / (2 * Math.PI))
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