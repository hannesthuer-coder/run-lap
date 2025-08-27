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

    // Create a natural loop route
    const createNaturalLoop = async (targetDistance, seed = Math.random()) => {
      console.log(`\n=== Creating natural loop (seed: ${seed.toFixed(3)}) ===`)
      
      // Choose initial direction (avoid pure north/south for better loops)
      const baseDirection = 45 + (seed * 270) // 45-315 degrees
      console.log(`Initial direction: ${baseDirection.toFixed(1)}°`)
      
      let totalDistance = 0
      let allCoordinates = [[startLng, startLat]]
      let currentLng = startLng
      let currentLat = startLat
      let currentBearing = baseDirection
      
      // Step 1: Go out in initial direction for ~30-40% of total distance
      const outwardDistance = targetDistance * (0.3 + seed * 0.1) // 30-40%
      const outwardDistanceKm = outwardDistance / 1000
      
      console.log(`Step 1: Going outward ${outwardDistance}m`)
      
      const outwardPoint = findPointInDirection(startLng, startLat, currentBearing, outwardDistanceKm)
      const outwardRoute = await getWalkingRoute(startLng, startLat, outwardPoint.lng, outwardPoint.lat)
      
      if (!outwardRoute) {
        console.log('Failed to get outward route')
        return null
      }
      
      totalDistance += outwardRoute.distance
      allCoordinates.push(...outwardRoute.geometry.coordinates.slice(1))
      currentLng = outwardRoute.geometry.coordinates[outwardRoute.geometry.coordinates.length - 1][0]
      currentLat = outwardRoute.geometry.coordinates[outwardRoute.geometry.coordinates.length - 1][1]
      
      console.log(`After outward: ${totalDistance}m covered, at [${currentLng.toFixed(6)}, ${currentLat.toFixed(6)}]`)
      
      // Step 2: Make a 90-degree turn and continue for another portion
      currentBearing = (currentBearing + 90 + (seed - 0.5) * 40) % 360 // 90° + some variation
      const sideDistance = targetDistance * (0.25 + seed * 0.1) // 25-35%
      const sideDistanceKm = sideDistance / 1000
      
      console.log(`Step 2: Turning to ${currentBearing.toFixed(1)}° for ${sideDistance}m`)
      
      const sidePoint = findPointInDirection(currentLng, currentLat, currentBearing, sideDistanceKm)
      const sideRoute = await getWalkingRoute(currentLng, currentLat, sidePoint.lng, sidePoint.lat)
      
      if (!sideRoute) {
        console.log('Failed to get side route')
        return null
      }
      
      totalDistance += sideRoute.distance
      allCoordinates.push(...sideRoute.geometry.coordinates.slice(1))
      currentLng = sideRoute.geometry.coordinates[sideRoute.geometry.coordinates.length - 1][0]
      currentLat = sideRoute.geometry.coordinates[sideRoute.geometry.coordinates.length - 1][1]
      
      console.log(`After side: ${totalDistance}m covered, at [${currentLng.toFixed(6)}, ${currentLat.toFixed(6)}]`)
      
      // Step 3: If we still need distance, make another turn
      const remainingDistance = targetDistance - totalDistance
      if (remainingDistance > 800) { // Only if significant distance remains
        currentBearing = (currentBearing + 90 + (seed - 0.5) * 30) % 360
        const middleDistance = Math.min(remainingDistance * 0.6, remainingDistance - 500) // Leave room for return
        const middleDistanceKm = middleDistance / 1000
        
        console.log(`Step 3: Additional turn to ${currentBearing.toFixed(1)}° for ${middleDistance}m`)
        
        const middlePoint = findPointInDirection(currentLng, currentLat, currentBearing, middleDistanceKm)
        const middleRoute = await getWalkingRoute(currentLng, currentLat, middlePoint.lng, middlePoint.lat)
        
        if (middleRoute) {
          totalDistance += middleRoute.distance
          allCoordinates.push(...middleRoute.geometry.coordinates.slice(1))
          currentLng = middleRoute.geometry.coordinates[middleRoute.geometry.coordinates.length - 1][0]
          currentLat = middleRoute.geometry.coordinates[middleRoute.geometry.coordinates.length - 1][1]
          console.log(`After middle: ${totalDistance}m covered`)
        }
      }
      
      // Step 4: Return directly to start
      console.log(`Step 4: Returning to start from [${currentLng.toFixed(6)}, ${currentLat.toFixed(6)}]`)
      
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
        duration: outwardRoute.duration + (sideRoute?.duration || 0) + (returnRoute?.duration || 0)
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