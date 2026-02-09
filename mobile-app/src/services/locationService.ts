// Location Service for country detection
// Uses expo-location for geolocation features

import * as Location from 'expo-location';

// =============================================================================
// Types
// =============================================================================

export interface LocationInfo {
  latitude: number;
  longitude: number;
  countryCode: string | null;
  isInBulgaria: boolean;
}

export interface LocationPermissionResult {
  granted: boolean;
  canAskAgain: boolean;
}

// Bulgaria's approximate bounding box coordinates
const BULGARIA_BOUNDS = {
  north: 44.22,  // Northernmost point
  south: 41.24,  // Southernmost point
  east: 28.61,   // Easternmost point
  west: 22.36,   // Westernmost point
};

// =============================================================================
// Location Service
// =============================================================================

class LocationService {
  private cachedLocation: LocationInfo | null = null;
  private cachedCountryByIP: string | null = null;
  private lastLocationCheck: number = 0;
  private readonly CACHE_DURATION = 1000 * 60 * 60; // 1 hour

  /**
   * Request location permission from the user
   */
  async requestPermission(): Promise<LocationPermissionResult> {
    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      
      console.log('📍 [LocationService] Permission status:', status);
      
      return {
        granted: status === 'granted',
        canAskAgain: canAskAgain ?? false,
      };
    } catch (error) {
      console.error('❌ [LocationService] Permission request failed:', error);
      return {
        granted: false,
        canAskAgain: true,
      };
    }
  }

  /**
   * Check if location permission is already granted
   */
  async hasPermission(): Promise<boolean> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('❌ [LocationService] Permission check failed:', error);
      return false;
    }
  }

  /**
   * Get location by IP address (no permission required)
   * Uses free IP geolocation API as fallback
   */
    async getLocationByIP(): Promise<LocationInfo | null> {
    try {
      console.log('📍 [LocationService] Attempting IP-based geolocation...');
      
      // Use ipwho.is (free, no API key required, supports HTTPS)
      const response = await fetch('https://ipwho.is/', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`IP geolocation failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error('IP geolocation returned failure status');
      }

      const isInBulgaria = data.country_code === 'BG';
      
      const locationInfo: LocationInfo = {
        latitude: data.latitude || 0,
        longitude: data.longitude || 0,
        countryCode: data.country_code || null,
        isInBulgaria,
      };

      console.log('✅ [LocationService] IP geolocation result:', {
        countryCode: data.country_code,
        isInBulgaria,
      });

      return locationInfo;
    } catch (error) {
      console.error('❌ [LocationService] IP geolocation failed:', error);
      return null;
    }
  }

  /**
   * Detect country code via IP geolocation (no permissions required).
   * Uses ipapi.co with a 3-second timeout. Result is cached.
   * Intended for language auto-detection.
   */
  async getCountryByIP(): Promise<string | null> {
    // Return cached value if available
    if (this.cachedCountryByIP !== null) {
      console.log('📍 [LocationService] Using cached IP country:', this.cachedCountryByIP);
      return this.cachedCountryByIP;
    }

    try {
      console.log('📍 [LocationService] Detecting country via IP...');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch('https://ipapi.co/json/', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`IP country lookup failed: ${response.status}`);
      }

      const data = await response.json();
      const countryCode: string | null = data.country_code ?? null;

      this.cachedCountryByIP = countryCode;
      console.log('✅ [LocationService] IP country detected:', countryCode);
      return countryCode;
    } catch (error) {
      console.error('❌ [LocationService] IP country detection failed:', error);
      return null;
    }
  }

  /**
   * Get current location and determine country
   * Tries GPS first, falls back to IP-based geolocation
   */
  async getCurrentLocation(): Promise<LocationInfo | null> {
    try {
      // Check cache first
      if (this.cachedLocation && (Date.now() - this.lastLocationCheck) < this.CACHE_DURATION) {
        console.log('📍 [LocationService] Using cached location');
        return this.cachedLocation;
      }

      // Check permission for GPS location
      // Check and request permission for GPS location
      const { granted } = await this.requestPermission();
      
      if (granted) {
        console.log('📍 [LocationService] Getting current location via GPS...');
        
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Lowest, // Fast, low battery usage
          });

          const { latitude, longitude } = location.coords;
          const isInBulgaria = this.isCoordinateInBulgaria(latitude, longitude);
          const countryCode = isInBulgaria ? 'BG' : null;

          const locationInfo: LocationInfo = {
            latitude,
            longitude,
            countryCode,
            isInBulgaria,
          };

          // Cache the result
          this.cachedLocation = locationInfo;
          this.lastLocationCheck = Date.now();

          console.log('✅ [LocationService] GPS location detected:', {
            lat: latitude.toFixed(2),
            lng: longitude.toFixed(2),
            isInBulgaria,
          });

          return locationInfo;
        } catch (gpsError) {
          console.warn('⚠️ [LocationService] GPS failed, trying IP fallback:', gpsError);
        }
      } else {
        console.log('📍 [LocationService] GPS permission denied, using IP-based detection');
      }

      // Fallback to IP-based geolocation
      const ipLocation = await this.getLocationByIP();
      
      if (ipLocation) {
        // Cache the IP-based result (with shorter duration since it's less accurate)
        this.cachedLocation = ipLocation;
        this.lastLocationCheck = Date.now();
        return ipLocation;
      }

      return null;
    } catch (error) {
      console.error('❌ [LocationService] Failed to get location:', error);
      
      // Last resort: try IP geolocation
      return this.getLocationByIP();
    }
  }

  /**
   * Check if coordinates are within Bulgaria
   * Uses simple bounding box check for performance
   */
  isCoordinateInBulgaria(latitude: number, longitude: number): boolean {
    return (
      latitude >= BULGARIA_BOUNDS.south &&
      latitude <= BULGARIA_BOUNDS.north &&
      longitude >= BULGARIA_BOUNDS.west &&
      longitude <= BULGARIA_BOUNDS.east
    );
  }

  /**
   * Try to detect country using reverse geocoding
   * Falls back to coordinate bounds if geocoding fails
   */
  async detectCountryCode(latitude: number, longitude: number): Promise<string | null> {
    try {
      // First check bounding box (fast)
      if (this.isCoordinateInBulgaria(latitude, longitude)) {
        return 'BG';
      }

      // Try reverse geocoding for more accuracy (slower, uses network)
      const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
      
      if (addresses.length > 0 && addresses[0].isoCountryCode) {
        console.log('📍 [LocationService] Geocoded country:', addresses[0].isoCountryCode);
        return addresses[0].isoCountryCode;
      }

      return null;
    } catch (error) {
      console.error('❌ [LocationService] Reverse geocoding failed:', error);
      
      // Fall back to bounding box check
      if (this.isCoordinateInBulgaria(latitude, longitude)) {
        return 'BG';
      }
      
      return null;
    }
  }

  /**
   * Clear cached location data
   */
  clearCache(): void {
    this.cachedLocation = null;
    this.lastLocationCheck = 0;
    console.log('📍 [LocationService] Cache cleared');
  }

  /**
   * Get cached location without making a new request
   */
  getCachedLocation(): LocationInfo | null {
    return this.cachedLocation;
  }
}

// Export singleton instance
export const locationService = new LocationService();

// Export class for testing
export { LocationService };
