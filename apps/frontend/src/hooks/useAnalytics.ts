import { useCallback } from 'react';

// 使用环境变量或相对路径，避免硬编码
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/';

export type EventCategory = 'track_a' | 'track_e' | 'general';

export interface AnalyticsEvent {
  event_name: string;
  category: EventCategory;
  metadata?: Record<string, any>;
}

export const useAnalytics = () => {
  const logEvent = useCallback(async (event: AnalyticsEvent) => {
    try {
      await fetch(`${API_BASE}/analytics/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });
      console.log(`[Analytics] Logged: ${event.category}:${event.event_name}`);
    } catch (error) {
      console.error('[Analytics] Failed to log event:', error);
    }
  }, []);

  return { logEvent };
};
