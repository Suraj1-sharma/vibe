export const colors = {
  bg: '#121212',
  bgElevated: '#181818',
  card: '#282828',
  cardHover: '#333333',
  text: '#FFFFFF',
  textMuted: '#B3B3B3',
  textFaint: '#727272',
  accent: '#1DB954',
  accentDark: '#169C46',
  danger: '#E91429',
  warning: '#FFA42B',
  border: '#2A2A2A',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 4, md: 8, lg: 12, pill: 999 };

export const font = {
  h1: { fontSize: 28, fontWeight: '700' as const, color: colors.text },
  h2: { fontSize: 22, fontWeight: '700' as const, color: colors.text },
  h3: { fontSize: 17, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 15, fontWeight: '500' as const, color: colors.text },
  small: { fontSize: 13, fontWeight: '400' as const, color: colors.textMuted },
  tiny: { fontSize: 11, fontWeight: '400' as const, color: colors.textFaint },
};

export const MINI_PLAYER_HEIGHT = 60;
export const TAB_BAR_HEIGHT = 56;
