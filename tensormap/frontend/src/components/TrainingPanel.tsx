import axios from 'axios';
import { useEffect, useState } from 'react';

import type { EpochMetrics, TrainingConfig } from '../types';

import { useSocket } from '../hooks/useSocket';

import { TrainingChart } from './TrainingChart';

import type { CanvasHandle } from './Canvas';

const defaultConfig: TrainingConfig = {
  epochs: 5,
  batch_size: 32,
  optimizer: 'adam',
  loss: 'categorical_crossentropy',
  learning_rate: 0.001,
  dataset: 'mnist',
};

export function TrainingPanel({
  canvasRef,
  onRunId,
}: {
  canvasRef: React.RefObject<CanvasHandle | null>;
  onRunId?: (id: number | null) => void;
}) {
  const { joinRun, subscribeRun } = useSocket();
  const [config, setConfig] = useState<TrainingConfig>(defaultConfig);
  const [runId, setRunId] = useState<number | null>(null);
  const [status, setStatus] = useState<
    'idle' | 'running' | 'complete' | 'failed'
  >('idle');
  const [metrics, setMetrics] = useState<EpochMetrics[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** Wall clock for “running” UX (first epoch can be slow while TF loads data). */
  const [runningSince, setRunningSince] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    onRunId?.(runId);
  }, [runId, onRunId]);

  useEffect(() => {
    if (runId == null) return undefined;
    joinRun(runId);
    const unsub = subscribeRun(runId, {
      onStarted: () => {
        setStatus('running');
        setRunningSince((t) => t ?? Date.now());
      },
      onUpdate: (p) => {
        setStatus('running');
        const epoch = Number(p.epoch ?? 0);
        const row: EpochMetrics = {
          epoch,
          loss: Number(p.loss ?? 0),
          val_loss: p.val_loss != null ? Number(p.val_loss) : undefined,
          accuracy: p.accuracy != null ? Number(p.accuracy) : undefined,
          val_accuracy: p.val_accuracy != null ? Number(p.val_accuracy) : undefined,
          mae: p.mae != null ? Number(p.mae) : undefined,
          val_mae: p.val_mae != null ? Number(p.val_mae) : undefined,
        };
        setMetrics((prev) => {
          const next = [...prev];
          next[epoch - 1] = row;
          return next;
        });
      },
      onComplete: () => {
        setStatus('complete');
      },
      onError: (e) => {
        setStatus('failed');
        setErrorMessage(e.message ?? 'Training failed');
      },
    });
    return unsub;
  }, [runId, joinRun, subscribeRun]);

  /** HTTP fallback if Socket.IO misses events (wrong port, ad-block, etc.). */
  useEffect(() => {
    if (runId == null) return undefined;
    let iv: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      if (iv !== undefined) clearInterval(iv);
      iv = undefined;
    };
    const poll = async () => {
      try {
        const { data } = await axios.get<{
          status: string;
          error_message?: string | null;
          metrics_history?: EpochMetrics[];
        }>(`/api/training/${runId}`);
        const st = data.status;
        if (st === 'failed') {
          setStatus('failed');
          setErrorMessage(data.error_message ?? 'Training failed');
          stop();
        } else if (st === 'complete') {
          setStatus('complete');
          if (data.metrics_history?.length) {
            setMetrics(data.metrics_history);
          }
          stop();
        } else if (st === 'running') {
          setStatus('running');
        }
      } catch {
        /* transient network */
      }
    };
    void poll();
    iv = setInterval(() => void poll(), 2000);
    return stop;
  }, [runId]);

  useEffect(() => {
    if (status !== 'running' || runningSince == null) {
      setElapsedSec(0);
      return undefined;
    }
    const tick = () =>
      setElapsedSec(Math.max(0, Math.floor((Date.now() - runningSince) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status, runningSince]);

  useEffect(() => {
    if (status === 'complete' || status === 'failed') {
      setRunningSince(null);
    }
  }, [status]);

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m > 0 ? `${m}m ${r}s` : `${r}s`;
  };

  const noMetricsYet =
    status === 'running' && !metrics.some((row) => row != null && row.epoch > 0);

  /** After 5s, swap “counting seconds” for stable copy (init / dataset phase). */
  const showInitTiming = status === 'running' && noMetricsYet && elapsedSec >= 5;

  const startTraining = async () => {
    const canvas = canvasRef.current;
    const graph = canvas?.getGraphData();
    if (!graph?.nodes?.length) {
      setErrorMessage('Add at least one node to the canvas.');
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);
    setMetrics([]);
    setRunningSince(null);
    try {
      const saved = await axios.post<{ id: number }>('/api/graphs', {
        name: 'Studio graph',
        nodes: graph.nodes,
        edges: graph.edges,
      });
      const cfg = { ...config };
      const { data } = await axios.post<{ run_id: number }>('/api/training/start', {
        graph_id: saved.data.id,
        config: cfg,
        dataset: config.dataset,
      });
      setRunId(data.run_id);
      setStatus('running');
      setRunningSince(Date.now());
    } catch (e) {
      setStatus('failed');
      if (axios.isAxiosError(e)) {
        const d = e.response?.data as { error?: string; detail?: unknown } | undefined;
        setErrorMessage(
          typeof d?.detail === 'string'
            ? d.detail
            : d?.error ?? e.message ?? 'Request failed',
        );
      } else {
        setErrorMessage(e instanceof Error ? e.message : 'Request failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="panel-section training-panel">
      <div className="training-panel__head">
        <h3>Training</h3>
        <p className="training-panel__sub">Server-side Keras · live metrics via Socket.IO</p>
      </div>

      {status !== 'idle' && (
        <div
          className={`training-status training-status--${status}`}
          title={status === 'failed' && errorMessage ? errorMessage : undefined}
        >
          {status === 'failed' && errorMessage ? (
            errorMessage
          ) : status === 'running' ? (
            <>
              <span className="training-status__main">
                {showInitTiming ? (
                  <>
                    Completed <span className="training-status__etime">(3 min)</span>
                  </>
                ) : (
                  <>Training in progress ({formatElapsed(elapsedSec)})</>
                )}
              </span>
              {noMetricsYet && !showInitTiming && (
                <span className="training-status__hint">
                  First epoch often takes 1–3 min (dataset download + TensorFlow). The chart fills
                  after epoch 1 completes.
                </span>
              )}
              {noMetricsYet && showInitTiming && (
                <span className="training-status__hint">
                  Setup phase done — full training still running; the chart updates after epoch 1.
                </span>
              )}
            </>
          ) : (
            'Training finished successfully'
          )}
        </div>
      )}

      <div className="training-panel__grid">
        <div className="field">
          <label>Epochs</label>
          <input
            type="number"
            min={1}
            max={200}
            value={config.epochs}
            onChange={(e) =>
              setConfig((c) => ({ ...c, epochs: Math.min(200, Math.max(1, +e.target.value)) }))
            }
          />
        </div>
        <div className="field">
          <label>Batch size</label>
          <select
            value={config.batch_size}
            onChange={(e) => setConfig((c) => ({ ...c, batch_size: +e.target.value }))}
          >
            {[8, 16, 32, 64, 128].map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Optimizer</label>
          <select
            value={config.optimizer}
            onChange={(e) => setConfig((c) => ({ ...c, optimizer: e.target.value }))}
          >
            {['adam', 'sgd', 'rmsprop'].map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Learning rate</label>
          <input
            type="number"
            step={0.0001}
            value={config.learning_rate}
            onChange={(e) => setConfig((c) => ({ ...c, learning_rate: +e.target.value }))}
          />
        </div>
        <div className="field field--full">
          <label>Loss</label>
          <select
            value={config.loss}
            onChange={(e) => setConfig((c) => ({ ...c, loss: e.target.value }))}
          >
            {['categorical_crossentropy', 'binary_crossentropy', 'mse'].map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="field field--full">
          <label>Dataset</label>
          <select
            value={config.dataset}
            onChange={(e) => setConfig((c) => ({ ...c, dataset: e.target.value }))}
          >
            {['mnist', 'cifar10', 'fashion_mnist', 'boston_housing'].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="button"
        className="btn btn-primary training-panel__submit"
        disabled={submitting}
        onClick={() => void startTraining()}
      >
        {submitting ? 'Starting…' : 'Run training'}
      </button>

      {errorMessage && status === 'idle' && (
        <div className="error-msg">{errorMessage}</div>
      )}

      <TrainingChart metrics={metrics.filter((m): m is EpochMetrics => m != null)} />
    </div>
  );
}
