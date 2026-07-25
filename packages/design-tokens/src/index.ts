export const colors = {
  paper: '#F7F4EC',
  paperDeep: '#EFEAE0',
  ink: '#14120E',
  inkMuted: '#5C574D',
  accent: '#E0492C',
  accentAlt: '#1C3F6E',
  danger: '#A63223',
} as const;

export const spacing = { x1: 4, x2: 8, x3: 12, x4: 16, x5: 20, x6: 24, x8: 32, x10: 40, x12: 48, x16: 64, x20: 80, x24: 96 } as const;
export const radii = { editorial: 3 } as const;
export const typography = {
  meta: { fontSize: 12, lineHeight: 18, fontWeight: '500' as const, letterSpacing: 0.96 },
  body: { fontSize: 16, lineHeight: 25, fontWeight: '400' as const },
  heading: { fontSize: 28, lineHeight: 31, fontWeight: '600' as const },
  section: { fontSize: 40, lineHeight: 40, fontWeight: '600' as const },
  display: { fontSize: 64, lineHeight: 61, fontWeight: '600' as const },
} as const;
