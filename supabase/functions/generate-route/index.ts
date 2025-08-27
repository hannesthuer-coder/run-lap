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

    // Create a natural loop route with gradual turns to avoid U-turns
    const createNaturalLoop = async (targetDistance, seed = Math.random()) => {
      console.log(`\n=== Creating natural loop (seed: ${seed.toFixed(3)}) ===`)
      
      // Choose initial direction
      const baseDirection = 45 + (seed * 270) // 45-315 degrees
      console.log(`Initial direction: ${baseDirection.toFixed(1)}°`)
      
      let totalDistance = 0
      let allCoordinates = [[startLng, startLat]]
      let currentLng = startLng
      let currentLat = startLat
      let currentBearing = baseDirection
      
      // Create a pentagon-like path (5 segments) to ensure smooth, no-backtrack loops
      const segments = 5
      const segmentDistance = targetDistance / segments
      const turnAngle = 360 / segments // 72 degrees per turn for pentagon
      
      console.log(`Creating ${segments} segments of ~${segmentDistance}m each with ${turnAngle}° turns`)
      
      for (let i = 0; i < segments; i++) {
        // Add some variation to segment distances to make it more natural
        const variation = (seed - 0.5) * 0.3 // ±15% variation
        const thisSegmentDistance = segmentDistance * (1 + variation)
        const thisSegmentDistanceKm = thisSegmentDistance / 1000
        
        console.log(`Segment ${i + 1}: Direction ${currentBearing.toFixed(1)}° for ${thisSegmentDistance.toFixed(0)}m`)
        
        // Find the endpoint for this segment
        const segmentPoint = findPointInDirection(currentLng, currentLat, currentBearing, thisSegmentDistanceKm)
        
        // Get the route for this segment
        const segmentRoute = await getWalkingRoute(currentLng, currentLat, segmentPoint.lng, segmentPoint.lat)
        
        if (!segmentRoute) {
          console.log(`Failed to get segment ${i + 1} route`)
          return null
        }
        
        // Add this segment to the total route
        totalDistance += segmentRoute.distance
        allCoordinates.push(...segmentRoute.geometry.coordinates.slice(1))
        
        // Update current position to the end of this segment
        const coords = segmentRoute.geometry.coordinates
        currentLng = coords[coords.length - 1][0]
        currentLat = coords[coords.length - 1][1]
        
        console.log(`After segment ${i + 1}: ${totalDistance.toFixed(0)}m covered, at [${currentLng.toFixed(6)}, ${currentLat.toFixed(6)}]`)
        
        // Turn for the next segment (except on the last segment)
        if (i < segments - 1) {
          currentBearing = (currentBearing + turnAngle + (seed - 0.5) * 20) % 360 // Add some turn variation
        }
      }
      
      // Final segment back to start
      console.log(`Final segment: Returning to start from [${currentLng.toFixed(6)}, ${currentLat.toFixed(6)}]`)
      
      const returnRoute = await getWalkingRoute(currentLng, currentLat, startLng, startLat)
      
      if (!returnRoute) {
        console.log('Failed to get return route')
        return null
      }
      
      totalDistance += returnRoute.distance
      allCoordinates.push(...returnRoute.geometry.coordinates.slice(1))
      
      console.log(`Final total distance: ${totalDistance}m (target: ${targetDistance}m, diff: ${Math.abs(totalDistance - targetDistance)}m)`)
      
      return {
        coordinates: allCoordinates,
        distance: totalDistance,
        duration: 0 // Will be calculated from segments if needed
      }
    }

    // Try multiple variations to find the best route
    let bestRoute = null
    let bestDistanceDiff = Infinity
    const tolerance = Math.max(800, targetDistanceMeters * 0.2) // 20% tolerance
    
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