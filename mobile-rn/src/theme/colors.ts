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
  primary: '#0B6E69',
  onPrimary: '#FFFFFF',
  primaryContainer: '#D8F3EC',
  onPrimaryContainer: '#073C38',
  secondary: '#F2A92F',
  onSecondary: '#3F2A00',
  secondaryContainer: '#FFE8B0',
  onSecondaryContainer: '#4A3100',
  background: '#FAF8F2',
  onBackground: '#16312E',
  surface: '#FFFFFF',
  onSurface: '#16312E',
  surfaceVariant: '#E9F1EE',
  onSurfaceVariant: '#60716D',
  outline: '#BACBC6',
  outlineVariant: '#DFE8E4',
  error: '#B3261E',
  onError: '#FFFFFF',
  errorContainer: '#F9DEDC',
  onErrorContainer: '#410E0B',
};

export const darkColors: ColorScheme = {
  primary: '#68D4C9',
  onPrimary: '#003733',
  primaryContainer: '#154E49',
  onPrimaryContainer: '#B7F1E8',
  secondary: '#F7C461',
  onSecondary: '#422C00',
  secondaryContainer: '#5C430D',
  onSecondaryContainer: '#FFE4A1',
  background: '#0E1817',
  onBackground: '#E7EFEC',
  surface: '#162321',
  onSurface: '#E7EFEC',
  surfaceVariant: '#263936',
  onSurfaceVariant: '#B7C8C3',
  outline: '#415854',
  outlineVariant: '#2C403C',
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
