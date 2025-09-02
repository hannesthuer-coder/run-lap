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

    // Create a natural loop route with configurable parameters for better distance control
    const createNaturalLoopWithParams = async (targetDistance, seed, segments, variationFactor) => {
      console.log(`\n=== Creating natural loop (seed: ${seed.toFixed(3)}, ${segments} segments, ${(variationFactor * 100).toFixed(0)}% variation) ===`)
      
      // Choose initial direction
      const baseDirection = 45 + (seed * 270) // 45-315 degrees
      console.log(`Initial direction: ${baseDirection.toFixed(1)}°`)
      
      let totalDistance = 0
      let allCoordinates = [[startLng, startLat]]
      let currentLng = startLng
      let currentLat = startLat
      let currentBearing = baseDirection
      
      // Create a polygon path with configurable segments for better distance matching
      const segmentDistance = targetDistance / segments
      const turnAngle = 360 / segments
      
      console.log(`Creating ${segments} segments of ~${segmentDistance}m each with ${turnAngle}° turns`)
      
      for (let i = 0; i < segments; i++) {
        // Apply configurable variation to segment distances
        const variation = (seed - 0.5) * variationFactor
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
        
        // Turn for the next segment with configurable variation
        if (i < segments - 1) {
          const turnVariation = (seed - 0.5) * 30 * variationFactor // Scale turn variation
          currentBearing = (currentBearing + turnAngle + turnVariation) % 360
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

    // Try multiple variations with strict tolerance enforcement
    const tolerance = 500 // Strict ±500m tolerance as requested
    const maxAttempts = 15 // More attempts for better success rate
    
    console.log(`Target: ${targetDistanceMeters}m, Tolerance: ±${tolerance}m`)
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Use different strategies for different attempt ranges
        const seed = (Date.now() + attempt * 1000) % 10000 / 10000
        let segments = 5 // Default pentagon
        let variationFactor = 0.3 // Default variation
        
        if (attempt >= 5) {
          // Try different polygon shapes after 5 attempts
          segments = 4 + (attempt % 4) // 4-7 segments (square to heptagon)
          variationFactor = 0.1 + (attempt * 0.05) // Increase variation
        }
        
        if (attempt >= 10) {
          // More aggressive variations for later attempts
          segments = 3 + (attempt % 6) // 3-8 segments 
          variationFactor = 0.5 // Higher variation
        }
        
        console.log(`\n--- Attempt ${attempt + 1}/${maxAttempts} (${segments} segments, ${(variationFactor * 100).toFixed(0)}% variation) ---`)
        
        const route = await createNaturalLoopWithParams(targetDistanceMeters, seed, segments, variationFactor)
        
        if (!route) {
          console.log('No route generated')
          continue
        }
        
        const distanceDiff = Math.abs(route.distance - targetDistanceMeters)
        console.log(`Route: ${route.distance}m (diff: ${distanceDiff}m)`)
        
        // STRICT TOLERANCE: Only accept routes within ±500m
        if (distanceDiff <= tolerance) {
          console.log('✓ Within tolerance - accepting route')
          return new Response(
            JSON.stringify({
              success: true,
              route: {
                geometry: {
                  type: 'LineString',
                  coordinates: route.coordinates
                },
                distance: route.distance,
                duration: route.duration,
                waypoints: []
              }
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        } else {
          console.log(`❌ Outside tolerance (${distanceDiff}m > ${tolerance}m) - rejecting`)
        }
        
      } catch (error) {
        console.log(`Attempt ${attempt + 1} failed: ${error.message}`)
      }
    }
    
    // If we get here, no route met the strict tolerance
    throw new Error(`Could not generate a route within ±${tolerance}m tolerance after ${maxAttempts} attempts. Please try a different location or distance.`)
    
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