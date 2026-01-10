import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { analyticsService } from '@/services/analytics.service';

/**
 * Component to track page views automatically when route changes
 * Place inside BrowserRouter
 */
export const PageTracker = () => {
  const location = useLocation();

  useEffect(() => {
    // Track page view on route change
    analyticsService.trackPageView(location.pathname + location.search);
  }, [location]);

  return null;
};
