import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { analyticsService } from '@/services/analytics.service';

/**
 * Hook to track page views automatically when route changes
 */
export const usePageTracking = () => {
  const location = useLocation();

  useEffect(() => {
    // Track page view on route change
    analyticsService.trackPageView(location.pathname + location.search);
  }, [location]);
};
