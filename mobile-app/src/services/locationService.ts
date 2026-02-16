// Location Service for country detection
// Uses IP-based geolocation only — no GPS permissions required

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

// =============================================================================
// Location Service
// =============================================================================

class LocationService {
  private cachedCountryByIP: string | null = null;

  /**
   * Detect country code via IP geolocation (no permissions required).
   * Tries multiple free providers with a 3-second timeout. Result is cached.
   * Intended for language auto-detection.
   */
  async getCountryByIP(): Promise<string | null> {
    if (this.cachedCountryByIP !== null) {
      return this.cachedCountryByIP;
    }

    const providers = [
      {
        url: 'http://ip-api.com/json/?fields=countryCode',
        extract: (data: Record<string, string>) => data.countryCode,
      },
      {
        url: 'https://ipapi.co/json/',
        extract: (data: Record<string, string>) => data.country_code,
      },
    ];

    for (const provider of providers) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(provider.url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) continue;

        const data = await response.json();
        const countryCode: string | null = provider.extract(data) ?? null;

        this.cachedCountryByIP = countryCode;
        return countryCode;
      } catch {
        continue;
      }
    }

    return null;
  }

  /**
   * Clear cached data
   */
  clearCache(): void {
    this.cachedCountryByIP = null;
  }
}

// Export singleton instance
export const locationService = new LocationService();

// Export class for testing
export { LocationService };
