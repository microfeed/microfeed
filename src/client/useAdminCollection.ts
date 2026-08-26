import {useCallback, useEffect, useState} from "react";

interface AdminCollectionState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  retry: () => void;
}

export function useAdminCollection<T>(
  url: string,
  fallbackError: string,
): AdminCollectionState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const response = await fetch(url, {
          cache: "no-store",
          headers: {accept: "application/json"},
          signal: controller.signal,
        });
        if (response.status === 401) {
          window.location.reload();
          return;
        }
        const result = await response.json().catch(() => null) as
          | (T & {error?: string})
          | null;
        if (!response.ok || !result) {
          throw new Error(result?.error || fallbackError);
        }
        setData(result);
      } catch (requestError) {
        if (controller.signal.aborted) {
          return;
        }
        setError(
          requestError instanceof Error ? requestError.message : fallbackError,
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [attempt, fallbackError, url]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return {data, error, loading, retry};
}
