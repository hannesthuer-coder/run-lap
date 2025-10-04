import { Instagram, Mail } from "lucide-react";
import logo from "@/assets/logo.png";

const Footer = () => {
  return <footer className="w-full mt-auto py-6 px-4 bg-[#f7eeda]">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center">
          <img src={logo} alt="Run-Lap Logo" className="h-16 w-16 sm:h-20 sm:w-20" />
        </div>

        {/* Links */}
        <div className="flex items-center gap-6">
          <a href="https://www.instagram.com/run.lap/" target="_blank" rel="noopener noreferrer" className="text-beige-foreground hover:opacity-70 transition-opacity" aria-label="Visit our Instagram @run.lap">
            <Instagram className="h-6 w-6" />
          </a>
          
          <a href="mailto:contact@run-lap.com" className="flex items-center gap-2 text-beige-foreground hover:opacity-70 transition-opacity">
            <Mail className="h-5 w-5" />
            <span className="text-sm font-medium">contact@run-lap.com</span>
          </a>
        </div>
      </div>
    </footer>;
};
export default Footer;