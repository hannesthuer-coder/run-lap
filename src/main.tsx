import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'next-themes'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.tsx'
import './index.css'
import { analyticsService } from './services/analytics.service'

// Initialize Google Analytics
const GA_MEASUREMENT_ID = 'G-06NS1Z3C16';
analyticsService.initialize(GA_MEASUREMENT_ID);

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <App />
    </ThemeProvider>
  </HelmetProvider>
);
