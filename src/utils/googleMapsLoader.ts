import { Loader } from '@googlemaps/js-api-loader';

let isLoaded = false;
let loadPromise: Promise<void> | null = null;

const GOOGLE_MAPS_API_KEY = "AIzaSyAm3IKVxRxms6p1tX5jPg6xzz85IGspT0k";

export const loadGoogleMaps = (): Promise<void> => {
  if (isLoaded) {
    return Promise.resolve();
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise(async (resolve, reject) => {
    try {
      const loader = new Loader({
        apiKey: GOOGLE_MAPS_API_KEY,
        version: "weekly",
        libraries: ["geometry"]
      });

      await loader.load();
      isLoaded = true;
      resolve();
    } catch (error) {
      loadPromise = null;
      reject(error);
    }
  });

  return loadPromise;
};