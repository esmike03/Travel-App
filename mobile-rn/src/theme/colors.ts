// Ported from ui/theme/Color.kt + Theme.kt (Material 3 light/dark schemes).

export interface ColorScheme {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
}

export const lightColors: ColorScheme = {
  primary: '#1F7A4D',
  onPrimary: '#FFFFFF',
  primaryContainer: '#B8E5CE',
  onPrimaryContainer: '#08331D',
  secondary: '#39A7D8',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#C7E8F5',
  onSecondaryContainer: '#06344A',
  background: '#F5FAF8',
  onBackground: '#14211B',
  surface: '#FFFFFF',
  onSurface: '#14211B',
  surfaceVariant: '#E5EFEA',
  onSurfaceVariant: '#4B5A54',
  outline: '#CBD5CF',
  outlineVariant: '#D9E2DD',
  error: '#B3261E',
  onError: '#FFFFFF',
  errorContainer: '#F9DEDC',
  onErrorContainer: '#410E0B',
};

export const darkColors: ColorScheme = {
  primary: '#6FD09E',
  onPrimary: '#00381F',
  primaryContainer: '#14442E',
  onPrimaryContainer: '#B8E5CE',
  secondary: '#7CC6E6',
  onSecondary: '#002738',
  secondaryContainer: '#11445A',
  onSecondaryContainer: '#C7E8F5',
  background: '#0F1613',
  onBackground: '#E6EEE9',
  surface: '#171F1B',
  onSurface: '#E6EEE9',
  surfaceVariant: '#283532',
  onSurfaceVariant: '#B6C1BC',
  outline: '#3D4A45',
  outlineVariant: '#2E3A36',
  error: '#F2B8B5',
  onError: '#601410',
  errorContainer: '#601410',
  onErrorContainer: '#F9DEDC',
};

// Helper to apply alpha to a 6-digit hex color (mirrors Compose's Color.copy(alpha=...)).
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}
