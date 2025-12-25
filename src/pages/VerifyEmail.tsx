import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';
import { useTheme } from 'next-themes';
import logoWhite from '@/assets/logo-white.png';
import logoBlack from '@/assets/logo-black.png';

type VerificationState = 'processing' | 'success' | 'error' | 'no-params';

interface ErrorInfo {
  code: string;
  description: string;
}

const VerifyEmail = () => {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const [state, setState] = useState<VerificationState>('processing');
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  const [countdown, setCountdown] = useState(5);
  const [resendEmail, setResendEmail] = useState('');
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    const handleVerification = async () => {
      const hash = window.location.hash;
      
      if (!hash || hash === '#') {
        setState('no-params');
        return;
      }

      const params = new URLSearchParams(hash.substring(1));
      
      // Check for error in the hash
      const error = params.get('error');
      if (error) {
        const errorCode = params.get('error_code') || 'unknown';
        const errorDescription = params.get('error_description') || 'An error occurred during verification.';
        setErrorInfo({
          code: errorCode,
          description: decodeURIComponent(errorDescription.replace(/\+/g, ' ')),
        });
        setState('error');
        return;
      }

      // Check for access token (success case)
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const type = params.get('type');

      if (accessToken && refreshToken) {
        try {
          // Set the session using the tokens from the URL
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            setErrorInfo({
              code: 'session_error',
              description: sessionError.message,
            });
            setState('error');
            return;
          }

          setState('success');
        } catch (err) {
          setErrorInfo({
            code: 'unexpected_error',
            description: 'An unexpected error occurred. Please try again.',
          });
          setState('error');
        }
      } else {
        setState('no-params');
      }
    };

    handleVerification();
  }, []);

  // Countdown and redirect for success state
  useEffect(() => {
    if (state !== 'success') return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [state, navigate]);

  const getErrorMessage = (code: string): string => {
    switch (code) {
      case 'otp_expired':
        return 'Your verification link has expired. Please request a new one.';
      case 'access_denied':
        return 'Unable to verify your email. The link may be invalid or already used.';
      case 'session_error':
        return 'Failed to create your session. Please try signing in.';
      default:
        return 'An error occurred during verification. Please try again.';
    }
  };

  const handleResendEmail = async () => {
    if (!resendEmail) return;
    
    setIsResending(true);
    try {
      const redirectUrl = import.meta.env.PROD 
        ? 'https://run-lap.com/verify-email' 
        : `${window.location.origin}/verify-email`;

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: resendEmail,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        console.error('Resend error:', error);
      }
    } catch (err) {
      console.error('Resend error:', err);
    } finally {
      setIsResending(false);
      // Always show success message to prevent email enumeration
      setErrorInfo({
        code: 'resent',
        description: 'If an account exists with this email, a new verification link has been sent.',
      });
    }
  };

  const logo = resolvedTheme === 'dark' ? logoWhite : logoBlack;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <img src={logo} alt="RunLap" className="h-12 mx-auto mb-4" />
        </CardHeader>
        <CardContent className="text-center space-y-6">
          {state === 'processing' && (
            <>
              <div className="flex justify-center">
                <Loader2 className="h-16 w-16 text-primary animate-spin" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Verifying your email...</h2>
                <p className="text-muted-foreground mt-2">Please wait while we confirm your account.</p>
              </div>
            </>
          )}

          {state === 'success' && (
            <>
              <div className="flex justify-center">
                <div className="rounded-full bg-success/10 p-4">
                  <CheckCircle className="h-16 w-16 text-success" />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Email Verified!</h2>
                <p className="text-muted-foreground mt-2">
                  Your account has been successfully verified.
                </p>
                <p className="text-muted-foreground mt-4 text-sm">
                  Redirecting to home in {countdown} second{countdown !== 1 ? 's' : ''}...
                </p>
              </div>
              <Button 
                onClick={() => navigate('/')} 
                className="w-full bg-beige hover:bg-beige-hover text-beige-foreground rounded-full"
              >
                Go to Home Now
              </Button>
            </>
          )}

          {state === 'error' && (
            <>
              <div className="flex justify-center">
                <div className="rounded-full bg-destructive/10 p-4">
                  <XCircle className="h-16 w-16 text-destructive" />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Verification Failed</h2>
                <p className="text-muted-foreground mt-2">
                  {errorInfo ? getErrorMessage(errorInfo.code) : 'An error occurred.'}
                </p>
              </div>
              
              {errorInfo?.code !== 'resent' && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Enter your email to receive a new verification link:
                  </p>
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-4 py-2 rounded-full border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <Button
                    onClick={handleResendEmail}
                    disabled={!resendEmail || isResending}
                    className="w-full bg-beige hover:bg-beige-hover text-beige-foreground rounded-full"
                  >
                    {isResending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Resend Verification Email
                      </>
                    )}
                  </Button>
                </div>
              )}

              {errorInfo?.code === 'resent' && (
                <p className="text-sm text-success">
                  {errorInfo.description}
                </p>
              )}

              <Button
                variant="outline"
                onClick={() => navigate('/auth')}
                className="w-full rounded-full"
              >
                Back to Sign In
              </Button>
            </>
          )}

          {state === 'no-params' && (
            <>
              <div className="flex justify-center">
                <div className="rounded-full bg-info/10 p-4">
                  <Mail className="h-16 w-16 text-info" />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Check Your Email</h2>
                <p className="text-muted-foreground mt-2">
                  We've sent you a verification link. Click the link in your email to verify your account.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => navigate('/auth')}
                className="w-full rounded-full"
              >
                Back to Sign In
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyEmail;