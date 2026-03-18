export interface TileDef {
  id: string;
  walkable: boolean;
  decoration: boolean;
  image: HTMLImageElement;
  /** Y pixel in the image where the decoration contacts the ground (used as draw anchor) */
  footY?: number;
}

export const TILE_META: Record<string, { walkable: boolean; decoration: boolean; footY?: number }> = {
  // ── Earth / dirt base tiles (walkable) ──────────────────────
  'tile_000': { walkable: true, decoration: false },
  'tile_001': { walkable: true, decoration: false },
  'tile_002': { walkable: true, decoration: false },
  'tile_003': { walkable: true, decoration: false },
  'tile_004': { walkable: true, decoration: false },
  'tile_005': { walkable: true, decoration: false },
  'tile_006': { walkable: true, decoration: false },
  'tile_007': { walkable: true, decoration: false },
  'tile_008': { walkable: true, decoration: false },
  'tile_009': { walkable: true, decoration: false },
  'tile_010': { walkable: true, decoration: false },

  // ── Rocky / textured dirt (walkable) ────────────────────────
  'tile_011': { walkable: true, decoration: false },
  'tile_012': { walkable: true, decoration: false },
  'tile_013': { walkable: true, decoration: false },
  'tile_014': { walkable: true, decoration: false },
  'tile_015': { walkable: true, decoration: false },
  'tile_016': { walkable: true, decoration: false },
  'tile_017': { walkable: true, decoration: false },
  'tile_018': { walkable: true, decoration: false },
  'tile_019': { walkable: true, decoration: false },

  // ── Earth with flowers / transition (walkable) ──────────────
  'tile_020': { walkable: true, decoration: false },
  'tile_021': { walkable: true, decoration: false },
  'tile_022': { walkable: true, decoration: false },
  'tile_023': { walkable: true, decoration: false },
  'tile_024': { walkable: true, decoration: false },
  'tile_025': { walkable: true, decoration: false },
  'tile_026': { walkable: true, decoration: false },

  // ── Green grass base tiles (walkable) ───────────────────────
  'tile_027': { walkable: true, decoration: false },
  'tile_028': { walkable: true, decoration: false },

  // ── Bush / vegetation decorations (non-walkable, sway) ──────
  'tile_029': { walkable: false, decoration: true, footY: 22 },
  'tile_030': { walkable: false, decoration: true, footY: 22 },
  'tile_031': { walkable: false, decoration: true, footY: 22 },
  'tile_032': { walkable: false, decoration: true, footY: 22 },
  'tile_033': { walkable: false, decoration: true, footY: 22 },
  'tile_034': { walkable: false, decoration: true, footY: 22 },
  'tile_035': { walkable: false, decoration: true, footY: 22 },
  'tile_036': { walkable: false, decoration: true, footY: 22 },

  // ── Bright / light green grass (walkable) ───────────────────
  'tile_037': { walkable: true, decoration: false },
  'tile_038': { walkable: true, decoration: false },
  'tile_039': { walkable: true, decoration: false },
  'tile_040': { walkable: true, decoration: false },

  // ── Flower / plant decorations (non-walkable) ───────────────
  'tile_041': { walkable: false, decoration: true, footY: 20 },
  'tile_042': { walkable: false, decoration: true, footY: 20 },
  'tile_043': { walkable: false, decoration: true, footY: 20 },
  'tile_044': { walkable: false, decoration: true, footY: 20 },
  'tile_045': { walkable: false, decoration: true, footY: 24 },
  'tile_046': { walkable: false, decoration: true, footY: 20 },
  'tile_047': { walkable: false, decoration: true, footY: 20 },

  // ── Log / stump decorations (non-walkable) ──────────────────
  'tile_048': { walkable: false, decoration: true, footY: 25 },
  'tile_049': { walkable: false, decoration: true, footY: 25 },

  // ── Rock / boulder decorations (non-walkable) ───────────────
  'tile_050': { walkable: false, decoration: true, footY: 25 },
  'tile_051': { walkable: false, decoration: true, footY: 25 },
  'tile_052': { walkable: false, decoration: true, footY: 25 },
  'tile_053': { walkable: false, decoration: true, footY: 25 },
  'tile_054': { walkable: false, decoration: true, footY: 25 },
  'tile_055': { walkable: false, decoration: true, footY: 24 },
  'tile_056': { walkable: false, decoration: true, footY: 24 },
  'tile_057': { walkable: false, decoration: true, footY: 24 },
  'tile_058': { walkable: false, decoration: true, footY: 24 },
  'tile_059': { walkable: false, decoration: true, footY: 24 },

  // ── Large rocks / stones (non-walkable decorations) ─────────
  'tile_060': { walkable: false, decoration: true, footY: 26 },
  'tile_061': { walkable: false, decoration: true, footY: 26 },
  'tile_062': { walkable: false, decoration: true, footY: 26 },
  'tile_063': { walkable: false, decoration: true, footY: 26 },
  'tile_064': { walkable: false, decoration: true, footY: 26 },
  'tile_065': { walkable: false, decoration: true, footY: 26 },
  'tile_066': { walkable: false, decoration: true, footY: 26 },
  'tile_067': { walkable: false, decoration: true, footY: 26 },
  'tile_068': { walkable: false, decoration: true, footY: 26 },
  'tile_069': { walkable: false, decoration: true, footY: 26 },

  // ── Stone features / pond stones (non-walkable decorations) ─
  'tile_070': { walkable: false, decoration: true, footY: 25 },
  'tile_071': { walkable: false, decoration: true, footY: 25 },
  'tile_072': { walkable: false, decoration: true, footY: 25 },
  'tile_073': { walkable: false, decoration: true, footY: 25 },
  'tile_074': { walkable: false, decoration: true, footY: 25 },
  'tile_075': { walkable: false, decoration: true, footY: 20 },
  'tile_076': { walkable: false, decoration: true, footY: 20 },
  'tile_077': { walkable: false, decoration: true, footY: 20 },
  'tile_078': { walkable: false, decoration: true, footY: 20 },
  'tile_079': { walkable: false, decoration: true, footY: 20 },

  // ── Ice / crystal decorations ───────────────────────────────
  'tile_080': { walkable: false, decoration: true, footY: 28 },
  'tile_081': { walkable: false, decoration: true, footY: 28 },
  'tile_082': { walkable: false, decoration: true, footY: 28 },
  'tile_083': { walkable: false, decoration: true, footY: 28 },
  'tile_084': { walkable: false, decoration: true, footY: 28 },

  // ── Small particles / features ──────────────────────────────
  'tile_085': { walkable: false, decoration: true, footY: 16 },
  'tile_086': { walkable: false, decoration: true, footY: 16 },
  'tile_087': { walkable: false, decoration: true, footY: 16 },
  'tile_088': { walkable: false, decoration: true, footY: 16 },
  'tile_089': { walkable: false, decoration: true, footY: 16 },

  // ── Water base tiles (non-walkable) ─────────────────────────
  'tile_090': { walkable: false, decoration: false },
  'tile_091': { walkable: false, decoration: false },
  'tile_092': { walkable: false, decoration: false },
  'tile_093': { walkable: false, decoration: false },
  'tile_094': { walkable: false, decoration: false },
  'tile_095': { walkable: false, decoration: false },
  'tile_096': { walkable: false, decoration: false },
  'tile_097': { walkable: false, decoration: false },
  'tile_098': { walkable: false, decoration: false },
  'tile_099': { walkable: false, decoration: false },
  'tile_100': { walkable: false, decoration: false },
  'tile_101': { walkable: false, decoration: false },
  'tile_102': { walkable: false, decoration: false },
  'tile_103': { walkable: false, decoration: false },
  'tile_104': { walkable: false, decoration: false },
  'tile_105': { walkable: false, decoration: false },
  'tile_106': { walkable: false, decoration: false },
  'tile_107': { walkable: false, decoration: false },
  'tile_108': { walkable: false, decoration: false },
  'tile_109': { walkable: false, decoration: false },
  'tile_110': { walkable: false, decoration: false },
  'tile_111': { walkable: false, decoration: false },
  'tile_112': { walkable: false, decoration: false },
  'tile_113': { walkable: false, decoration: false },
  'tile_114': { walkable: false, decoration: false },
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load tile: ${src}`));
    img.src = src;
  });
}

/** Build a metadata-only map for pathfinding (no image loading). */
export function getTileMetaMap(): Map<string, TileDef> {
  const map = new Map<string, TileDef>();
  for (const [id, meta] of Object.entries(TILE_META)) {
    map.set(id, { id, ...meta, image: null! });
  }
  return map;
}

export async function loadTiles(basePath: string): Promise<Map<string, TileDef>> {
  const entries = Object.entries(TILE_META);
  const results = await Promise.all(
    entries.map(async ([id, meta]) => {
      const img = await loadImage(`${basePath}terrain/${id}.png`);
      return { id, ...meta, image: img } as TileDef;
    }),
  );

  const map = new Map<string, TileDef>();
  for (const def of results) {
    map.set(def.id, def);
  }
  return map;
}
