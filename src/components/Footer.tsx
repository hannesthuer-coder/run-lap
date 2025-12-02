import { Instagram, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";

const Footer = () => {
  return (
    <footer className="w-full mt-auto bg-[#f7eeda] py-10 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Top Row: Logo and Social Links */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8">
          <div className="flex items-center">
            <img src={logo} alt="Run-Lap Logo" className="h-16 w-16 sm:h-20 sm:w-20" />
          </div>

          <div className="flex items-center gap-6">
            <a 
              href="https://www.instagram.com/run.lap/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-beige-foreground hover:opacity-70 transition-opacity" 
              aria-label="Visit our Instagram @run.lap"
            >
              <Instagram className="h-6 w-6" />
            </a>
            
            <a 
              href="mailto:Contact@run-lap.com" 
              className="text-beige-foreground hover:opacity-70 transition-opacity" 
              aria-label="Email us at Contact@run-lap.com"
            >
              <Mail className="h-6 w-6" />
            </a>
          </div>
        </div>

        {/* Middle Row: Legal Links */}
        <div className="flex items-center justify-center gap-6 mb-6">
          <Link 
            to="/terms" 
            className="text-sm text-beige-foreground hover:underline"
          >
            Terms and Conditions
          </Link>
          <span className="text-beige-foreground/50">|</span>
          <Link 
            to="/privacy" 
            className="text-sm text-beige-foreground hover:underline"
          >
            Privacy Policy
          </Link>
        </div>

        {/* Bottom Row: Company Information */}
        <div className="text-center text-xs text-beige-foreground/80 space-y-1">
          <p>
            <strong>Run-Lap</strong> Reg. no: 20060915-3432
          </p>
          <p>
            Hägerstensvägen 163, 126 53 Hägersten, Sweden
          </p>
          <p>
            <a href="mailto:Contact@run-lap.com" className="hover:underline">Contact@run-lap.com</a>
            <span className="mx-2">•</span>
            Registered for F-tax (F-skatt)
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
