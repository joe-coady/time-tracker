import { useState, useEffect } from 'react';

/**
 * Hook that returns elapsed seconds since a given start time, updating every second.
 * Returns null if no startTime is provided.
 */
export function useElapsedTime(startTime: string | null): number | null {
  const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (!startTime) {
      setElapsedSeconds(null);
      return;
    }

    const startMs = new Date(startTime).getTime();

    const updateElapsed = () => {
      const now = Date.now();
      setElapsedSeconds(Math.floor((now - startMs) / 1000));
    };

    // Update immediately
    updateElapsed();

    // Then update every second
    const intervalId = setInterval(updateElapsed, 1000);

    return () => clearInterval(intervalId);
  }, [startTime]);

  return elapsedSeconds;
}

/**
 * Format seconds into h:mm:ss or m:ss format
 */
export function formatElapsedTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
