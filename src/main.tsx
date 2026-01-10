import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'next-themes'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.tsx'
import './index.css'
import { analyticsService } from './services/analytics.service'

// Initialize Google Analytics - Replace with your GA4 Measurement ID
// You can get this from Google Analytics > Admin > Data Streams > Web
const GA_MEASUREMENT_ID = 'G-XXXXXXXXXX'; // Replace with your actual GA4 ID

if (GA_MEASUREMENT_ID && GA_MEASUREMENT_ID !== 'G-XXXXXXXXXX') {
  analyticsService.initialize(GA_MEASUREMENT_ID);
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <App />
    </ThemeProvider>
  </HelmetProvider>
);
