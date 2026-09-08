// Placeholder blocks shown while a screen's data is still loading, so the app
// never flashes an empty state that is about to be replaced by real content.
import React, { useEffect, useRef } from 'react';
import { Animated, DimensionValue, Easing, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';

/** One shimmering block. Sizes are plain style props so callers can shape rows. */
export function SkeletonBlock({
  width,
  height,
  radius = 8,
  style,
}: {
  width?: DimensionValue;
  height: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 720,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 720,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: withAlpha(colors.onSurfaceVariant, 0.16),
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
        },
        style,
      ]}
    />
  );
}

/** A thumbnail-plus-two-lines row, matching the saved/stop card layout. */
export function SkeletonRow() {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: colors.surface }]}>
      <SkeletonBlock width={96} height={96} radius={16} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonBlock width="70%" height={14} />
        <SkeletonBlock width="45%" height={11} />
        <SkeletonBlock width="30%" height={11} />
      </View>
    </View>
  );
}

/** Screen-level placeholder: a title block over a few rows. */
export default function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <View style={{ paddingTop: 20, paddingHorizontal: 20, gap: 12 }} pointerEvents="none">
      <SkeletonBlock width="55%" height={30} radius={10} />
      <SkeletonBlock width="35%" height={13} style={{ marginBottom: 8 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    padding: 12,
  },
});
