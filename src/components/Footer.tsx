import { Instagram, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";
const Footer = () => {
  return <footer className="w-full mt-auto bg-[#f7eeda] py-8 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Main Row: Logo | Legal Links | Social Icons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Left: Logo */}
          <div className="flex items-center">
            <img alt="Run-Lap Logo" className="h-16 w-16 sm:h-20 sm:w-20" src="/lovable-uploads/b35bfa11-8b56-4091-afc5-b2ccb5070c59.png" />
          </div>

          {/* Center: Legal Links */}
          <div className="flex items-center gap-4">
            <Link to="/terms" className="text-sm text-beige-foreground hover:underline">
              Terms and Conditions
            </Link>
            <span className="text-beige-foreground/50">|</span>
            <Link to="/privacy" className="text-sm text-beige-foreground hover:underline">
              Privacy Policy
            </Link>
          </div>

          {/* Right: Social Icons */}
          <div className="flex items-center gap-6">
            <a href="https://www.instagram.com/run.lap/" target="_blank" rel="noopener noreferrer" className="text-beige-foreground hover:opacity-70 transition-opacity" aria-label="Visit our Instagram @run.lap">
              <Instagram className="h-6 w-6" />
            </a>
            
            <a href="mailto:Contact@run-lap.com" className="text-beige-foreground hover:opacity-70 transition-opacity" aria-label="Email us at Contact@run-lap.com">
              <Mail className="h-6 w-6" />
            </a>
          </div>
        </div>

        {/* Bottom: Copyright */}
        <div className="text-center mt-8 pt-6">
          <p className="text-xs text-beige-foreground/70">©run-lap</p>
        </div>
      </div>
    </footer>;
};
export default Footer;