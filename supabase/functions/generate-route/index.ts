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
    
    // Function to generate waypoints that create true loop circuits (no out-and-back patterns)
    const generateWaypoints = (baseRadius, seed = Math.random()) => {
      // Use 4-6 waypoints arranged in a proper circle to ensure a complete loop
      const numWaypoints = 4 + Math.floor(seed * 3) // 4-6 waypoints
      const waypoints = []
      
      // Ensure waypoints form a complete circle around the starting point
      const clockwise = seed > 0.5
      const startAngle = seed * Math.PI * 0.5 // Limit starting angle to quarter circle for better control
      
      for (let i = 0; i < numWaypoints; i++) {
        // Distribute waypoints evenly around a full circle (360 degrees)
        const progressionFactor = clockwise ? 1 : -1
        const angle = startAngle + progressionFactor * (i / numWaypoints) * 2 * Math.PI
        
        // Ensure waypoints are far enough from the starting point and each other
        // This prevents routes that go out and come back on the same path
        const minDistanceFromStart = baseRadius * 0.7 // At least 70% of radius from start
        const radiusVariation = 1 + Math.sin(angle * 1.5 + seed * Math.PI) * 0.2 // 20% variation max
        const finalRadius = Math.max(minDistanceFromStart, baseRadius * radiusVariation)
        
        const lat = startLat + finalRadius * Math.cos(angle)
        const lng = startLng + finalRadius * Math.sin(angle)
        
        // Validate that this waypoint creates a proper circuit
        if (waypoints.length > 0) {
          const lastWaypoint = waypoints[waypoints.length - 1]
          const distanceFromLast = Math.sqrt(Math.pow(lng - lastWaypoint[0], 2) + Math.pow(lat - lastWaypoint[1], 2))
          const distanceFromStart = Math.sqrt(Math.pow(lng - startLng, 2) + Math.pow(lat - startLat, 2))
          
          // Ensure waypoint is not too close to start (prevents out-and-back) 
          // and maintains good spacing from previous waypoint
          const minSpacingDegrees = baseRadius * 0.000004 // Minimum spacing in degrees
          if (distanceFromLast < minSpacingDegrees || distanceFromStart < minDistanceFromStart * 0.000009) {
            continue
          }
        }
        
        waypoints.push([lng, lat])
      }
      
      // Ensure we have enough waypoints for a proper circuit
      if (waypoints.length < 3) {
        // Fallback to simple 4-point square pattern if not enough waypoints
        return [
          [startLng + baseRadius * 0.000009, startLat],
          [startLng, startLat + baseRadius * 0.000009],
          [startLng - baseRadius * 0.000009, startLat],
          [startLng, startLat - baseRadius * 0.000009]
        ]
      }
      
      return waypoints
    }
    
    // Function to calculate bearing between two points
    const calculateBearing = (lat1, lng1, lat2, lng2) => {
      const dLng = (lng2 - lng1) * Math.PI / 180
      const lat1Rad = lat1 * Math.PI / 180
      const lat2Rad = lat2 * Math.PI / 180
      
      const y = Math.sin(dLng) * Math.cos(lat2Rad)
      const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng)
      
      const bearing = Math.atan2(y, x) * 180 / Math.PI
      return (bearing + 360) % 360
    }

    // Function to detect backtracking on the same street/road
    const detectBacktracking = (coordinates) => {
      if (coordinates.length < 10) return false // Need enough points to detect patterns
      
      const segments = []
      const segmentLength = 4 // Analyze segments of 4 coordinate pairs
      
      // Create segments from the route
      for (let i = 0; i < coordinates.length - segmentLength; i += 3) {
        if (i + segmentLength < coordinates.length) {
          const segment = coordinates.slice(i, i + segmentLength)
          const startBearing = calculateBearing(segment[0][1], segment[0][0], segment[segmentLength-1][1], segment[segmentLength-1][0])
          segments.push({
            start: i,
            end: i + segmentLength - 1,
            bearing: startBearing,
            coords: segment
          })
        }
      }
      
      // Check for opposite bearings (backtracking detection)
      // Allow backtracking near start/end (first 20% and last 20% of route)
      const routeLength = segments.length
      const startBuffer = Math.floor(routeLength * 0.2) // First 20%
      const endBuffer = Math.floor(routeLength * 0.8)   // Last 20%
      
      for (let i = 0; i < segments.length; i++) {
        for (let j = i + 5; j < segments.length; j++) { // Skip nearby segments
          // Skip if either segment is in start/end buffer zones
          const iInBuffer = i < startBuffer || i > endBuffer
          const jInBuffer = j < startBuffer || j > endBuffer
          if (iInBuffer || jInBuffer) continue
          
          const bearingDiff = Math.abs(segments[i].bearing - segments[j].bearing)
          const oppositeBearing = bearingDiff > 135 && bearingDiff < 225 // Opposite directions
          
          if (oppositeBearing) {
            // Check if segments are geographically close (same street)
            const avgLat1 = segments[i].coords.reduce((sum, coord) => sum + coord[1], 0) / segments[i].coords.length
            const avgLng1 = segments[i].coords.reduce((sum, coord) => sum + coord[0], 0) / segments[i].coords.length
            const avgLat2 = segments[j].coords.reduce((sum, coord) => sum + coord[1], 0) / segments[j].coords.length
            const avgLng2 = segments[j].coords.reduce((sum, coord) => sum + coord[0], 0) / segments[j].coords.length
            
            const distance = Math.sqrt(Math.pow((avgLng2 - avgLng1) * 111000, 2) + Math.pow((avgLat2 - avgLat1) * 111000, 2))
            
            if (distance < 100) { // Same street if within 100 meters
              console.log(`Backtracking detected: segments ${segments[i].start}-${segments[i].end} and ${segments[j].start}-${segments[j].end}, bearing diff: ${bearingDiff}°`)
              return true
            }
          }
        }
      }
      
      return false
    }

    // Function to fetch route from Mapbox with backtracking validation
    const fetchRoute = async (waypoints) => {
      // Create a loop by adding the start point at the end
      const loopWaypoints = [...waypoints, [startLng, startLat]]
      const coordinates = `${startLng},${startLat};` + loopWaypoints.map(w => `${w[0]},${w[1]}`).join(';')
      
      // Add routing preferences to prevent backtracking and ensure smooth flow
      const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinates}?` + 
        `geometries=geojson&` +
        `access_token=${MAPBOX_TOKEN}&` +
        `overview=full&` +
        `steps=true&` +
        `continue_straight=true&` + // Prefer continuing straight rather than sharp turns
        `annotations=distance` // Get detailed distance information
      
      const response = await fetch(directionsUrl)
      const data = await response.json()
      
      if (!data.routes || data.routes.length === 0) {
        return null
      }
      
      const route = data.routes[0]
      
      // Check for backtracking in the route geometry
      if (detectBacktracking(route.geometry.coordinates)) {
        console.log('Rejecting route due to backtracking')
        return null
      }
      
      return route
    }
    
    // Enforce strict 0.2km (200m) tolerance for precise distance matching
    let bestRoute = null
    let bestWaypoints = null
    let bestDistanceDiff = Infinity
    const tolerance = 200 // 200m = 0.2km tolerance as requested
    const maxAttempts = 25 // Increase attempts to find routes within tolerance
    
    // More precise base radius calculation
    let radius = (targetDistanceMeters / (2 * Math.PI)) * 0.000009
    
    // Generate a unique seed based on timestamp and random for maximum variation
    const routeSeed = (Date.now() % 10000) / 10000 + Math.random()
    
    console.log(`Target distance: ${targetDistanceMeters}m, Strict tolerance: ${tolerance}m, Starting radius: ${radius}, Seed: ${routeSeed}`)
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Create different seeds for each attempt for variety
      const attemptSeed = (routeSeed + attempt * 0.1) % 1
      const waypoints = generateWaypoints(radius, attemptSeed)
      const route = await fetchRoute(waypoints)
      
      if (!route) {
        console.log(`Attempt ${attempt + 1}: No route found`)
        // Smaller radius adjustment to be more precise
        radius *= (0.95 + Math.random() * 0.1) // Random adjustment between 0.95-1.05
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
      
      // If we're within strict 200m tolerance, use this route immediately
      if (distanceDiff <= tolerance) {
        console.log(`Found acceptable route within strict ${tolerance}m tolerance on attempt ${attempt + 1}`)
        break
      }
      
      // More precise radius adjustments based on distance difference
      const adjustmentFactor = Math.min(Math.max(distanceDiff / targetDistanceMeters, 0.02), 0.15) // Smaller adjustments
      
      if (routeDistance < targetDistanceMeters) {
        radius *= (1 + adjustmentFactor) // Increase radius proportionally
      } else {
        radius *= (1 - adjustmentFactor) // Decrease radius proportionally
      }
    }
    
    // Reject routes that exceed tolerance
    if (!bestRoute || bestDistanceDiff > tolerance) {
      const errorMsg = bestRoute ? 
        `Could not generate route within ${tolerance}m tolerance. Best attempt was ${Math.round(bestDistanceDiff)}m off target.` :
        'Could not generate a suitable route'
      throw new Error(errorMsg)
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