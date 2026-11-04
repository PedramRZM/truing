/*
 * Vendored from Airship (MIT), https://github.com/0xnyn/airship
 *   source: packages/overlay/src/canvas/frames.ts, commit 9307ddfe2828f8b61e06284fcece26e7cb829a5f (2026-10-24)
 *   licence: ./LICENSE (MIT, Copyright (c) 2026 Nayan Kumar)
 *
 * Changes (marked here, not inline):
 *   - Trimmed to the device presets: the types, PRESET_GROUPS, PRESETS,
 *     presetById, groupOfPreset and matchPreset. FrameManager and the rest of
 *     the file are not taken: Truing's canvas is React (src/shell/), and the
 *     frame layout, fit and zoom maths are re-implemented in src/shell/camera.ts.
 *   - Formatted with the repo's Prettier settings. No other edits.
 */

export interface DevicePreset {
  height: number;
  id: string;
  label: string;
  width: number;
}

export interface PresetGroup {
  id: string;
  label: string;
  presets: DevicePreset[];
}

/**
 * The device list, in buckets — sizes, not device emulation (see the note above).
 *
 * Groups are the source of truth and `PRESETS` is the flattening, not the other
 * way round. "Every preset is in exactly one bucket" is then true by
 * construction rather than by convention, and the group's order and the flat
 * lookup order stay one fact instead of two that can drift apart.
 *
 * Within a group the order is newest first — which makes it *not*
 * small → large, as this list used to be. That matters more than it looks,
 * because the order decides `matchPreset`'s fallback and four sizes here belong
 * to two devices each (402 × 874, 393 × 852, 430 × 932, 1440 × 1024). Newest
 * first means the un-preferred answer is the current name, which is the right
 * guess when there is nothing to prefer.
 */
export const PRESET_GROUPS: PresetGroup[] = [
  {
    id: 'phone',
    label: 'Phone',
    presets: [
      { height: 874, id: 'iphone-17', label: 'iPhone 17', width: 402 },
      {
        height: 874,
        id: 'iphone-16-pro',
        label: 'iPhone 16 & 17 Pro',
        width: 402,
      },
      { height: 852, id: 'iphone-16', label: 'iPhone 16', width: 393 },
      {
        height: 956,
        id: 'iphone-16-pro-max',
        label: 'iPhone 16 & 17 Pro Max',
        width: 440,
      },
      {
        height: 932,
        id: 'iphone-16-plus',
        label: 'iPhone 16 Plus',
        width: 430,
      },
      { height: 912, id: 'iphone-air', label: 'iPhone Air', width: 420 },
      {
        height: 932,
        id: 'iphone-14-pro-max',
        label: 'iPhone 14 & 15 Pro Max',
        width: 430,
      },
      {
        height: 852,
        id: 'iphone-14-pro',
        label: 'iPhone 14 & 15 Pro',
        width: 393,
      },
      { height: 844, id: 'iphone-13', label: 'iPhone 13 & 14', width: 390 },
      {
        height: 926,
        id: 'iphone-14-plus',
        label: 'iPhone 14 Plus',
        width: 428,
      },
      {
        height: 917,
        id: 'android-compact',
        label: 'Android Compact',
        width: 412,
      },
      {
        height: 840,
        id: 'android-medium',
        label: 'Android Medium',
        width: 700,
      },
    ],
  },
  {
    id: 'tablet',
    label: 'Tablet',
    presets: [
      { height: 1133, id: 'ipad-mini', label: 'iPad mini 8.3"', width: 744 },
      { height: 1194, id: 'ipad-pro-11', label: 'iPad Pro 11"', width: 834 },
      {
        height: 1366,
        id: 'ipad-pro-12-9',
        label: 'iPad Pro 12.9"',
        width: 1024,
      },
      { height: 960, id: 'surface-pro-8', label: 'Surface Pro 8', width: 1440 },
      {
        height: 800,
        id: 'android-expanded',
        label: 'Android Expanded',
        width: 1280,
      },
    ],
  },
  {
    id: 'desktop',
    label: 'Desktop',
    presets: [
      { height: 832, id: 'macbook-air', label: 'MacBook Air', width: 1280 },
      {
        height: 982,
        id: 'macbook-pro-14',
        label: 'MacBook Pro 14"',
        width: 1512,
      },
      {
        height: 1117,
        id: 'macbook-pro-16',
        label: 'MacBook Pro 16"',
        width: 1728,
      },
      { height: 1024, id: 'desktop', label: 'Desktop', width: 1440 },
      { height: 1024, id: 'wireframe', label: 'Wireframes', width: 1440 },
      { height: 720, id: 'tv', label: 'TV', width: 1280 },
    ],
  },
];

/** Flat, in group order — the sequence `matchPreset` falls back through. */
export const PRESETS: DevicePreset[] = PRESET_GROUPS.flatMap((g) => g.presets);

export function presetById(id: string | null): DevicePreset | null {
  return PRESETS.find((p) => p.id === id) ?? null;
}

/**
 * The bucket a preset belongs to, for the group the device menu opens on.
 *
 * Group ids and preset ids share the string `"desktop"`. They are separate
 * namespaces — `data-group` against `data-preset`, this function against
 * `presetById` — and the collision is harmless, since `groupOfPreset("desktop")`
 * returns the group holding the `desktop` preset either way. Said out loud so
 * the next reader does not have to work out whether it matters.
 */
export function groupOfPreset(id: string | null): PresetGroup | null {
  return PRESET_GROUPS.find((g) => g.presets.some((p) => p.id === id)) ?? null;
}

/**
 * The preset matching a size in either orientation, for the frame's badge.
 *
 * `preferId` is the frame's own `presetId`, and it settles the ambiguity this
 * list creates: four sizes belong to two devices each, so a lookup by numbers
 * alone answers with whichever comes first and quietly relabels the device the
 * user just picked. That was the old behaviour — the frame recorded which device
 * it was and nothing ever read it back.
 *
 * The preference is honoured *only while the numbers still agree*, and that is
 * the whole safety property: an id is a preference, not a key. A preset can
 * change its dimensions or leave the list entirely, and a frame carrying the old
 * id simply stops matching and falls back to the numbers. That is what lets the
 * list be edited with no migration and no versioned storage, and why no frame
 * can ever claim to be a device it is not the size of.
 *
 * Either orientation still matches, which is what lets `rotate` keep the badge.
 */
export function matchPreset(
  width: number,
  height: number,
  preferId?: string | null,
): DevicePreset | null {
  const fits = (p: DevicePreset): boolean =>
    (p.width === width && p.height === height) ||
    (p.height === width && p.width === height);
  const preferred = presetById(preferId ?? null);
  return (
    (preferred && fits(preferred) ? preferred : PRESETS.find(fits)) ?? null
  );
}
