/** Fallback when dataTransfer payload is missing in some browsers / drag paths */
let lastPaletteLayerKey: string | null = null;

export function setPaletteDragLayerKey(key: string | null) {
  lastPaletteLayerKey = key;
}

export function peekPaletteDragLayerKey(): string | null {
  return lastPaletteLayerKey;
}
