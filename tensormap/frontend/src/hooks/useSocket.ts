import { useCallback, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

import { SOCKET_ORIGIN } from '../config';

export interface TrainingSocketHandlers {
  onStarted?: (payload: Record<string, unknown>) => void;
  onUpdate?: (payload: Record<string, unknown>) => void;
  onComplete?: (payload: Record<string, unknown>) => void;
  onError?: (payload: { message?: string; run_id?: number }) => void;
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const s = io(SOCKET_ORIGIN, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = s;
    return () => {
      s.removeAllListeners();
      s.disconnect();
      socketRef.current = null;
    };
  }, []);

  const joinRun = useCallback((runId: number) => {
    socketRef.current?.emit('join_run', { run_id: runId });
  }, []);

  const subscribeRun = useCallback((runId: number, handlers: TrainingSocketHandlers) => {
    const s = socketRef.current;
    if (!s) return () => undefined;

    const matchesRun = (rid: unknown) => Number(rid) === Number(runId);

    const onStarted = (payload: Record<string, unknown>) => {
      if (matchesRun(payload.run_id)) handlers.onStarted?.(payload);
    };
    const onUpdate = (payload: Record<string, unknown>) => {
      if (matchesRun(payload.run_id)) handlers.onUpdate?.(payload);
    };
    const onComplete = (payload: Record<string, unknown>) => {
      if (matchesRun(payload.run_id)) handlers.onComplete?.(payload);
    };
    const onError = (payload: { message?: string; run_id?: number }) => {
      if (matchesRun(payload.run_id)) handlers.onError?.(payload);
    };

    s.on('training_started', onStarted);
    s.on('training_update', onUpdate);
    s.on('training_complete', onComplete);
    s.on('training_error', onError);

    return () => {
      s.off('training_started', onStarted);
      s.off('training_update', onUpdate);
      s.off('training_complete', onComplete);
      s.off('training_error', onError);
    };
  }, []);

  return { joinRun, subscribeRun };
}
