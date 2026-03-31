import { useCallback, useMemo, useRef, useState } from 'react';
import { Toaster } from 'react-hot-toast';

import type { LayerDefinition } from './types';

import { useLayerRegistry } from './hooks/useLayerRegistry';

import { Canvas, type CanvasHandle } from './components/Canvas';
import { ExportPanel } from './components/ExportPanel';
import { LayerPalette } from './components/LayerPalette';
import { TemplateStrip } from './components/TemplateStrip';
import { TrainingPanel } from './components/TrainingPanel';

export default function App() {
  const { registry, loading, error } = useLayerRegistry();
  const canvasRef = useRef<CanvasHandle | null>(null);
  const [runId, setRunId] = useState<number | null>(null);
  const [layerSearch, setLayerSearch] = useState('');

  const stableOnRunId = useCallback((id: number | null) => {
    setRunId(id);
  }, []);

  const reg = registry as Record<string, LayerDefinition>;
  const layerCount = useMemo(() => Object.keys(reg).length, [reg]);

  return (
    <div className="app-shell">
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'var(--bg-card)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            fontFamily: 'var(--font)',
          },
        }}
      />

      <header className="app-header">
        <div className="app-header-left">
          <span className="app-header-title">TensorMap</span>
        </div>
        <span className="app-header-tagline">Visual NN studio · Keras backend</span>
        <div className="app-header-right">
          <span className="app-header-badge">GSoC Edition</span>
        </div>
      </header>

      <main className="app-main">
        <aside className="sidebar">
          {loading && <div className="loading-pill">Loading layer registry…</div>}
          {error && (
            <div className="loading-pill" style={{ color: '#c0392b' }} title={error}>
              Registry error — check API
            </div>
          )}
          {!loading && !error && (
            <LayerPalette registry={reg} filterText={layerSearch} />
          )}
          <footer className="sidebar-footer">
            Made with <span aria-label="love">♥</span> for TensorMap · GSoC Edition
          </footer>
        </aside>

        <div className="content-column">
          <div className="content-toolbar">
            <div className="search-wrap">
              <input
                type="search"
                placeholder="Search layers…"
                value={layerSearch}
                onChange={(e) => setLayerSearch(e.target.value)}
                aria-label="Search layers"
              />
              <span className="search-icon" aria-hidden>
                🔍
              </span>
            </div>
          </div>

          <div className="announcement-banner">
            Drag layers → connect handles → Train (MNIST, CIFAR-10, …) → Export model or PDF/Word
            report.
          </div>

          <div className="workspace-row">
            <div className="canvas-shell">
              <div className="results-row">
                <span className="results-badge">{layerCount} layer types</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Keras functional API
                </span>
              </div>
              <section className="canvas-host">
                {!loading && !error && <Canvas ref={canvasRef} registry={reg} />}
              </section>
              {!loading && !error && <TemplateStrip />}
            </div>

            <aside className="sidebar-right">
              <TrainingPanel canvasRef={canvasRef} onRunId={stableOnRunId} />
              <ExportPanel runId={runId} />
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
