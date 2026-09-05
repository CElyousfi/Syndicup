/**
 * Property Management App — design tokens (React Native / shared JS).
 * Mirrors tokens.css exactly. Import from here; never hardcode a value.
 */

export const color = {
  blue700: '#0844C4',
  blue600: '#0B5FFF',
  blue500: '#2E7BE8',
  blue400: '#59A5F0',
  blue300: '#8CC8FA',
  blue100: '#B9CFF2',

  amber600: '#E4740B',
  amber500: '#F7941D',
  amber400: '#FBC02D',
  yellow400: '#FFC93C',
  cream100: '#FCEFCD',

  green500: '#17B26A',
  red500: '#F2453D',

  bg: '#FFFFFF',
  bgAlt: '#FAFAFC',
  surface: '#F5F5F7',
  surfaceHover: '#EFEFF2',
  border: '#E4E4E8',
  text: '#111113',
  textMuted: '#8E8E93',
  textFaint: '#B0B0B5',
  onBrand: '#FFFFFF',
} as const;

/** For expo-linear-gradient / react-native-linear-gradient.
 *  135deg === start {x:0,y:0} → end {x:1,y:1} */
export const gradient = {
  hero:  { colors: ['#2E7BE8', '#0844C4'], start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  sky:   { colors: ['#8CC8FA', '#2E7BE8'], start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  amber: { colors: ['#F7BE2B', '#E4740B'], start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
} as const;

export const font = {
  regular: 'PlusJakartaSans-Regular',
  medium: 'PlusJakartaSans-Medium',
  semibold: 'PlusJakartaSans-SemiBold',
  bold: 'PlusJakartaSans-Bold',
  extrabold: 'PlusJakartaSans-ExtraBold',
} as const;

export const type = {
  display:   { fontSize: 28, lineHeight: 32, fontFamily: font.bold },
  statXl:    { fontSize: 32, lineHeight: 34, fontFamily: font.extrabold },
  statLg:    { fontSize: 30, lineHeight: 32, fontFamily: font.extrabold },
  statDonut: { fontSize: 26, lineHeight: 29, fontFamily: font.extrabold },
  title:     { fontSize: 20, lineHeight: 25, fontFamily: font.bold },
  section:   { fontSize: 18, lineHeight: 23, fontFamily: font.bold },
  cardTitle: { fontSize: 17, lineHeight: 23, fontFamily: font.bold },
  tab:       { fontSize: 16, lineHeight: 21, fontFamily: font.semibold },
  body:      { fontSize: 15, lineHeight: 22, fontFamily: font.medium },
  meta:      { fontSize: 14, lineHeight: 20, fontFamily: font.regular, color: color.textMuted },
  pill:      { fontSize: 13, lineHeight: 13, fontFamily: font.semibold },
  label:     { fontSize: 12, lineHeight: 12, fontFamily: font.medium, letterSpacing: 0.48,
               textTransform: 'uppercase' as const, color: color.textMuted },
  nav:       { fontSize: 11, lineHeight: 11, fontFamily: font.medium },
} as const;

export const radius = {
  hero: 24,
  card: 20,
  row: 16,
  nav: 24,
  pill: 999,
} as const;

export const space = {
  1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40,
  gutter: 16,
} as const;

/** The only shadow in the system. Everything else is flat. */
export const navShadow = {
  shadowColor: '#111113',
  shadowOffset: { width: 0, height: -4 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 8,
} as const;

export const pillVariant = {
  rented:         { bg: color.blue600,   fg: color.onBrand },
  onProgress:     { bg: color.blue600,   fg: color.onBrand },
  available:      { bg: color.yellow400, fg: color.text },
  newRequest:     { bg: color.yellow400, fg: color.text },
  readyToReview:  { bg: color.yellow400, fg: color.text },
} as const;

export const motion = { duration: 120, easing: [0.2, 0, 0, 1] as const };
