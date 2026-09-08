import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { withAlpha } from '../../theme/colors';

const CHIRPY_MASCOT = require('../../../assets/branding/chirpy-guide.png');

export default function NicknameScreen() {
  const { colors } = useTheme();
  const { setNickname } = useAuth();
  const insets = useSafeAreaInsets();
  const [nickname, setNicknameValue] = useState('');
  const [focused, setFocused] = useState(false);
  const ready = nickname.trim().length > 0;

  // The branding stays full size, so the page is scrolled instead: the keyboard's
  // height is added as bottom padding and the view scrolls down to it, which
  // lifts the field clear without anything on screen resizing.
  const scrollRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const shown = Keyboard.addListener(showEvent, (e) =>
      setKeyboardHeight(e.endCoordinates.height)
    );
    const hidden = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  useEffect(() => {
    if (keyboardHeight === 0) return;
    // Wait for the new padding to land before scrolling to it.
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(timer);
  }, [keyboardHeight]);

  const continueToApp = () => {
    if (ready) setNickname(nickname);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        pointerEvents="none"
        style={[styles.primaryOrb, { backgroundColor: withAlpha(colors.primary, 0.11) }]}
      />
      <View
        pointerEvents="none"
        style={[styles.sunOrb, { backgroundColor: withAlpha(colors.secondary, 0.2) }]}
      />
      <View pointerEvents="none" style={styles.sparkle}>
        <MaterialIcons name="auto-awesome" size={24} color={withAlpha(colors.secondary, 0.75)} />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top + 18, 36),
            paddingBottom: Math.max(insets.bottom + 24, 36) + keyboardHeight,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brand}>
          <Image source={CHIRPY_MASCOT} resizeMode="contain" style={styles.mascot} />
          <Text style={[styles.brandName, { color: colors.onBackground }]}>Chirpy</Text>
          <Text style={[styles.tagline, { color: colors.onSurfaceVariant }]}>
            Your Travel Companion
          </Text>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: withAlpha(colors.surface, 0.97),
              borderColor: withAlpha(colors.outline, 0.36),
            },
          ]}
        >
          <View style={[styles.accent, { backgroundColor: colors.secondary }]} />
          <Text style={[styles.title, { color: colors.onSurface }]}>What should Chirpy call you?</Text>
          <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}> 
            A nickname makes recommendations and trip reminders feel a little more personal.
          </Text>

          <View
            style={[
              styles.inputWrap,
              {
                borderColor: focused ? colors.primary : withAlpha(colors.outline, 0.55),
                backgroundColor: focused
                  ? withAlpha(colors.primaryContainer, 0.48)
                  : withAlpha(colors.surfaceVariant, 0.58),
              },
            ]}
          >
            <View style={[styles.inputIcon, { backgroundColor: withAlpha(colors.primary, 0.12) }]}>
              <MaterialIcons name="person" size={19} color={colors.primary} />
            </View>
            <TextInput
              value={nickname}
              onChangeText={setNicknameValue}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onSubmitEditing={continueToApp}
              placeholder="Preferred nickname"
              placeholderTextColor={colors.onSurfaceVariant}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={30}
              returnKeyType="done"
              style={[styles.input, { color: colors.onSurface }]}
            />
          </View>

          <Pressable
            onPress={continueToApp}
            disabled={!ready}
            style={({ pressed }) => [
              styles.cta,
              {
                backgroundColor: colors.primary,
                opacity: !ready ? 0.45 : pressed ? 0.86 : 1,
                shadowColor: colors.primary,
              },
            ]}
          >
            <Text style={{ color: colors.onPrimary, fontSize: 15, fontWeight: '800' }}>Let’s explore</Text>
            <MaterialIcons name="arrow-forward" size={18} color={colors.onPrimary} />
          </Pressable>

          <View style={styles.localNote}>
            <MaterialIcons name="lock-outline" size={13} color={colors.onSurfaceVariant} />
            <Text style={{ color: colors.onSurfaceVariant, fontSize: 10, fontWeight: '600' }}>
              Saved only on this device. No account needed.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  primaryOrb: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    right: -155,
    top: -155,
  },
  sunOrb: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    left: -120,
    top: 260,
  },
  sparkle: { position: 'absolute', left: 34, top: 92 },
  content: { flexGrow: 1, paddingHorizontal: 20, justifyContent: 'center' },
  brand: { alignItems: 'center' },
  mascot: { width: 170, height: 170 },
  brandName: { marginTop: -4, fontSize: 33, lineHeight: 39, fontWeight: '900', letterSpacing: -1 },
  tagline: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  card: {
    marginTop: 22,
    padding: 20,
    borderRadius: 28,
    borderWidth: 1,
    shadowColor: '#082521',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  accent: { width: 34, height: 5, borderRadius: 3, marginBottom: 13 },
  title: { fontSize: 25, lineHeight: 31, fontWeight: '900', letterSpacing: -0.6 },
  subtitle: { marginTop: 5, fontSize: 13, lineHeight: 18 },
  inputWrap: {
    height: 58,
    marginTop: 20,
    paddingLeft: 9,
    paddingRight: 14,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: { flex: 1, height: '100%', fontSize: 15, fontWeight: '600' },
  cta: {
    height: 54,
    marginTop: 14,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  localNote: {
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
});
