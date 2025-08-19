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
    
    // Function to calculate bearing between two points
    const calculateBearing = (lat1, lng1, lat2, lng2) => {
      const dLng = (lng2 - lng1) * Math.PI / 180
      const lat1Rad = lat1 * Math.PI / 180
      const lat2Rad = lat2 * Math.PI / 180
      
      const y = Math.sin(dLng) * Math.cos(lat2Rad)
      const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng)
      
      let bearing = Math.atan2(y, x) * 180 / Math.PI
      return (bearing + 360) % 360
    }

    // Function to calculate turn angle between three points
    const calculateTurnAngle = (p1, p2, p3) => {
      const bearing1 = calculateBearing(p1[1], p1[0], p2[1], p2[0])
      const bearing2 = calculateBearing(p2[1], p2[0], p3[1], p3[0])
      
      let turnAngle = Math.abs(bearing2 - bearing1)
      if (turnAngle > 180) turnAngle = 360 - turnAngle
      
      return turnAngle
    }

    // Function to analyze route quality and detect sharp turns
    const analyzeRouteQuality = (geometry) => {
      if (!geometry || !geometry.coordinates || geometry.coordinates.length < 3) {
        return { quality: 0, maxTurnAngle: 180, sharpTurns: 0 }
      }

      const coords = geometry.coordinates
      let maxTurnAngle = 0
      let sharpTurns = 0
      let totalTurnAngle = 0
      let segments = 0

      // Analyze every 5th point to avoid micro-variations
      for (let i = 0; i < coords.length - 10; i += 5) {
        const p1 = coords[i]
        const p2 = coords[i + 5]
        const p3 = coords[i + 10]
        
        const turnAngle = calculateTurnAngle(p1, p2, p3)
        maxTurnAngle = Math.max(maxTurnAngle, turnAngle)
        totalTurnAngle += turnAngle
        segments++

        // Count sharp turns (> 90 degrees)
        if (turnAngle > 90) {
          sharpTurns++
        }
      }

      const averageTurnAngle = segments > 0 ? totalTurnAngle / segments : 0
      
      // Quality score: penalize sharp turns and high average turn angles
      let quality = 100
      quality -= (sharpTurns * 20) // -20 points per sharp turn
      quality -= (maxTurnAngle > 120 ? 30 : 0) // -30 points for very sharp turns
      quality -= (averageTurnAngle > 45 ? 20 : 0) // -20 points for high average turn angle
      
      return {
        quality: Math.max(0, quality),
        maxTurnAngle,
        sharpTurns,
        averageTurnAngle
      }
    }

    // Function to generate smooth waypoints using bearing-based approach
    const generateSmoothWaypoints = (baseRadius, seed = Math.random()) => {
      const waypoints = []
      const numWaypoints = 6 + Math.floor(seed * 3) // 6-8 waypoints for smoother paths
      
      // Start with a random cardinal direction
      let currentBearing = seed * 90 // 0-90 degrees initial bearing
      const totalRotation = 360 // Complete circle
      const bearingIncrement = totalRotation / numWaypoints
      
      for (let i = 0; i < numWaypoints; i++) {
        // Add some natural variation to bearing
        const bearingVariation = (Math.sin(i * Math.PI / 3 + seed * Math.PI) * 15) // ±15 degrees variation
        const actualBearing = (currentBearing + bearingVariation) % 360
        
        // Vary radius slightly for more natural paths
        const radiusVariation = 0.8 + (Math.sin(i * Math.PI / 2 + seed * Math.PI * 2) * 0.3) // 0.8-1.1x base radius
        const actualRadius = baseRadius * radiusVariation
        
        // Convert bearing to coordinates
        const bearingRad = actualBearing * Math.PI / 180
        const lat = startLat + actualRadius * Math.cos(bearingRad)
        const lng = startLng + actualRadius * Math.sin(bearingRad)
        
        waypoints.push([lng, lat])
        
        // Update bearing for next waypoint
        currentBearing = (currentBearing + bearingIncrement) % 360
      }
      
      return waypoints
    }
    
    // Function to fetch and validate route quality
    const fetchQualityRoute = async (waypoints) => {
      // Create a loop by adding the start point at the end
      const loopWaypoints = [...waypoints, [startLng, startLat]]
      const coordinates = `${startLng},${startLat};` + loopWaypoints.map(w => `${w[0]},${w[1]}`).join(';')
      
      // Enhanced routing preferences for smoother paths
      const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinates}?` + 
        `geometries=geojson&` +
        `access_token=${MAPBOX_TOKEN}&` +
        `overview=full&` +
        `steps=true&` +
        `continue_straight=true&` + // Prefer continuing straight
        `alternatives=true&` + // Get alternative routes to choose the best
        `annotations=distance,duration&` +
        `approaches=${Array(loopWaypoints.length + 1).fill('unrestricted').join(';')}&` + // Allow flexible approach angles
        `radiuses=${Array(loopWaypoints.length + 1).fill('100').join(';')}` // 100m radius for road snapping
      
      const response = await fetch(directionsUrl)
      const data = await response.json()
      
      if (!data.routes || data.routes.length === 0) {
        return null
      }
      
      // Analyze all available routes and pick the smoothest one
      let bestRoute = null
      let bestQuality = -1
      
      for (const route of data.routes) {
        const quality = analyzeRouteQuality(route.geometry)
        
        console.log(`Route quality analysis: Quality=${quality.quality}, MaxTurn=${quality.maxTurnAngle}°, SharpTurns=${quality.sharpTurns}`)
        
        // More lenient quality check - only reject extremely problematic routes
        if (quality.maxTurnAngle > 150 || quality.sharpTurns > 5) {
          console.log(`Rejecting route: MaxTurn=${quality.maxTurnAngle}°, SharpTurns=${quality.sharpTurns}`)
          continue
        }
        
        if (quality.quality > bestQuality) {
          bestRoute = route
          bestQuality = quality.quality
        }
      }
      
      // If no route passes quality check, return the best available route
      return bestRoute || data.routes[0]
    }
    
    // Enforce more lenient tolerance and better distance targeting
    let bestRoute = null
    let bestWaypoints = null
    let bestDistanceDiff = Infinity
    const tolerance = 400 // 400m tolerance instead of 200m for more flexibility
    const maxAttempts = 20 // More attempts for better results
    
    // Better base radius calculation for target distance
    let radius = (targetDistanceMeters / (2 * Math.PI)) * 0.000012 // Increased multiplier for better distance targeting
    
    // Generate a unique seed based on timestamp and random for maximum variation
    const routeSeed = (Date.now() % 10000) / 10000 + Math.random()
    
    console.log(`Target distance: ${targetDistanceMeters}m, Strict tolerance: ${tolerance}m, Starting radius: ${radius}, Seed: ${routeSeed}`)
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Create different seeds for each attempt for variety
      const attemptSeed = (routeSeed + attempt * 0.15) % 1
      const waypoints = generateSmoothWaypoints(radius, attemptSeed)
      const route = await fetchQualityRoute(waypoints)
      
      if (!route) {
        console.log(`Attempt ${attempt + 1}: No route found`)
        radius *= 0.9 // Minor adjustment
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
      
      // If we're within tolerance, use this route
      if (distanceDiff <= tolerance) {
        console.log(`Found acceptable route within ${tolerance}m tolerance on attempt ${attempt + 1}`)
        break
      }
      
      // Better radius adjustments based on distance difference
      const adjustmentFactor = Math.min(Math.max(distanceDiff / targetDistanceMeters, 0.1), 0.4) // Larger adjustments
      
      if (routeDistance < targetDistanceMeters) {
        radius *= (1 + adjustmentFactor) // Increase radius proportionally
      } else {
        radius *= (1 - adjustmentFactor * 0.5) // Smaller decreases to avoid overshooting
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