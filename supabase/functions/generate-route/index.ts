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

    // Helper function to calculate bearing between two points
    const calculateBearing = (startLng, startLat, endLng, endLat) => {
      const lat1 = startLat * Math.PI / 180
      const lat2 = endLat * Math.PI / 180
      const deltaLng = (endLng - startLng) * Math.PI / 180
      
      const y = Math.sin(deltaLng) * Math.cos(lat2)
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng)
      
      const bearing = Math.atan2(y, x) * 180 / Math.PI
      return (bearing + 360) % 360
    }

    // Super-Fast Route Generation Algorithm (2-3 seconds max)
    const generateFastLoop = async () => {
      console.log(`\n=== Super-Fast Route Generation ===`)
      console.log(`Target: ${targetDistanceMeters}m`)
      
      const startTime = Date.now()
      let totalDistance = 0
      let allCoordinates = [[startLng, startLat]]
      let currentLng = startLng
      let currentLat = startLat
      
      // Calculate optimal segments for target distance
      const explorationTarget = targetDistanceMeters * 0.7 // 70% exploration, 30% return
      const numSegments = targetDistanceMeters > 5000 ? 3 : 2 // Keep it simple: 2-3 segments max
      const segmentDistance = explorationTarget / numSegments
      
      console.log(`Planning ${numSegments} segments of ~${(segmentDistance/1000).toFixed(1)}km each`)
      
      // Generate segments with smart bearing distribution
      for (let i = 0; i < numSegments; i++) {
        const remainingDistance = explorationTarget - totalDistance
        if (remainingDistance < 800) break // Stop if close to target
        
        // Smart direction calculation: spread segments around 120-140° apart
        const baseAngle = (i * 130 + Math.random() * 40) % 360
        const segmentDistanceKm = Math.min(remainingDistance / 1000, segmentDistance / 1000)
        
        // Calculate waypoint directly
        const waypoint = findPointInDirection(currentLng, currentLat, baseAngle, segmentDistanceKm)
        
        console.log(`Segment ${i + 1}: ${baseAngle.toFixed(0)}° for ${segmentDistanceKm.toFixed(1)}km`)
        
        // Single API call per segment - no retries
        const route = await getWalkingRoute(currentLng, currentLat, waypoint.lng, waypoint.lat)
        
        if (!route || route.distance < 300) {
          console.log(`Segment ${i + 1} failed, skipping`)
          continue
        }
        
        // Add successful route
        totalDistance += route.distance
        const coords = route.geometry.coordinates
        allCoordinates.push(...coords.slice(1))
        
        // Update current position
        currentLng = coords[coords.length - 1][0]
        currentLat = coords[coords.length - 1][1]
        
        console.log(`Segment ${i + 1} complete: ${route.distance.toFixed(0)}m (total: ${totalDistance.toFixed(0)}m)`)
        
        // Timeout check (30 seconds max)
        if (Date.now() - startTime > 30000) {
          console.log('⚠️ Timeout reached, finishing with current segments')
          break
        }
      }
      
      // Complete the loop with direct return
      console.log(`\n--- Completing loop ---`)
      const returnRoute = await getWalkingRoute(currentLng, currentLat, startLng, startLat)
      
      if (!returnRoute) {
        throw new Error('Failed to complete route loop')
      }
      
      totalDistance += returnRoute.distance
      allCoordinates.push(...returnRoute.geometry.coordinates.slice(1))
      
      const generationTime = (Date.now() - startTime) / 1000
      const distanceDiff = Math.abs(totalDistance - targetDistanceMeters)
      
      console.log(`✅ Route complete in ${generationTime.toFixed(1)}s`)
      console.log(`Final: ${totalDistance.toFixed(0)}m (diff: ${distanceDiff.toFixed(0)}m)`)
      
      return {
        coordinates: allCoordinates,
        distance: totalDistance,
        duration: 0,
        generationTime
      }
    }

    // Generate single route with timeout protection
    console.log(`Target: ${targetDistanceMeters}m`)
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Route generation timeout (30s)')), 30000)
    })
    
    try {
      const route = await Promise.race([generateFastLoop(), timeoutPromise])
      
      if (!route) {
        throw new Error('No route generated')
      }
      
      console.log(`🎯 Route generated: ${route.distance}m in ${route.generationTime}s`)
      
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
      
    } catch (error) {
      console.error('Route generation failed:', error)
      throw error
    }
    
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