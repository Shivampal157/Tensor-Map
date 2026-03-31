import { useMemo, useState } from 'react';
import type { DragEvent } from 'react';

import type { LayerDefinition } from '../types';
import { setPaletteDragLayerKey } from '../paletteDnD';

const DRAG_MIME = 'application/tensormap-layer';

export function LayerPalette({
  registry,
  filterText = '',
}: {
  registry: Record<string, LayerDefinition>;
  filterText?: string;
}) {
  const [categoryQuery, setCategoryQuery] = useState('');

  const q = filterText.trim().toLowerCase();
  const cq = categoryQuery.trim().toLowerCase();

  const filteredCategories = useMemo(() => {
    const byCategory: Record<string, Array<[string, LayerDefinition]>> = {};
    for (const [name, def] of Object.entries(registry)) {
      const c = def.category || 'other';
      if (!byCategory[c]) byCategory[c] = [];
      byCategory[c].push([name, def]);
    }
    for (const k of Object.keys(byCategory)) {
      byCategory[k].sort((a, b) => a[0].localeCompare(b[0]));
    }

    return Object.entries(byCategory)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cat, items]) => {
        const itemsF = items.filter(([name, def]) => {
          if (cq && !cat.toLowerCase().includes(cq)) return false;
          if (!q) return true;
          const blob = `${name} ${def.description} ${cat}`.toLowerCase();
          return blob.includes(q);
        });
        return [cat, itemsF] as const;
      })
      .filter(([, items]) => items.length > 0);
  }, [registry, q, cq]);

  const onDragStart =
    (layerType: string) => (event: DragEvent<HTMLDivElement>) => {
      setPaletteDragLayerKey(layerType);
      event.dataTransfer.setData(DRAG_MIME, layerType);
      event.dataTransfer.setData('text/plain', layerType);
      event.dataTransfer.effectAllowed = 'copy';
    };

  const onDragEndPalette = () => {
    setPaletteDragLayerKey(null);
  };

  return (
    <div className="sidebar-inner" style={{ width: '100%' }}>
      <div className="sidebar-section-title">Shortcuts</div>
      <ul className="shortcuts-list">
        <li>Drag a layer to the canvas to add it.</li>
        <li>Connect: orange (out) → teal (in), or click both handles.</li>
        <li>Begin with Input, then stack layers toward one output.</li>
      </ul>

      <div className="sidebar-section-title">Layer registry</div>
      <input
        className="section-search"
        type="search"
        placeholder="Filter categories…"
        value={categoryQuery}
        onChange={(e) => setCategoryQuery(e.target.value)}
        aria-label="Filter categories"
      />

      {filteredCategories.map(([cat, items]) => (
        <div key={cat}>
          <div className="sidebar-section-title" style={{ borderBottomWidth: 0, marginTop: 8 }}>
            {cat}
          </div>
          {items.map(([name, def]) => (
            <div
              key={name}
              className="palette-row"
              draggable
              onDragStart={onDragStart(name)}
              onDragEnd={onDragEndPalette}
              title={def.description}
            >
              <span className="palette-checkbox" aria-hidden />
              <div className="palette-row-body">
                <span className="palette-name">{name}</span>
                <small className="palette-desc">{def.description}</small>
              </div>
            </div>
          ))}
        </div>
      ))}

      {filteredCategories.length === 0 && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
          No layers match your search.
        </p>
      )}
    </div>
  );
}

export { DRAG_MIME };
