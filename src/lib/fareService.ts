/**
 * Rate-Limited Fare Service for SkyWeave
 *
 * Manages SerpAPI fare calls with:
 * - Daily budget limit (500 calls/day)
 * - Smart caching with TTL
 * - Prioritized route fetching
 */

import * as api from './api';

// Configuration
const DAILY_BUDGET = 500;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const STORAGE_KEY = 'skyweave_fare_budget';

interface FareBudget {
  date: string; // YYYY-MM-DD
  callsUsed: number;
  lastReset: number;
}

interface CachedFare {
  route: string;
  data: FareData;
  fetchedAt: number;
  expiresAt: number;
}

export interface FareData {
  success: boolean;
  route: string;
  date: string;
  minFare: number | null;
  nkFare: number | null; // Spirit's fare if available
  competitorFares: CompetitorFare[];
  fareAdvantage: number | null; // Difference from market min (negative = we're cheaper)
  totalOptions: number;
  fetchedAt: Date;
  isStale: boolean;
}

export interface CompetitorFare {
  airline: string;
  minFare: number;
  maxFare: number;
  avgFare: number;
  flightCount: number;
}

// In-memory cache
const fareCache = new Map<string, CachedFare>();

/**
 * Get today's date as YYYY-MM-DD
 */
function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get budget from localStorage, reset if new day
 */
function getBudget(): FareBudget {
  const today = getTodayKey();

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const budget: FareBudget = JSON.parse(stored);
      // Reset if new day
      if (budget.date !== today) {
        return resetBudget();
      }
      return budget;
    }
  } catch {
    // localStorage not available or corrupted
  }

  return resetBudget();
}

/**
 * Reset budget for a new day
 */
function resetBudget(): FareBudget {
  const budget: FareBudget = {
    date: getTodayKey(),
    callsUsed: 0,
    lastReset: Date.now(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(budget));
  } catch {
    // localStorage not available
  }

  return budget;
}

/**
 * Increment budget usage
 */
function incrementBudget(): void {
  const budget = getBudget();
  budget.callsUsed += 1;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(budget));
  } catch {
    // localStorage not available
  }
}

/**
 * Check if we have budget remaining
 */
export function hasBudget(): boolean {
  const budget = getBudget();
  return budget.callsUsed < DAILY_BUDGET;
}

/**
 * Get remaining budget
 */
export function getRemainingBudget(): { used: number; remaining: number; limit: number } {
  const budget = getBudget();
  return {
    used: budget.callsUsed,
    remaining: Math.max(0, DAILY_BUDGET - budget.callsUsed),
    limit: DAILY_BUDGET,
  };
}

/**
 * Generate cache key for a route
 */
function getCacheKey(origin: string, destination: string, date: string): string {
  return `${origin}-${destination}-${date}`;
}

/**
 * Get cached fare if available and not expired
 */
function getCachedFare(origin: string, destination: string, date: string): FareData | null {
  const key = getCacheKey(origin, destination, date);
  const cached = fareCache.get(key);

  if (cached && Date.now() < cached.expiresAt) {
    return {
      ...cached.data,
      isStale: false,
    };
  }

  // Return stale data with flag if available (better than nothing)
  if (cached) {
    return {
      ...cached.data,
      isStale: true,
    };
  }

  return null;
}

/**
 * Store fare in cache
 */
function cacheFare(origin: string, destination: string, date: string, data: FareData): void {
  const key = getCacheKey(origin, destination, date);
  fareCache.set(key, {
    route: `${origin}-${destination}`,
    data,
    fetchedAt: Date.now(),
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

/**
 * Fetch live fares for a route (with rate limiting)
 *
 * @param origin - Origin airport code
 * @param destination - Destination airport code
 * @param departureDate - Date in YYYY-MM-DD format (defaults to 7 days out)
 * @param forceFresh - Bypass cache and force fresh fetch
 */
export async function fetchLiveFares(
  origin: string,
  destination: string,
  departureDate?: string,
  forceFresh = false
): Promise<FareData> {
  // Default to 7 days from now if no date provided
  const date = departureDate || getDefaultDate();

  // Check cache first (unless forcing fresh)
  if (!forceFresh) {
    const cached = getCachedFare(origin, destination, date);
    if (cached && !cached.isStale) {
      return cached;
    }
  }

  // Check budget
  if (!hasBudget()) {
    // Return stale cache if available, otherwise empty result
    const stale = getCachedFare(origin, destination, date);
    if (stale) {
      return stale;
    }

    return {
      success: false,
      route: `${origin}-${destination}`,
      date,
      minFare: null,
      nkFare: null,
      competitorFares: [],
      fareAdvantage: null,
      totalOptions: 0,
      fetchedAt: new Date(),
      isStale: true,
    };
  }

  try {
    // Make the API call
    const response = await api.getLiveFares(origin, destination, date);
    incrementBudget();

    // Transform response
    const competitorFares: CompetitorFare[] = [];
    let nkFare: number | null = null;

    if (response.airline_analysis) {
      for (const [airline, data] of Object.entries(response.airline_analysis)) {
        competitorFares.push({
          airline,
          minFare: data.min_fare,
          maxFare: data.max_fare,
          avgFare: data.avg_fare,
          flightCount: data.flight_count,
        });

        // Check for Spirit (NK)
        if (airline.toLowerCase().includes('spirit') || airline.toUpperCase() === 'NK') {
          nkFare = data.min_fare;
        }
      }
    }

    // Sort by min fare
    competitorFares.sort((a, b) => a.minFare - b.minFare);

    const fareData: FareData = {
      success: response.success,
      route: response.route || `${origin}-${destination}`,
      date,
      minFare: response.min_fare,
      nkFare,
      competitorFares,
      fareAdvantage: nkFare && response.min_fare ? response.min_fare - nkFare : null,
      totalOptions: response.total_options || 0,
      fetchedAt: new Date(),
      isStale: false,
    };

    // Cache the result
    cacheFare(origin, destination, date, fareData);

    return fareData;

  } catch (error) {
    console.error('Failed to fetch live fares:', error);

    // Return stale cache if available
    const stale = getCachedFare(origin, destination, date);
    if (stale) {
      return stale;
    }

    return {
      success: false,
      route: `${origin}-${destination}`,
      date,
      minFare: null,
      nkFare: null,
      competitorFares: [],
      fareAdvantage: null,
      totalOptions: 0,
      fetchedAt: new Date(),
      isStale: true,
    };
  }
}

/**
 * Batch fetch fares for multiple routes (respects budget)
 */
export async function fetchFaresForRoutes(
  routes: Array<{ origin: string; destination: string }>,
  maxCalls = 10
): Promise<Map<string, FareData>> {
  const results = new Map<string, FareData>();
  const date = getDefaultDate();

  // Limit concurrent calls
  const callsToMake = Math.min(routes.length, maxCalls, getRemainingBudget().remaining);

  for (let i = 0; i < callsToMake; i++) {
    const route = routes[i];
    const data = await fetchLiveFares(route.origin, route.destination, date);
    results.set(`${route.origin}-${route.destination}`, data);
  }

  return results;
}

/**
 * Get default departure date (7 days from now)
 */
function getDefaultDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().split('T')[0];
}

/**
 * Get all cached fares (for displaying without API calls)
 */
export function getAllCachedFares(): FareData[] {
  const fares: FareData[] = [];

  for (const cached of fareCache.values()) {
    fares.push({
      ...cached.data,
      isStale: Date.now() >= cached.expiresAt,
    });
  }

  return fares;
}

/**
 * Clear the fare cache
 */
export function clearFareCache(): void {
  fareCache.clear();
}

/**
 * Generate a fare alert if significant competitor fare change detected
 */
export function detectFareAlert(
  currentFare: FareData,
  previousMinFare: number | null
): { hasAlert: boolean; message: string; severity: 'warning' | 'critical' | 'info' } | null {
  if (!currentFare.success || currentFare.minFare === null) {
    return null;
  }

  // Check for significant fare drop by competitors
  if (previousMinFare && currentFare.minFare < previousMinFare) {
    const dropPercent = ((previousMinFare - currentFare.minFare) / previousMinFare) * 100;

    if (dropPercent >= 20) {
      // Find which competitor dropped
      const cheapest = currentFare.competitorFares[0];
      return {
        hasAlert: true,
        message: `${cheapest?.airline || 'Competitor'} dropped fares on ${currentFare.route} by ${dropPercent.toFixed(0)}% to $${currentFare.minFare}`,
        severity: dropPercent >= 30 ? 'critical' : 'warning',
      };
    }
  }

  // Check if we're significantly more expensive than market
  if (currentFare.nkFare && currentFare.minFare && currentFare.fareAdvantage) {
    if (currentFare.fareAdvantage < -30) {
      // We're $30+ more expensive than the cheapest competitor
      return {
        hasAlert: true,
        message: `NK fare on ${currentFare.route} is $${Math.abs(currentFare.fareAdvantage).toFixed(0)} above market min ($${currentFare.minFare})`,
        severity: currentFare.fareAdvantage < -50 ? 'critical' : 'warning',
      };
    }
  }

  return null;
}
