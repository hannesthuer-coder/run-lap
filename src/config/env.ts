// Centralized environment configuration with validation

interface EnvConfig {
  supabase: {
    url: string;
    anonKey: string;
  };
  mapbox: {
    token: string;
  };
  isDevelopment: boolean;
}

function getEnvVar(key: string): string {
  const value = import.meta.env[key];
  
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  
  return value;
}

export const env: EnvConfig = {
  supabase: {
    url: getEnvVar('VITE_SUPABASE_URL'),
    anonKey: getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY'),
  },
  mapbox: {
    token: getEnvVar('VITE_MAPBOX_TOKEN'),
  },
  isDevelopment: import.meta.env.DEV,
};

// Validate on load
if (env.isDevelopment) {
  console.log('✓ Environment configuration loaded successfully');
}
