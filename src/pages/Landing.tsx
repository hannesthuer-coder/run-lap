import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Instagram, Mail, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import logoWhite from "@/assets/logo-white.png";
import logoBlack from "@/assets/logo-black.png";
const LAUNCH_DATE = new Date("2026-03-01T00:00:00").getTime();
interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}
const Landing = () => {
  const {
    resolvedTheme
  } = useTheme();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });
  const logo = resolvedTheme === "dark" ? logoWhite : logoBlack;

  // Countdown timer
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const difference = LAUNCH_DATE - now;
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor(difference % (1000 * 60 * 60 * 24) / (1000 * 60 * 60)),
          minutes: Math.floor(difference % (1000 * 60 * 60) / (1000 * 60)),
          seconds: Math.floor(difference % (1000 * 60) / 1000)
        });
      }
    };
    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, []);

  // Capture UTM parameters
  const getUtmParams = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return {
      source: urlParams.get("utm_source") || null,
      campaign: urlParams.get("utm_campaign") || null,
      medium: urlParams.get("utm_medium") || null,
      referrer: document.referrer || null
    };
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast({
        title: "invalid email",
        description: "please enter a valid email address",
        variant: "destructive"
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const utmParams = getUtmParams();
      const {
        error
      } = await supabase.from("waitlist").insert({
        email: email.toLowerCase().trim(),
        source: utmParams.source,
        campaign: utmParams.campaign,
        medium: utmParams.medium,
        referrer: utmParams.referrer
      });
      if (error) {
        if (error.code === "23505") {
          toast({
            title: "already signed up",
            description: "this email is already on the waitlist"
          });
        } else {
          throw error;
        }
      } else {
        setIsSubmitted(true);
        toast({
          title: "you're on the list!",
          description: "we'll email you when we launch"
        });
      }
    } catch (error) {
      console.error("Waitlist signup error:", error);
      toast({
        title: "something went wrong",
        description: "please try again later",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  const TimeBlock = ({
    value,
    label
  }: {
    value: number;
    label: string;
  }) => <div className="flex flex-col items-center">
      <span className="text-2xl sm:text-4xl font-bold text-beige-foreground tabular-nums">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-xs sm:text-sm text-muted-foreground mt-1">{label}</span>
    </div>;
  return <div className="min-h-screen bg-background flex flex-col">
      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Logo */}
        <img src={logo} alt="run-lap logo" className="h-20 w-20 sm:h-24 sm:w-24 mb-8 animate-fade-in opacity-0" style={{
        animationDelay: '0ms',
        animationFillMode: 'forwards'
      }} />

        {/* Headline */}
        <h1 className="text-3xl text-foreground text-center mb-4 font-semibold sm:text-2xl animate-fade-in opacity-0" style={{
        animationDelay: '100ms',
        animationFillMode: 'forwards'
      }}>whatever distance you want to run, we will find a way.</h1>

        {/* Subheadline */}
        <p style={{
        animationDelay: '200ms',
        animationFillMode: 'forwards'
      }} className="text-muted-foreground mb-8 font-normal text-center animate-fade-in opacity-0 text-base">select your distance and generate a running lap in seconds</p>

        {/* Email Signup */}
        <p style={{
        animationDelay: '300ms',
        animationFillMode: 'forwards'
      }} className="text-muted-foreground mb-2 animate-fade-in opacity-0 text-base">gain early access:</p>
        {!isSubmitted ? <form onSubmit={handleSubmit} className="w-full max-w-md flex gap-2 mb-10 animate-fade-in opacity-0" style={{
        animationDelay: '400ms',
        animationFillMode: 'forwards'
      }}>
            <Input type="email" placeholder="enter your email" value={email} onChange={e => setEmail(e.target.value)} className="flex-1 rounded-full" disabled={isSubmitting} />
            <Button type="submit" disabled={isSubmitting} className="bg-beige hover:bg-beige-hover text-beige-foreground rounded-full">
              {isSubmitting ? "..." : "submit"}
            </Button>
          </form> : <div className="flex items-center gap-2 text-beige-foreground mb-10 bg-beige px-6 py-3 rounded-lg animate-fade-in opacity-0" style={{
        animationDelay: '400ms',
        animationFillMode: 'forwards'
      }}>
            <Check className="h-5 w-5" />
            <span className="font-medium">you're on the list!</span>
          </div>}

        {/* Launch Date */}
        <p className="text-xl text-muted-foreground text-center mb-4 sm:text-lg animate-fade-in opacity-0" style={{
        animationDelay: '500ms',
        animationFillMode: 'forwards'
      }}>launching on the first of march</p>

        {/* Countdown Timer */}
        <div className="flex gap-3 sm:gap-4 mb-12 text-beige-foreground animate-fade-in opacity-0" style={{
        animationDelay: '600ms',
        animationFillMode: 'forwards'
      }}>
          <TimeBlock value={timeLeft.days} label="days" />
          <TimeBlock value={timeLeft.hours} label="hours" />
          <TimeBlock value={timeLeft.minutes} label="mins" />
          <TimeBlock value={timeLeft.seconds} label="secs" />
        </div>

        {/* Feature Cards */}
        
      </main>

      {/* Footer */}
      <footer className="border-t px-4 py-[50px] border-secondary">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Social Links */}
          <div className="flex items-center gap-4">
            <a href="https://instagram.com/runlap" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
              <Instagram className="h-5 w-5" />
            </a>
            <a href="mailto:contact@run-lap.com" className="text-muted-foreground hover:text-foreground transition-colors">
              <Mail className="h-5 w-5" />
            </a>
          </div>

          {/* Legal Links */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link to="/terms" className="hover:text-foreground transition-colors">
              terms
            </Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">
              privacy
            </Link>
          </div>

          {/* Copyright */}
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} run-lap
          </p>
        </div>
      </footer>
    </div>;
};
export default Landing;