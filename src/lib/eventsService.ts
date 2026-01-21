/**
 * Events Service for SkyWeave
 *
 * Fetches real concert/event data from Google Events API via SearchAPI.io
 * to generate demand signals for routes.
 *
 * Rate limited to conserve API budget.
 */

// Configuration
const EVENTS_DAILY_BUDGET = 100; // Separate budget for events API
const EVENTS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache (events don't change often)
const STORAGE_KEY = 'skyweave_events_budget';

// Airport to city mapping for event searches
const AIRPORT_CITIES: Record<string, { city: string; state: string }> = {
  FLL: { city: 'Fort Lauderdale', state: 'Florida' },
  MIA: { city: 'Miami', state: 'Florida' },
  MCO: { city: 'Orlando', state: 'Florida' },
  DTW: { city: 'Detroit', state: 'Michigan' },
  LAS: { city: 'Las Vegas', state: 'Nevada' },
  LAX: { city: 'Los Angeles', state: 'California' },
  EWR: { city: 'Newark', state: 'New Jersey' },
  JFK: { city: 'New York', state: 'New York' },
  BOS: { city: 'Boston', state: 'Massachusetts' },
  ATL: { city: 'Atlanta', state: 'Georgia' },
  DFW: { city: 'Dallas', state: 'Texas' },
  ORD: { city: 'Chicago', state: 'Illinois' },
  DEN: { city: 'Denver', state: 'Colorado' },
  SEA: { city: 'Seattle', state: 'Washington' },
  SFO: { city: 'San Francisco', state: 'California' },
  PHX: { city: 'Phoenix', state: 'Arizona' },
  MSP: { city: 'Minneapolis', state: 'Minnesota' },
};

interface EventsBudget {
  date: string;
  callsUsed: number;
}

export interface EventData {
  title: string;
  date: string;
  venue: string;
  location: string;
  description?: string;
  link?: string;
  thumbnail?: string;
  estimatedAttendance?: number;
  demandImpact: 'high' | 'medium' | 'low';
}

export interface LocationEvents {
  airportCode: string;
  city: string;
  events: EventData[];
  fetchedAt: Date;
  isStale: boolean;
}

// In-memory cache
const eventsCache = new Map<string, { data: LocationEvents; expiresAt: number }>();

/**
 * Get today's date key
 */
function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get events budget from localStorage
 */
function getEventsBudget(): EventsBudget {
  const today = getTodayKey();

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const budget: EventsBudget = JSON.parse(stored);
      if (budget.date !== today) {
        return resetEventsBudget();
      }
      return budget;
    }
  } catch {
    // localStorage not available
  }

  return resetEventsBudget();
}

/**
 * Reset events budget
 */
function resetEventsBudget(): EventsBudget {
  const budget: EventsBudget = {
    date: getTodayKey(),
    callsUsed: 0,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(budget));
  } catch {
    // localStorage not available
  }

  return budget;
}

/**
 * Increment events budget
 */
function incrementEventsBudget(): void {
  const budget = getEventsBudget();
  budget.callsUsed += 1;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(budget));
  } catch {
    // localStorage not available
  }
}

/**
 * Check if we have events budget
 */
export function hasEventsBudget(): boolean {
  const budget = getEventsBudget();
  return budget.callsUsed < EVENTS_DAILY_BUDGET;
}

/**
 * Get remaining events budget
 */
export function getEventsRemainingBudget(): { used: number; remaining: number; limit: number } {
  const budget = getEventsBudget();
  return {
    used: budget.callsUsed,
    remaining: Math.max(0, EVENTS_DAILY_BUDGET - budget.callsUsed),
    limit: EVENTS_DAILY_BUDGET,
  };
}

/**
 * Estimate demand impact based on event type and venue size
 */
function estimateDemandImpact(event: {
  title: string;
  venue?: { name: string; reviews?: number };
  description?: string;
}): 'high' | 'medium' | 'low' {
  const title = event.title.toLowerCase();
  const venueName = event.venue?.name?.toLowerCase() || '';
  const reviews = event.venue?.reviews || 0;

  // High-impact: Major artists, stadium shows, big sports
  const highImpactKeywords = [
    'taylor swift', 'beyoncé', 'beyonce', 'drake', 'bad bunny', 'ed sheeran',
    'super bowl', 'world series', 'nfl', 'nba finals', 'world cup',
    'formula 1', 'f1', 'ufc', 'wrestlemania',
    'coachella', 'lollapalooza', 'burning man',
  ];

  for (const keyword of highImpactKeywords) {
    if (title.includes(keyword) || venueName.includes(keyword)) {
      return 'high';
    }
  }

  // Stadium/arena shows are typically high impact
  const stadiumKeywords = ['stadium', 'arena', 'center', 'centre', 'dome', 'coliseum'];
  for (const keyword of stadiumKeywords) {
    if (venueName.includes(keyword) && reviews > 1000) {
      return 'high';
    }
  }

  // Medium impact: Popular venues, known artists
  const mediumImpactKeywords = [
    'concert', 'tour', 'live', 'festival', 'championship', 'playoff',
    'convention', 'expo', 'comic con', 'marathon',
  ];

  for (const keyword of mediumImpactKeywords) {
    if (title.includes(keyword)) {
      return 'medium';
    }
  }

  // Venue with lots of reviews suggests popularity
  if (reviews > 500) {
    return 'medium';
  }

  return 'low';
}

/**
 * Fetch events for an airport location
 */
export async function fetchEventsForAirport(
  airportCode: string,
  forceFresh = false
): Promise<LocationEvents> {
  const cacheKey = airportCode.toUpperCase();

  // Check cache first
  if (!forceFresh) {
    const cached = eventsCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }
  }

  // Get city info
  const cityInfo = AIRPORT_CITIES[cacheKey];
  if (!cityInfo) {
    return {
      airportCode: cacheKey,
      city: cacheKey,
      events: [],
      fetchedAt: new Date(),
      isStale: true,
    };
  }

  // Check budget
  if (!hasEventsBudget()) {
    const cached = eventsCache.get(cacheKey);
    if (cached) {
      return { ...cached.data, isStale: true };
    }
    return {
      airportCode: cacheKey,
      city: cityInfo.city,
      events: [],
      fetchedAt: new Date(),
      isStale: true,
    };
  }

  try {
    // Call the backend API which will proxy to SearchAPI.io
    const response = await fetch(
      `/api/live/events/${cacheKey}?city=${encodeURIComponent(cityInfo.city)}&state=${encodeURIComponent(cityInfo.state)}`
    );

    incrementEventsBudget();

    if (!response.ok) {
      throw new Error(`Events API error: ${response.status}`);
    }

    const data = await response.json();

    // Transform events
    const events: EventData[] = (data.events || []).slice(0, 10).map((event: any) => ({
      title: event.title || 'Event',
      date: event.date?.month && event.date?.day ? `${event.date.month} ${event.date.day}` : 'TBD',
      venue: event.venue?.name || event.location || 'TBD',
      location: event.address || cityInfo.city,
      description: event.description,
      link: event.link,
      thumbnail: event.thumbnail,
      demandImpact: estimateDemandImpact(event),
    }));

    const result: LocationEvents = {
      airportCode: cacheKey,
      city: cityInfo.city,
      events,
      fetchedAt: new Date(),
      isStale: false,
    };

    // Cache the result
    eventsCache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + EVENTS_CACHE_TTL_MS,
    });

    return result;

  } catch (error) {
    console.error('Failed to fetch events:', error);

    // Return cached data if available
    const cached = eventsCache.get(cacheKey);
    if (cached) {
      return { ...cached.data, isStale: true };
    }

    return {
      airportCode: cacheKey,
      city: cityInfo.city,
      events: [],
      fetchedAt: new Date(),
      isStale: true,
    };
  }
}

/**
 * Generate demand signals from events
 */
export function generateEventSignals(
  events: LocationEvents,
  hubCode: string
): Array<{
  type: 'event';
  icon: string;
  title: string;
  description: string;
  timestamp: Date;
  demandImpact: 'high' | 'medium' | 'low';
}> {
  const signals: Array<{
    type: 'event';
    icon: string;
    title: string;
    description: string;
    timestamp: Date;
    demandImpact: 'high' | 'medium' | 'low';
  }> = [];

  for (const event of events.events) {
    // Only show high and medium impact events
    if (event.demandImpact === 'low') continue;

    const icon = event.demandImpact === 'high' ? '🎵' : '🎪';
    const impactText = event.demandImpact === 'high' ? 'Major demand lift expected' : 'Moderate demand increase';

    signals.push({
      type: 'event',
      icon,
      title: `${event.title} at ${event.venue}`,
      description: `${event.date} - ${impactText}`,
      timestamp: events.fetchedAt,
      demandImpact: event.demandImpact,
    });
  }

  return signals;
}

/**
 * Get cached events for all known airports
 */
export function getAllCachedEvents(): Map<string, LocationEvents> {
  const results = new Map<string, LocationEvents>();

  for (const [key, cached] of eventsCache.entries()) {
    results.set(key, {
      ...cached.data,
      isStale: Date.now() >= cached.expiresAt,
    });
  }

  return results;
}

/**
 * Clear events cache
 */
export function clearEventsCache(): void {
  eventsCache.clear();
}
