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
    
    const MAPBOX_TOKEN = Deno.env.get('MAPBOX_ACCESS_TOKEN') || 'pk.eyJ1IjoiaGFubmVzdGh1cjEyMyIsImEiOiJjbWVpdmk4cmUwN3YwMmxzZDNtcjF2em54In0.kkCEFz-Lg2PQoLD-OTJp6Q'
    
    console.log(`Using Mapbox token: ${MAPBOX_TOKEN ? 'Available' : 'Missing'}`)
    
    // Convert distance to meters
    const targetDistanceMeters = unit === 'km' ? distance * 1000 : distance * 1609.34
    console.log(`Target distance: ${targetDistanceMeters}m`)

    // Simple function to get walking route between two points
    const getWalkingRoute = async (fromLng, fromLat, toLng, toLat) => {
      const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${fromLng},${fromLat};${toLng},${toLat}?` + 
        `geometries=geojson&access_token=${MAPBOX_TOKEN}&overview=full&steps=true`
      
      try {
        const response = await fetch(url)
        const data = await response.json()
        
        if (data.routes && data.routes.length > 0) {
          return data.routes[0]
        }
        return null
      } catch (error) {
        console.log(`Route request failed: ${error.message}`)
        return null
      }
    }

    // Function to find a point roughly at given distance in given direction
    const findPointInDirection = (startLng, startLat, bearingDegrees, distanceKm) => {
      const R = 6371 // Earth's radius in km
      const bearing = bearingDegrees * Math.PI / 180
      const lat1 = startLat * Math.PI / 180
      const lon1 = startLng * Math.PI / 180
      
      const lat2 = Math.asin(Math.sin(lat1) * Math.cos(distanceKm / R) +
                            Math.cos(lat1) * Math.sin(distanceKm / R) * Math.cos(bearing))
      
      const lon2 = lon1 + Math.atan2(Math.sin(bearing) * Math.sin(distanceKm / R) * Math.cos(lat1),
                                    Math.cos(distanceKm / R) - Math.sin(lat1) * Math.sin(lat2))
      
      return {
        lat: lat2 * 180 / Math.PI,
        lng: lon2 * 180 / Math.PI
      }
    }

    // Create a simple rectangular loop route
    const createNaturalLoop = async (targetDistance, seed = Math.random()) => {
      console.log(`\n=== Creating simple rectangular loop (seed: ${seed.toFixed(3)}) ===`)
      
      // Simple 4-segment rectangular approach
      const segmentDistance = targetDistance / 4 // Each side of rectangle
      console.log(`Target segment distance: ${segmentDistance.toFixed(0)}m each`)
      
      // Cardinal directions for natural rectangular loop
      const directions = [
        0 + (seed - 0.5) * 20,    // North ±10°
        90 + (seed - 0.5) * 20,   // East ±10°  
        180 + (seed - 0.5) * 20,  // South ±10°
        270 + (seed - 0.5) * 20   // West ±10°
      ]
      
      let totalDistance = 0
      let allCoordinates = [[startLng, startLat]]
      let currentLng = startLng
      let currentLat = startLat
      
      // Create 3 segments (4th will be return to start)
      for (let i = 0; i < 3; i++) {
        const direction = directions[i]
        const distanceKm = segmentDistance / 1000
        
        console.log(`Segment ${i + 1}: Direction ${direction.toFixed(1)}° for ${segmentDistance.toFixed(0)}m`)
        
        // Find the endpoint for this segment
        const segmentPoint = findPointInDirection(currentLng, currentLat, direction, distanceKm)
        
        // Get the route for this segment
        const segmentRoute = await getWalkingRoute(currentLng, currentLat, segmentPoint.lng, segmentPoint.lat)
        
        if (!segmentRoute) {
          console.log(`Failed to get segment ${i + 1} route`)
          return null
        }
        
        // Add this segment to the total route
        totalDistance += segmentRoute.distance
        allCoordinates.push(...segmentRoute.geometry.coordinates.slice(1))
        
        // Update current position
        const coords = segmentRoute.geometry.coordinates
        currentLng = coords[coords.length - 1][0]
        currentLat = coords[coords.length - 1][1]
        
        console.log(`After segment ${i + 1}: ${totalDistance.toFixed(0)}m covered`)
      }
      
      // Final segment back to start
      console.log(`Final segment: Returning to start`)
      const returnRoute = await getWalkingRoute(currentLng, currentLat, startLng, startLat)
      
      if (!returnRoute) {
        console.log('Failed to get return route')
        return null
      }
      
      totalDistance += returnRoute.distance
      allCoordinates.push(...returnRoute.geometry.coordinates.slice(1))
      
      const distanceDiff = Math.abs(totalDistance - targetDistance)
      const percentageDiff = (distanceDiff / targetDistance * 100).toFixed(1)
      
      console.log(`Final total distance: ${totalDistance.toFixed(0)}m (target: ${targetDistance}m, diff: ${distanceDiff.toFixed(0)}m, ${percentageDiff}%)`)
      
      return {
        coordinates: allCoordinates,
        distance: totalDistance,
        duration: 0
      }
    }

    // Try multiple variations to find the best route
    let bestRoute = null
    let bestDistanceDiff = Infinity
    const tolerance = Math.max(400, targetDistanceMeters * 0.1) // 10% tolerance for better accuracy
    
    console.log(`Target: ${targetDistanceMeters}m, Tolerance: ±${tolerance}m`)
    
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const seed = (Date.now() + attempt * 1000) % 10000 / 10000
        console.log(`\n--- Attempt ${attempt + 1}/5 ---`)
        
        const route = await createNaturalLoop(targetDistanceMeters, seed)
        
        if (!route) {
          console.log('No route generated')
          continue
        }
        
        const distanceDiff = Math.abs(route.distance - targetDistanceMeters)
        console.log(`Route: ${route.distance}m (diff: ${distanceDiff}m)`)
        
        if (distanceDiff < bestDistanceDiff) {
          bestRoute = route
          bestDistanceDiff = distanceDiff
          console.log('✓ New best route')
        }
        
        if (distanceDiff <= tolerance) {
          console.log('✓ Within tolerance - using this route')
          break
        }
        
      } catch (error) {
        console.log(`Attempt ${attempt + 1} failed: ${error.message}`)
      }
    }
    
    if (!bestRoute) {
      throw new Error('Could not generate any valid route after 5 attempts')
    }
    
    console.log(`\n🎯 Selected route: ${bestRoute.distance}m (${bestDistanceDiff}m from target)`)
    
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
          waypoints: []
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