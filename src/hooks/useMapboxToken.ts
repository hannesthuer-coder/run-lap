import { useState, useEffect } from 'react';

const MAPBOX_TOKEN_KEY = 'mapbox_token';

export const useMapboxToken = () => {
  const [token, setToken] = useState<string>('');
  const [isTokenSet, setIsTokenSet] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem(MAPBOX_TOKEN_KEY);
    if (savedToken) {
      setToken(savedToken);
      setIsTokenSet(true);
    }
  }, []);

  const saveToken = (newToken: string) => {
    setToken(newToken);
    setIsTokenSet(true);
    localStorage.setItem(MAPBOX_TOKEN_KEY, newToken);
  };

  const clearToken = () => {
    setToken('');
    setIsTokenSet(false);
    localStorage.removeItem(MAPBOX_TOKEN_KEY);
  };

  return {
    token,
    isTokenSet,
    saveToken,
    clearToken,
  };
};