import axios from 'axios';
import { useEffect, useState } from 'react';

import type { LayerDefinition } from '../types';

export function useLayerRegistry() {
  const [registry, setRegistry] = useState<Record<string, LayerDefinition>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get<Record<string, LayerDefinition>>('/api/layers');
        if (!cancelled) {
          setRegistry(res.data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load layers');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { registry, loading, error };
}
