/**
 * Google Analytics 4 (GA4) Analytics Service
 * Tracks key user actions in the app
 */

// Extend window to include gtag
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

type EventCategory = 
  | 'route'
  | 'navigation'
  | 'subscription'
  | 'running'
  | 'auth'
  | 'share';

interface EventParams {
  category: EventCategory;
  label?: string;
  value?: number;
  [key: string]: any;
}

class AnalyticsService {
  private initialized = false;
  private measurementId: string | null = null;

  /**
   * Initialize Google Analytics with measurement ID
   */
  initialize(measurementId: string): void {
    if (this.initialized || !measurementId) return;

    this.measurementId = measurementId;

    // Add gtag script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);

    // Initialize dataLayer
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };

    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      send_page_view: false, // We'll track page views manually
    });

    this.initialized = true;
    console.log('Analytics initialized');
  }

  /**
   * Track page view
   */
  trackPageView(pagePath: string, pageTitle?: string): void {
    if (!this.initialized) return;

    window.gtag('event', 'page_view', {
      page_path: pagePath,
      page_title: pageTitle || document.title,
    });
  }

  /**
   * Track custom event
   */
  trackEvent(eventName: string, params: EventParams): void {
    if (!this.initialized) return;

    window.gtag('event', eventName, {
      event_category: params.category,
      event_label: params.label,
      value: params.value,
      ...params,
    });
  }

  // ============ Route Events ============

  trackRouteGenerated(distance: number, unit: string, location: string): void {
    this.trackEvent('route_generated', {
      category: 'route',
      label: `${distance} ${unit}`,
      distance,
      unit,
      location: location.substring(0, 50), // Truncate for privacy
    });
  }

  trackRouteRegenerated(distance: number, unit: string): void {
    this.trackEvent('route_regenerated', {
      category: 'route',
      label: `${distance} ${unit}`,
      distance,
      unit,
    });
  }

  trackRouteSaved(routeName: string, distance: number, unit: string): void {
    this.trackEvent('route_saved', {
      category: 'route',
      label: routeName,
      distance,
      unit,
    });
  }

  trackRouteDeleted(): void {
    this.trackEvent('route_deleted', {
      category: 'route',
    });
  }

  trackRouteShared(method: 'link' | 'copy'): void {
    this.trackEvent('route_shared', {
      category: 'share',
      label: method,
    });
  }

  // ============ Running Events ============

  trackRunStarted(distance: number, unit: string): void {
    this.trackEvent('run_started', {
      category: 'running',
      label: `${distance} ${unit}`,
      distance,
      unit,
    });
  }

  trackRunCompleted(distance: number, unit: string, elapsedTimeSeconds: number): void {
    this.trackEvent('run_completed', {
      category: 'running',
      label: `${distance} ${unit}`,
      distance,
      unit,
      duration_seconds: elapsedTimeSeconds,
      duration_minutes: Math.round(elapsedTimeSeconds / 60),
    });
  }

  trackRunPaused(): void {
    this.trackEvent('run_paused', {
      category: 'running',
    });
  }

  trackRunResumed(): void {
    this.trackEvent('run_resumed', {
      category: 'running',
    });
  }

  trackRunExited(completionPercentage: number): void {
    this.trackEvent('run_exited', {
      category: 'running',
      label: `${completionPercentage.toFixed(0)}% complete`,
      value: Math.round(completionPercentage),
    });
  }

  // ============ Auth Events ============

  trackSignUp(method: 'email' | 'google' | 'magic_link'): void {
    this.trackEvent('sign_up', {
      category: 'auth',
      label: method,
    });
  }

  trackSignIn(method: 'email' | 'google' | 'magic_link'): void {
    this.trackEvent('sign_in', {
      category: 'auth',
      label: method,
    });
  }

  trackSignOut(): void {
    this.trackEvent('sign_out', {
      category: 'auth',
    });
  }

  // ============ Subscription Events ============

  trackUpgradeModalOpened(trigger: string): void {
    this.trackEvent('upgrade_modal_opened', {
      category: 'subscription',
      label: trigger,
    });
  }

  trackUpgradeClicked(): void {
    this.trackEvent('upgrade_clicked', {
      category: 'subscription',
    });
  }

  trackSubscriptionStarted(): void {
    this.trackEvent('subscription_started', {
      category: 'subscription',
    });
  }

  // ============ Navigation Events ============

  trackPreferencesSet(distance: number, unit: string): void {
    this.trackEvent('preferences_set', {
      category: 'navigation',
      label: `${distance} ${unit}`,
      distance,
      unit,
    });
  }

  trackLocationSelected(locationType: 'current' | 'search'): void {
    this.trackEvent('location_selected', {
      category: 'navigation',
      label: locationType,
    });
  }

  // ============ User Properties ============

  setUserProperties(properties: { isPremium?: boolean; userId?: string }): void {
    if (!this.initialized) return;

    window.gtag('set', 'user_properties', {
      is_premium: properties.isPremium ? 'yes' : 'no',
      user_id: properties.userId,
    });
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
