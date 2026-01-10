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
    const { startLng, startLat, distance, unit, fingerprint } = await req.json()
    
    // Validate inputs
    if (!startLng || !startLat || !distance || !unit) {
      throw new Error('Missing required parameters')
    }
    
    if (typeof startLng !== 'number' || typeof startLat !== 'number' || typeof distance !== 'number') {
      throw new Error('Invalid parameter types')
    }
    
    if (distance <= 0 || distance > 500) {
      console.error('Invalid distance:', distance)
      throw new Error('Invalid parameters')
    }
    
    if (!['km', 'miles'].includes(unit)) {
      console.error('Invalid unit:', unit)
      throw new Error('Invalid parameters')
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Try to get authenticated user (optional for anonymous users)
    const authHeader = req.headers.get('Authorization')
    let userId: string | null = null
    let isPremium = false
    
    if (authHeader) {
      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } }
      })
      
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (!authError && user) {
        userId = user.id
        console.log('Authenticated user:', userId)
        
        // Check subscription status for authenticated users
        const { data: profile } = await supabase
          .from('profiles')
          .select('subscription_status, subscription_expires_at')
          .eq('id', user.id)
          .single()
        
        isPremium = profile?.subscription_status === 'premium' && 
          (profile?.subscription_expires_at === null || 
           !profile?.subscription_expires_at ||
           new Date(profile.subscription_expires_at) > new Date())
        
        if (isPremium) {
          console.log('Premium user - no route limit')
        }
      }
    }
    
    // Use service role for database queries that bypass RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    
    // Check route limit based on user type
    if (!isPremium) {
      const FREE_ROUTE_LIMIT = 5
      const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      
      if (userId) {
        // Authenticated free user - check by user_id
        const { data: routeGenerations } = await supabaseAdmin
          .from('route_generations')
          .select('id', { count: 'exact', head: false })
          .eq('user_id', userId)
          .gte('created_at', last30Days)
        
        const routeCount = routeGenerations?.length || 0
        console.log(`Authenticated user route count: ${routeCount}/${FREE_ROUTE_LIMIT}`)
        
        if (routeCount >= FREE_ROUTE_LIMIT) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Route limit reached',
              limit: FREE_ROUTE_LIMIT,
              used: routeCount,
              requiresUpgrade: true
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      } else {
        // Anonymous user - check by fingerprint
        if (!fingerprint || typeof fingerprint !== 'string' || fingerprint.length < 10) {
          console.error('Missing or invalid fingerprint for anonymous user')
          return new Response(
            JSON.stringify({ success: false, error: 'Fingerprint required for anonymous users' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || ''
        
        const { data: count, error: countError } = await supabaseAdmin.rpc('count_routes_by_fingerprint', {
          _fingerprint: fingerprint,
          _ip_address: ipAddress,
          _since: last30Days
        })
        
        if (countError) {
          console.error('Error counting routes:', countError)
        }
        
        const routeCount = count || 0
        console.log(`Anonymous user route count: ${routeCount}/${FREE_ROUTE_LIMIT}`)
        
        if (routeCount >= FREE_ROUTE_LIMIT) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Route limit reached',
              limit: FREE_ROUTE_LIMIT,
              used: routeCount,
              requiresUpgrade: true
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    }
    
    const MAPBOX_TOKEN = Deno.env.get('MAPBOX_ACCESS_TOKEN')
    
    if (!MAPBOX_TOKEN) {
      console.error('MAPBOX_ACCESS_TOKEN not configured')
      throw new Error('Service configuration error')
    }
    
    console.log('Mapbox token: Available')
    
    // Convert distance to meters
    const targetDistanceMeters = unit === 'km' ? distance * 1000 : distance * 1609.34
    console.log(`Target distance: ${targetDistanceMeters}m`)

    // Helper function to calculate bearing between two points (in degrees)
    const calculateBearing = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
      const dLng = (lng2 - lng1) * Math.PI / 180
      const lat1Rad = lat1 * Math.PI / 180
      const lat2Rad = lat2 * Math.PI / 180
      
      const y = Math.sin(dLng) * Math.cos(lat2Rad)
      const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
                Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng)
      
      const bearing = Math.atan2(y, x) * 180 / Math.PI
      return (bearing + 360) % 360
    }

    // Helper function to calculate distance between two points (in meters)
    const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
      const R = 6371000 // Earth radius in meters
      const dLat = (lat2 - lat1) * Math.PI / 180
      const dLng = (lng2 - lng1) * Math.PI / 180
      
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2)
      
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      return R * c
    }

    // Helper function to calculate normalized angle difference
    const angleDifference = (angle1: number, angle2: number): number => {
      let diff = Math.abs(angle1 - angle2)
      if (diff > 180) {
        diff = 360 - diff
      }
      return diff
    }

    // Function to remove spikes from route coordinates (lowered thresholds)
    const removeSpikesFromRoute = (coordinates: [number, number][]) => {
      let cleanedCoords = [...coordinates]
      let totalSpikesRemoved = 0
      let originalDistance = 0
      
      // Calculate original distance
      for (let i = 0; i < cleanedCoords.length - 1; i++) {
        originalDistance += calculateDistance(
          cleanedCoords[i][1], cleanedCoords[i][0],
          cleanedCoords[i + 1][1], cleanedCoords[i + 1][0]
        )
      }
      
      // Multi-pass spike removal (up to 3 passes)
      for (let pass = 0; pass < 3; pass++) {
        let foundSpike = false
        let i = 1
        
        while (i < cleanedCoords.length - 2) {
          const pointBefore = cleanedCoords[i - 1]
          const currentPoint = cleanedCoords[i]
          
          // Look ahead up to 8 points to find potential spike end (increased from 5)
          let maxLookAhead = Math.min(i + 8, cleanedCoords.length - 1)
          
          for (let j = i + 1; j <= maxLookAhead; j++) {
            const pointAfter = cleanedCoords[j]
            
            // Calculate bearings
            const bearingIn = calculateBearing(
              pointBefore[1], pointBefore[0],
              currentPoint[1], currentPoint[0]
            )
            const bearingOut = calculateBearing(
              currentPoint[1], currentPoint[0],
              pointAfter[1], pointAfter[0]
            )
            
            // Check for ~180° reversal (spike indicator) - widened from 150-210 to 140-220
            const angleDiff = angleDifference(bearingIn, bearingOut)
            
            if (angleDiff > 140 && angleDiff < 220) {
              // Potential spike detected - verify with distance ratio
              const straightLineDist = calculateDistance(
                pointBefore[1], pointBefore[0],
                pointAfter[1], pointAfter[0]
              )
              
              // Calculate path distance through the spike
              let pathDist = 0
              for (let k = i - 1; k < j; k++) {
                pathDist += calculateDistance(
                  cleanedCoords[k][1], cleanedCoords[k][0],
                  cleanedCoords[k + 1][1], cleanedCoords[k + 1][0]
                )
              }
              
              // If path is much longer than straight line, it's a spike (lowered from 2.5 to 2.0)
              const ratio = straightLineDist > 0 ? pathDist / straightLineDist : 0
              
              if (ratio > 2.0) {
                // Remove spike points (from i to j-1)
                console.log(`  Spike detected at index ${i}: angle=${angleDiff.toFixed(1)}°, ratio=${ratio.toFixed(2)}, removing ${j - i} points`)
                cleanedCoords.splice(i, j - i)
                totalSpikesRemoved++
                foundSpike = true
                break
              }
            }
          }
          
          if (!foundSpike) {
            i++
          } else {
            // Reset i after spike removal to check the same area again
            foundSpike = false
          }
        }
        
        if (totalSpikesRemoved === 0 && pass === 0) {
          // No spikes found in first pass, no need to continue
          break
        }
      }
      
      // Calculate new distance after spike removal
      let newDistance = 0
      for (let i = 0; i < cleanedCoords.length - 1; i++) {
        newDistance += calculateDistance(
          cleanedCoords[i][1], cleanedCoords[i][0],
          cleanedCoords[i + 1][1], cleanedCoords[i + 1][0]
        )
      }
      
      return {
        coordinates: cleanedCoords,
        totalDistance: newDistance,
        spikesRemoved: totalSpikesRemoved,
        distanceSaved: originalDistance - newDistance
      }
    }

    // Function to detect and remove "lollipop" detour patterns
    const removeDetoursFromRoute = (coordinates: [number, number][]) => {
      let cleanedCoords = [...coordinates]
      let detoursRemoved = 0
      
      let i = 0
      while (i < cleanedCoords.length - 10) {
        const basePoint = cleanedCoords[i]
        
        // Check if any point 5-25 positions ahead is very close to this point
        for (let j = i + 5; j < Math.min(i + 25, cleanedCoords.length); j++) {
          const checkPoint = cleanedCoords[j]
          const directDistance = calculateDistance(
            basePoint[1], basePoint[0],
            checkPoint[1], checkPoint[0]
          )
          
          // If points are within 60m, this might be a detour loop
          if (directDistance < 60) {
            // Calculate path distance between these points
            let pathDistance = 0
            for (let k = i; k < j; k++) {
              pathDistance += calculateDistance(
                cleanedCoords[k][1], cleanedCoords[k][0],
                cleanedCoords[k + 1][1], cleanedCoords[k + 1][0]
              )
            }
            
            // If the path distance is much longer than the proximity, it's a detour
            // Path must be >80m and ratio >3 to be considered a detour
            if (pathDistance > 80 && directDistance > 0 && pathDistance / directDistance > 3) {
              console.log(`  Detour detected at index ${i}-${j}: path=${pathDistance.toFixed(0)}m, direct=${directDistance.toFixed(0)}m, ratio=${(pathDistance/directDistance).toFixed(1)}`)
              // Remove the detour segment (keep the endpoints close together)
              cleanedCoords.splice(i + 1, j - i - 1)
              detoursRemoved++
              break
            }
          }
        }
        i++
      }
      
      // Calculate final distance
      let totalDistance = 0
      for (let i = 0; i < cleanedCoords.length - 1; i++) {
        totalDistance += calculateDistance(
          cleanedCoords[i][1], cleanedCoords[i][0],
          cleanedCoords[i + 1][1], cleanedCoords[i + 1][0]
        )
      }
      
      return {
        coordinates: cleanedCoords,
        totalDistance,
        detoursRemoved
      }
    }

    // Calculate route quality score (lower is better)
    const calculateRouteQuality = (coordinates: [number, number][]) => {
      let sharpTurns = 0
      
      // Count sharp direction reversals
      for (let i = 2; i < coordinates.length - 2; i++) {
        const bearingIn = calculateBearing(
          coordinates[i - 2][1], coordinates[i - 2][0],
          coordinates[i][1], coordinates[i][0]
        )
        const bearingOut = calculateBearing(
          coordinates[i][1], coordinates[i][0],
          coordinates[i + 2][1], coordinates[i + 2][0]
        )
        
        const turn = angleDifference(bearingIn, bearingOut)
        if (turn > 120) {
          sharpTurns++
        }
      }
      
      // Calculate path efficiency (straight-line start-to-farthest vs total path)
      let maxDistFromStart = 0
      for (const coord of coordinates) {
        const dist = calculateDistance(
          coordinates[0][1], coordinates[0][0],
          coord[1], coord[0]
        )
        if (dist > maxDistFromStart) maxDistFromStart = dist
      }
      
      let totalPathDistance = 0
      for (let i = 0; i < coordinates.length - 1; i++) {
        totalPathDistance += calculateDistance(
          coordinates[i][1], coordinates[i][0],
          coordinates[i + 1][1], coordinates[i + 1][0]
        )
      }
      
      // For a loop, ideal efficiency is around 0.25-0.4 (farthest point is 1/4 to 1/3 of total path)
      const efficiency = maxDistFromStart / totalPathDistance
      
      // Penalize excessive sharp turns (more than 1 per 500m is suspicious)
      const turnsPerKm = (sharpTurns / totalPathDistance) * 1000
      
      return {
        sharpTurns,
        efficiency,
        turnsPerKm,
        // Quality score: lower is better
        score: turnsPerKm * 10 + (efficiency < 0.15 ? 50 : 0)
      }
    }

    // Simple function to get walking route between two points
    const getWalkingRoute = async (fromLng, fromLat, toLng, toLat) => {
      const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${fromLng},${fromLat};${toLng},${toLat}?` + 
        `geometries=geojson&access_token=${MAPBOX_TOKEN}&overview=full&steps=true&exclude=ferry`
      
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

    // Smart route generation with road factor compensation
    const createNaturalLoop = async (targetDistance, seed = Math.random(), attempt = 1) => {
      console.log(`\n=== Creating natural loop (seed: ${seed.toFixed(3)}, attempt: ${attempt}) ===`)
      
      // Road factor compensation - actual walking routes are 1.4-1.7x longer than geometric
      let roadFactor = 0.65; // Start conservatively 
      
      // Adjust road factor based on previous attempts
      if (attempt > 1) {
        roadFactor = 0.5 + (attempt * 0.05); // Get more aggressive: 0.55, 0.60, 0.65, 0.70...
      }
      
      const compensatedTarget = targetDistance * roadFactor;
      console.log(`Target: ${targetDistance}m, Compensated: ${compensatedTarget.toFixed(0)}m (road factor: ${roadFactor.toFixed(2)})`)
      
      // Choose initial direction
      const baseDirection = 45 + (seed * 270) // 45-315 degrees
      console.log(`Initial direction: ${baseDirection.toFixed(1)}°`)
      
      let totalDistance = 0
      let allCoordinates = [[startLng, startLat]]
      let currentLng = startLng
      let currentLat = startLat
      let currentBearing = baseDirection
      
      // Vary segment count based on attempt and target distance
      // Use fewer segments for shorter routes to reduce complexity and detours
      let baseSegments = targetDistance < 5000 ? 4 : 6; // Fewer segments for short routes
      if (targetDistance < 3000) baseSegments = 3; // Even fewer for very short routes
      
      const segments = Math.max(3, baseSegments - Math.floor(attempt / 3)); // Reduce on later attempts
      const segmentDistance = compensatedTarget / segments
      const turnAngle = 360 / segments
      
      console.log(`Creating ${segments} segments of ~${segmentDistance.toFixed(0)}m each with ${turnAngle.toFixed(1)}° turns (distance: ${targetDistance}m)`)
      
      for (let i = 0; i < segments; i++) {
        // Reduce variation for later attempts to be more predictable
        const maxVariation = Math.max(0.1, 0.3 - (attempt * 0.05));
        const variation = (seed - 0.5) * maxVariation;
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
          // Reduce turn variation for later attempts
          const turnVariation = Math.max(5, 20 - (attempt * 3));
          currentBearing = (currentBearing + turnAngle + (seed - 0.5) * turnVariation) % 360
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
      
      const actualRoadFactor = totalDistance / compensatedTarget;
      console.log(`Final: ${totalDistance}m, Compensated target: ${compensatedTarget.toFixed(0)}m, Actual road factor: ${actualRoadFactor.toFixed(2)}`)
      console.log(`Distance from real target: ${Math.abs(totalDistance - targetDistance)}m`)
      
      return {
        coordinates: allCoordinates,
        distance: totalDistance,
        duration: 0,
        roadFactor: actualRoadFactor
      }
    }

    // Try multiple variations with progressive improvement
    let bestRoute = null
    let bestDistanceDiff = Infinity
    const tolerance = 500 // STRICT ±500m tolerance
    
    console.log(`Target: ${targetDistanceMeters}m, Tolerance: ±${tolerance}m (STRICT ENFORCEMENT)`)
    
    // Progressive attempts with different strategies
    for (let attempt = 1; attempt <= 15; attempt++) {
      try {
        const seed = (Date.now() + attempt * 1000) % 10000 / 10000
        console.log(`\n--- Attempt ${attempt}/15 ---`)
        
        const route = await createNaturalLoop(targetDistanceMeters, seed, attempt)
        
        if (!route) {
          console.log('No route generated')
          continue
        }
        
        const distanceDiff = Math.abs(route.distance - targetDistanceMeters)
        console.log(`Route: ${route.distance}m (diff: ${distanceDiff}m, road factor: ${route.roadFactor.toFixed(2)})`)
        
        // Track best route even if outside tolerance for potential fallback
        if (distanceDiff < bestDistanceDiff) {
          bestRoute = route
          bestDistanceDiff = distanceDiff
          console.log('✓ New best route')
        }
        
        // Accept routes within strict tolerance
        if (distanceDiff <= tolerance) {
          console.log('✓ Route within ±500m tolerance - ACCEPTED')
          bestRoute = route
          bestDistanceDiff = distanceDiff
          break
        } else {
          console.log(`✗ Route outside tolerance (${distanceDiff}m > ${tolerance}m) - REJECTED`)
        }
        
        // Early exit if we're getting close (within 100m extra tolerance after attempt 10)
        if (attempt > 10 && distanceDiff <= tolerance + 100) {
          console.log(`✓ Close enough after ${attempt} attempts - ACCEPTED (${distanceDiff}m tolerance)`)
          break
        }
        
      } catch (error) {
        console.log(`Attempt ${attempt} failed: ${error.message}`)
      }
    }
    
    // Enforce tolerance with a small grace period for very close results
    const finalTolerance = tolerance + (bestDistanceDiff > tolerance ? 0 : 0); // No grace period
    if (!bestRoute || bestDistanceDiff > finalTolerance) {
      const message = bestRoute 
        ? `Could not generate route within ±${tolerance}m tolerance. Best attempt was ${bestDistanceDiff.toFixed(0)}m off target (${bestRoute.distance.toFixed(0)}m vs ${targetDistanceMeters}m target). Try a different location or distance.`
        : 'Could not generate any valid route after 15 attempts'
      throw new Error(message)
    }
    
    console.log(`\n🎯 ACCEPTED route: ${bestRoute.distance}m (${bestDistanceDiff.toFixed(0)}m from target - within tolerance)`)
    
    // Remove spikes from the route before returning
    const cleanedResult = removeSpikesFromRoute(bestRoute.coordinates)
    console.log(`🔧 Spike removal: ${cleanedResult.spikesRemoved} spikes removed, ${cleanedResult.distanceSaved.toFixed(0)}m saved`)
    
    // Remove detour loops
    const detourResult = removeDetoursFromRoute(cleanedResult.coordinates)
    console.log(`🔧 Detour removal: ${detourResult.detoursRemoved} detours removed`)
    
    // Calculate route quality
    const quality = calculateRouteQuality(detourResult.coordinates)
    console.log(`📊 Route quality: ${quality.sharpTurns} sharp turns, efficiency=${quality.efficiency.toFixed(2)}, turnsPerKm=${quality.turnsPerKm.toFixed(1)}, score=${quality.score.toFixed(1)}`)
    
    return new Response(
      JSON.stringify({
        success: true,
        route: {
          geometry: {
            type: 'LineString',
            coordinates: detourResult.coordinates
          },
          distance: detourResult.totalDistance,
          duration: bestRoute.duration,
          waypoints: []
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
    
  } catch (error) {
    console.error('Error generating route:', error.message, error.stack)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Route generation failed. Please try again.' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
