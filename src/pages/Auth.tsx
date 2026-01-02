import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import logoBlack from '@/assets/logo-black.png';
import logoWhite from '@/assets/logo-white.png';

const Auth = () => {
  const navigate = useNavigate();
  const { signUp, signIn, user } = useAuth();
  const { theme, systemTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const logo = currentTheme === 'dark' ? logoWhite : logoBlack;

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const [signUpForm, setSignUpForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [signInForm, setSignInForm] = useState({
    email: '',
    password: '',
  });

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signUpForm.email || !signUpForm.password) {
      toast({
        title: "Error",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    if (signUpForm.password.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }

    if (signUpForm.password !== signUpForm.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { error } = await signUp(signUpForm.email, signUpForm.password);
    setLoading(false);

    if (error) {
      if (error.message.includes('already registered')) {
        toast({
          title: "Error",
          description: "This email is already registered. Please sign in instead.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to create account. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signInForm.email || !signInForm.password) {
      toast({
        title: "Error",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { error } = await signIn(signInForm.email, signInForm.password);
    setLoading(false);

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        toast({
          title: "Error",
          description: "Invalid email or password.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to sign in. Please try again.",
          variant: "destructive",
        });
      }
    } else {
      navigate('/');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!forgotPasswordEmail) {
      toast({
        title: "error",
        description: "please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    setForgotPasswordLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotPasswordLoading(false);

    if (error) {
      toast({
        title: "error",
        description: error.message || "failed to send reset email. please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "check your email",
        description: "if an account exists with this email, you'll receive a password reset link.",
      });
      setShowForgotPassword(false);
      setForgotPasswordEmail('');
    }
  };

  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Helmet>
          <title>Reset Password | Run-Lap</title>
          <meta name="description" content="Reset your Run-Lap password to regain access to your account and saved running routes." />
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center">
              <img src={logo} alt="Run-Lap" className="h-16 w-auto" />
            </div>
            <CardDescription>enter your email to reset your password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="your@email.com"
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  disabled={forgotPasswordLoading}
                  required
                  className="rounded-full"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-beige hover:bg-beige-hover text-beige-foreground rounded-full font-semibold tracking-wide"
                disabled={forgotPasswordLoading}
              >
                {forgotPasswordLoading ? 'sending...' : 'send reset link'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full rounded-full"
                onClick={() => setShowForgotPassword(false)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                back to sign in
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Helmet>
        <title>Sign In or Create Account | Run-Lap</title>
        <meta name="description" content="Sign in or create a Run-Lap account to save your favorite running routes, access premium features, and track your progress." />
        <link rel="canonical" href="https://run-lap.com/auth" />
        <meta property="og:title" content="Sign In or Create Account | Run-Lap" />
        <meta property="og:description" content="Join Run-Lap to save routes, unlock premium features, and get unlimited AI-generated running laps." />
        <meta property="og:url" content="https://run-lap.com/auth" />
      </Helmet>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center">
            <img src={logo} alt="Run-Lap" className="h-16 w-auto" />
          </div>
          <p className="text-sm text-muted-foreground">create an account or sign in to continue</p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-full">
              <TabsTrigger value="signin" className="rounded-full">sign in</TabsTrigger>
              <TabsTrigger value="signup" className="rounded-full">sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="your@email.com"
                    value={signInForm.email}
                    onChange={(e) => setSignInForm({ ...signInForm, email: e.target.value })}
                    disabled={loading}
                    required
                    className="rounded-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signin-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={signInForm.password}
                      onChange={(e) => setSignInForm({ ...signInForm, password: e.target.value })}
                      disabled={loading}
                      required
                      className="rounded-full"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-muted-foreground hover:text-foreground underline"
                >
                  forgot your password?
                </button>
                <Button
                  type="submit"
                  className="w-full bg-beige hover:bg-beige-hover text-beige-foreground rounded-full font-semibold tracking-wide"
                  disabled={loading}
                >
                  {loading ? 'signing in...' : 'sign in'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="your@email.com"
                    value={signUpForm.email}
                    onChange={(e) => setSignUpForm({ ...signUpForm, email: e.target.value })}
                    disabled={loading}
                    required
                    className="rounded-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={signUpForm.password}
                      onChange={(e) => setSignUpForm({ ...signUpForm, password: e.target.value })}
                      disabled={loading}
                      required
                      minLength={8}
                      className="rounded-full"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">At least 8 characters</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm">Confirm Password</Label>
                  <Input
                    id="signup-confirm"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={signUpForm.confirmPassword}
                    onChange={(e) => setSignUpForm({ ...signUpForm, confirmPassword: e.target.value })}
                    disabled={loading}
                    required
                    className="rounded-full"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-beige hover:bg-beige-hover text-beige-foreground rounded-full font-semibold tracking-wide"
                  disabled={loading}
                >
                  {loading ? 'creating account...' : 'create account'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
