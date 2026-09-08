// Chirpy peeking over the bottom-right edge with a speech bubble. Used on empty
// states so a blank screen still has the mascot saying something useful.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';

const CHIRPY = require('../../assets/branding/chirpy-guide.png');

export default function ChirpyPeek({
  message,
  bottom = 0,
}: {
  message: string;
  /** Lift Chirpy clear of whatever else floats at the bottom of the screen. */
  bottom?: number;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const peek = useRef(new Animated.Value(0)).current;
  const bubble = useRef(new Animated.Value(0)).current;

  // Chirpy pops up first, then speaks on his own — tapping toggles afterwards.
  useEffect(() => {
    Animated.timing(peek, {
      toValue: 1,
      duration: 460,
      easing: Easing.out(Easing.back(1.5)),
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => setOpen(true), 620);
    return () => clearTimeout(timer);
  }, [peek]);

  useEffect(() => {
    Animated.timing(bubble, {
      toValue: open ? 1 : 0,
      duration: open ? 240 : 150,
      easing: open ? Easing.out(Easing.back(1.7)) : Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [open, bubble]);

  return (
    <View pointerEvents="box-none" style={[styles.root, { bottom }]}>
      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        style={[
          styles.bubble,
          {
            backgroundColor: colors.surface,
            borderColor: withAlpha(colors.outline, 0.34),
            opacity: bubble,
            transform: [
              { scale: bubble.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
              { translateY: bubble.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
            ],
          },
        ]}
      >
        <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '600', color: colors.onSurface }}>
          {message}
        </Text>
        <View
          style={[
            styles.tail,
            { backgroundColor: colors.surface, borderColor: withAlpha(colors.outline, 0.34) },
          ]}
        />
      </Animated.View>

      <Animated.View
        style={{
          transform: [
            { translateY: peek.interpolate({ inputRange: [0, 1], outputRange: [PEEK_HEIGHT, 0] }) },
          ],
        }}
      >
        <Pressable
          onPress={() => setOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={open ? 'Hide Chirpy’s tip' : 'Show Chirpy’s tip'}
          hitSlop={6}
          style={styles.peekWindow}
        >
          <Image source={CHIRPY} resizeMode="contain" style={styles.mascot} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

// Only the top of the mascot shows, so he reads as peeking over the edge.
const PEEK_HEIGHT = 112;
/** Width the mascot claims in the bottom-right corner, including its margin. */
export const CHIRPY_PEEK_LANE = 162;

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    right: 12,
    alignItems: 'flex-end',
    gap: 8,
  },
  bubble: {
    maxWidth: 232,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 10,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  tail: {
    position: 'absolute',
    right: 24,
    bottom: -6,
    width: 11,
    height: 11,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
  peekWindow: {
    height: PEEK_HEIGHT,
    overflow: 'hidden',
    alignItems: 'center',
  },
  mascot: { width: 150, height: 150 },
});
