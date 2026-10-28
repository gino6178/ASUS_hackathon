// ShuttleCoach's own design tokens (web/src/theme.css), reused for every title, caption and frame in the film
import { loadFont as manrope } from '@remotion/google-fonts/Manrope';
import { loadFont as michroma } from '@remotion/google-fonts/Michroma';
import { loadFont as plex } from '@remotion/google-fonts/IBMPlexMono';

export const SANS = manrope('normal', { weights: ['400', '500', '600', '700', '800'], subsets: ['latin'] }).fontFamily;
export const WIDE = michroma('normal', { weights: ['400'], subsets: ['latin'] }).fontFamily; // the wordmark face on the app's home page
export const MONO = plex('normal', { weights: ['400', '500'], subsets: ['latin'] }).fontFamily;

export const C = {
  bg: '#04070a',
  surface: '#0c1418',
  line: 'rgba(238,241,242,0.10)',
  ink: '#eef1f2',
  ink2: '#9aa6ab',
  ink3: '#5f6b70',
  accent: '#f2e6c9', // cream: the app's primary buttons and wordmark
  green: '#5fd39a',
  coach: { lin: '#b9a2ff', kai: '#6fb6ff', ren: '#ff8a6b', ada: '#5fd39a' },
};
