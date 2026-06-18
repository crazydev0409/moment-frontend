// Central design tokens, sampled from the Figma export (design/). Use these
// instead of hard-coding colors so the whole app stays consistent and is easy
// to retune. Sampled values: accent #97B92A, page bg #F5F7FA, ink ~#1C1D26.

export const colors = {
  // Primary olive/lime accent (selected states, CTAs).
  green: '#97B92A',
  greenSoft: '#ABC752',
  greenTint: '#EAF1D5',
  greenText: '#3F8F2E',

  // Text
  ink: '#1C1D26',
  inkSoft: '#4E4F5A',
  grey: '#6F7780',
  greyLight: '#9AA1A9',
  placeholder: '#B9C0C7',

  // Surfaces
  pageBg: '#F5F7FA',
  card: '#FFFFFF',
  field: '#F2F4F6',
  border: '#E8EDF2',

  // Status
  danger: '#E5484D',
  white: '#FFFFFF',
  black: '#000000',
} as const;

// Badge palette for hook access levels.
export const accessBadge: Record<string, { label: string; fg: string; bg: string }> = {
  open: { label: 'Open', fg: '#3F8F2E', bg: '#E7F4E1' },
  shared: { label: 'Shared', fg: '#2D7FF9', bg: '#E4F0FF' },
  private: { label: 'Private', fg: '#C77B30', bg: '#FBEEDD' },
  personal: { label: 'Personal', fg: '#7A5AF8', bg: '#EEEAFE' },
};

// Free vs Paid pill on hook cards.
export const priceBadge = {
  free: { label: 'Free', fg: '#3F8F2E', bg: '#E7F4E1' },
  paid: { fg: '#FFFFFF', bg: '#1C1D26' },
} as const;
