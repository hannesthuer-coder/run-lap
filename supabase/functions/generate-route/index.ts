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
    
    // Get Mapbox token - use hardcoded token as fallback since secret access isn't working
    const MAPBOX_TOKEN = Deno.env.get('MAPBOX_ACCESS_TOKEN') || 'pk.eyJ1IjoiaGFubmVzdGh1cjEyMyIsImEiOiJjbWVpdmk4cmUwN3YwMmxzZDNtcjF2em54In0.kkCEFz-Lg2PQoLD-OTJp6Q'
    
    console.log(`Using Mapbox token: ${MAPBOX_TOKEN ? 'Token available' : 'No token found'}`)
    
    if (!MAPBOX_TOKEN) {
      console.error('No Mapbox access token available')
      throw new Error('Mapbox access token not configured')
    }
    
    // Convert distance to meters
    const targetDistanceMeters = unit === 'km' ? distance * 1000 : distance * 1609.34
    console.log(`Target distance: ${targetDistanceMeters}m`)

    // Helper function to get a route between two points
    const getRoute = async (fromLng, fromLat, toLng, toLat) => {
      const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${fromLng},${fromLat};${toLng},${toLat}?` + 
        `geometries=geojson&` +
        `access_token=${MAPBOX_TOKEN}&` +
        `overview=full&` +
        `steps=true&` +
        `continue_straight=false&` +
        `waypoint_snapping=any&` +
        `annotations=distance,duration`
      
      const response = await fetch(directionsUrl)
      const data = await response.json()
      
      if (!data.routes || data.routes.length === 0) {
        return null
      }
      
      return data.routes[0]
    }

    // Helper function to find a point at approximately given distance and bearing from start
    const findPointAtDistance = async (startLng, startLat, bearingDegrees, targetDistance) => {
      // Convert to approximate lat/lng offset (rough estimation)
      const distanceInKm = targetDistance / 1000
      const bearingRadians = bearingDegrees * Math.PI / 180
      
      const latOffset = (distanceInKm / 111) * Math.cos(bearingRadians)
      const lngOffset = (distanceInKm / (111 * Math.cos(startLat * Math.PI / 180))) * Math.sin(bearingRadians)
      
      const testLng = startLng + lngOffset
      const testLat = startLat + latOffset
      
      // Try to get a route to this point to ensure it's reachable
      const route = await getRoute(startLng, startLat, testLng, testLat)
      if (!route) return null
      
      // Return the actual end point from the route (snapped to walkable path)
      const coords = route.geometry.coordinates
      return {
        lng: coords[coords.length - 1][0],
        lat: coords[coords.length - 1][1],
        route: route
      }
    }

    // Incremental route building algorithm
    const buildIncrementalRoute = async (targetDistance, seed = Math.random()) => {
      const segments = []
      let totalDistance = 0
      let currentLng = startLng
      let currentLat = startLat
      let allCoordinates = [[startLng, startLat]]
      
      // Start with initial direction
      let currentBearing = seed * 360
      
      // Segment length - start with smaller segments for better path following
      const baseSegmentLength = Math.min(800, targetDistance / 6) // 6-8 segments typical
      
      console.log(`Building incremental route with ~${baseSegmentLength}m segments`)
      
      let attempt = 0
      const maxSegments = 12 // Prevent infinite loops
      
      while (totalDistance < targetDistance * 0.75 && attempt < maxSegments) {
        // Vary segment length slightly
        const segmentLength = baseSegmentLength * (0.8 + Math.random() * 0.4)
        
        // Find next point
        const nextPoint = await findPointAtDistance(currentLng, currentLat, currentBearing, segmentLength)
        
        if (!nextPoint) {
          // Try different bearing if current one doesn't work
          currentBearing = (currentBearing + 60 + Math.random() * 60) % 360
          attempt++
          continue
        }
        
        segments.push(nextPoint.route)
        totalDistance += nextPoint.route.distance
        
        // Update position
        currentLng = nextPoint.lng
        currentLat = nextPoint.lat
        
        // Add coordinates from this segment (skip first point to avoid duplicates)
        const segmentCoords = nextPoint.route.geometry.coordinates.slice(1)
        allCoordinates.push(...segmentCoords)
        
        // Gradually curve the bearing for a more natural path
        const curveAmount = (Math.random() - 0.5) * 45 // ±22.5 degrees
        currentBearing = (currentBearing + curveAmount) % 360
        
        console.log(`Segment ${attempt + 1}: ${nextPoint.route.distance}m, total: ${totalDistance}m, bearing: ${currentBearing.toFixed(1)}°`)
        attempt++
      }
      
      // Now route back to start to complete the loop
      const returnRoute = await getRoute(currentLng, currentLat, startLng, startLat)
      if (!returnRoute) {
        console.log('Could not create return route to start')
        return null
      }
      
      segments.push(returnRoute)
      totalDistance += returnRoute.distance
      
      // Add return route coordinates (skip first point)
      const returnCoords = returnRoute.geometry.coordinates.slice(1)
      allCoordinates.push(...returnCoords)
      
      console.log(`Return segment: ${returnRoute.distance}m, final total: ${totalDistance}m`)
      
      return {
        coordinates: allCoordinates,
        distance: totalDistance,
        duration: segments.reduce((sum, seg) => sum + seg.duration, 0),
        segments: segments
      }
    }

    // Try building route with different approaches
    let bestRoute = null
    let bestDistanceDiff = Infinity
    const tolerance = Math.max(500, targetDistanceMeters * 0.15) // 15% tolerance, minimum 500m
    const maxAttempts = 6
    
    console.log(`Target: ${targetDistanceMeters}m, Tolerance: ±${tolerance}m`)
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const seed = (Date.now() % 10000) / 10000 + Math.random() + attempt * 0.2
        console.log(`\n--- Attempt ${attempt + 1} ---`)
        
        const route = await buildIncrementalRoute(targetDistanceMeters, seed)
        
        if (!route) {
          console.log(`Attempt ${attempt + 1}: Failed to build route`)
          continue
        }
        
        const distanceDiff = Math.abs(route.distance - targetDistanceMeters)
        console.log(`Attempt ${attempt + 1}: Distance ${route.distance}m (diff: ${distanceDiff}m)`)
        
        if (distanceDiff < bestDistanceDiff) {
          bestRoute = route
          bestDistanceDiff = distanceDiff
        }
        
        // Accept if within tolerance
        if (distanceDiff <= tolerance) {
          console.log(`✓ Acceptable route found within tolerance`)
          break
        }
        
      } catch (error) {
        console.log(`Attempt ${attempt + 1} error: ${error.message}`)
      }
    }
    
    if (!bestRoute) {
      throw new Error('Could not generate any valid route')
    }
    
    if (bestDistanceDiff > tolerance) {
      console.log(`⚠ Best route is ${bestDistanceDiff}m outside tolerance, but using anyway`)
    }
    
    console.log(`\n✓ Final route: ${bestRoute.distance}m (target: ${targetDistanceMeters}m)`)
    
    return new Response(
      JSON.stringify({
        success: true,
        route: {
          geometry: {
            type: 'LineString',
            coordinates: bestRoute.coordinates
          },
          distance: bestRoute.distance,
          duration: bestRoute.duration,
          waypoints: [] // Not using traditional waypoints in this approach
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