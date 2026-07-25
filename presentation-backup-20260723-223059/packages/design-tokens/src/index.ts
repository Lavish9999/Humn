export const colors = {
  background: '#F5F2EA',
  surface: '#FFFDF8',
  text: '#171612',
  textSecondary: '#6B675F',
  border: '#DED9CE',
  accent: '#255B45',
  accentPressed: '#1C4635',
  warmAccent: '#B86F48',
  verified: '#237B50',
  warning: '#BD7A24',
  danger: '#B6473D',
  darkBackground: '#121310',
  darkSurface: '#1A1C18',
  darkText: '#F5F2EA',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radii = { control: 10, media: 14, card: 16, sheet: 24, round: 999 } as const;
export const typography = {
  display: { fontSize: 44, lineHeight: 48, fontWeight: '700' as const },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '650' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
} as const;
