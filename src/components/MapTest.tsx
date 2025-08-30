import React, { useEffect, useRef } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';

const MapTest = () => {
  const mapContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log('MapTest component mounted');
    console.log('Map container ref:', mapContainer.current);
    
    const initMap = async () => {
      console.log('Starting map initialization...');
      
      try {
        // Direct import and setup
        const mapboxgl = (await import('mapbox-gl')).default;
        console.log('Mapbox GL loaded:', mapboxgl);
        
        // Use token directly
        mapboxgl.accessToken = 'pk.eyJ1IjoiaGFubmVzdGh1cjEyMyIsImEiOiJjbWV2cTk2Y2kwY3J4MmpzN2N3YWFpdXRtIn0.HMwsWwD4VsglAlp3kjultg';
        console.log('Token set');
        
        if (!mapContainer.current) {
          console.error('No map container found');
          return;
        }
        
        console.log('Creating map...');
        const map = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: [-74.5, 40],
          zoom: 9
        });
        
        console.log('Map created:', map);
        
        map.on('load', () => {
          console.log('Map loaded successfully!');
        });
        
        map.on('error', (e: any) => {
          console.error('Map error:', e);
        });
        
      } catch (error) {
        console.error('Failed to initialize map:', error);
      }
    };
    
    initMap();
  }, []);

  return (
    <div className="w-full h-96 border border-gray-300 rounded">
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
};

export default MapTest;