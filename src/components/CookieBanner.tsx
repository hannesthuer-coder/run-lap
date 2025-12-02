import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const COOKIE_CONSENT_KEY = 'runlap_cookie_consent';

export function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      setShowBanner(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-card border-t border-border shadow-lg animate-in slide-in-from-bottom duration-300">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-foreground text-center sm:text-left">
          We use cookies to ensure the service functions correctly and to provide you with the best experience. 
          By continuing to use Run-Lap, you agree to our use of cookies.{" "}
          <Link to="/privacy" className="text-beige-foreground hover:underline font-medium">
            Read more in our Privacy Policy
          </Link>
        </p>
        <Button
          onClick={handleAccept}
          className="bg-beige hover:bg-beige-hover text-beige-foreground rounded-full px-6 whitespace-nowrap"
        >
          I understand
        </Button>
      </div>
    </div>
  );
}
