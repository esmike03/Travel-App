// Ported from ui/auth/AuthScreens.kt.
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardTypeOptions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { withAlpha } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';

const CHIRPY_MASCOT = require('../../../assets/branding/chirpy-guide.png');

function BrandHeader() {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center' }}>
      <Image
        source={CHIRPY_MASCOT}
        resizeMode="contain"
        style={{ width: 144, height: 144 }}
      />
      <Text style={{ fontSize: 31, fontWeight: '900', letterSpacing: -1, color: colors.onBackground }}>
        Chirpy
      </Text>
      <Text style={{ fontSize: 12, fontWeight: '600', letterSpacing: 0.4, color: colors.onSurfaceVariant }}>
        Your Travel Companion
      </Text>
    </View>
  );
}

function AuthTextField(props: {
  value: string;
  onChangeText: (t: string) => void;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  keyboardType?: KeyboardTypeOptions;
  editable?: boolean;
  secure?: boolean;
  trailing?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        styles.field,
        {
          borderColor: focused ? colors.primary : withAlpha(colors.outline, 0.55),
          backgroundColor: focused
            ? withAlpha(colors.primaryContainer, 0.48)
            : withAlpha(colors.surfaceVariant, 0.58),
        },
      ]}
    >
      <View
        style={[
          styles.fieldIcon,
          { backgroundColor: withAlpha(colors.primary, focused ? 0.16 : 0.1) },
        ]}
      >
        <MaterialIcons
          name={props.icon}
          size={18}
          color={focused ? colors.primary : colors.onSurfaceVariant}
        />
      </View>
      <TextInput
        style={[styles.input, { color: colors.onSurface }]}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.label}
        placeholderTextColor={colors.onSurfaceVariant}
        keyboardType={props.keyboardType}
        editable={props.editable}
        secureTextEntry={props.secure}
        autoCapitalize="none"
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {props.trailing}
    </View>
  );
}

function ErrorBanner({ message }: { message: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: colors.errorContainer,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      <MaterialIcons name="error-outline" size={18} color={colors.onErrorContainer} />
      <Text style={{ color: colors.onErrorContainer, fontSize: 13, flex: 1 }}>
        {message}
      </Text>
    </View>
  );
}

function PrimaryCta({
  label,
  loading,
  onPress,
}: {
  label: string;
  loading: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={[
        styles.primaryCta,
        {
          backgroundColor: colors.primary,
          opacity: loading ? 0.7 : 1,
          shadowColor: colors.primary,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onPrimary} />
      ) : (
        <>
          <Text style={{ color: colors.onPrimary, fontSize: 15, fontWeight: '800' }}>
            {label}
          </Text>
          <MaterialIcons name="arrow-forward" size={18} color={colors.onPrimary} />
        </>
      )}
    </Pressable>
  );
}

function AuthFooter({
  prompt,
  action,
  enabled,
  onPress,
}: {
  prompt: string;
  action: string;
  enabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!enabled} style={{ padding: 8 }}>
      <Text style={{ fontSize: 14, color: colors.onSurfaceVariant }}>
        {prompt}
        <Text style={{ color: colors.primary, fontWeight: '600' }}>{action}</Text>
      </Text>
    </Pressable>
  );
}

function AuthScaffold({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.authRoot, { backgroundColor: colors.background }]}>
      <View
        pointerEvents="none"
        style={[styles.primaryBackdrop, { backgroundColor: withAlpha(colors.primary, 0.11) }]}
      />
      <View
        pointerEvents="none"
        style={[styles.sunBackdrop, { backgroundColor: withAlpha(colors.secondary, 0.2) }]}
      />
      <View
        pointerEvents="none"
        style={[styles.bottomBackdrop, { backgroundColor: withAlpha(colors.primary, 0.07) }]}
      />
      <View pointerEvents="none" style={styles.sparkleOne}>
        <MaterialIcons name="auto-awesome" size={22} color={withAlpha(colors.secondary, 0.7)} />
      </View>
      <View pointerEvents="none" style={styles.sparkleTwo}>
        <MaterialIcons name="flight" size={20} color={withAlpha(colors.primary, 0.35)} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scaffold}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <BrandHeader />
        <View
          style={[
            styles.formCard,
            {
              backgroundColor: withAlpha(colors.surface, 0.97),
              borderColor: withAlpha(colors.outline, 0.36),
            },
          ]}
        >
          <View style={[styles.formAccent, { backgroundColor: colors.secondary }]} />
          <Text style={[styles.title, { color: colors.onBackground }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>{subtitle}</Text>
          <View style={styles.formFields}>{children}</View>
        </View>
        <Text style={[styles.footerNote, { color: colors.onSurfaceVariant }]}> 
          Plan thoughtfully. Travel lightly. Remember everything.
        </Text>
      </ScrollView>
    </View>
  );
}

function VisibilityToggle({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onToggle} hitSlop={8}>
      <MaterialIcons
        name={visible ? 'visibility-off' : 'visibility'}
        size={20}
        color={colors.onSurfaceVariant}
      />
    </Pressable>
  );
}

export function LoginScreen({ onNavigateToRegister }: { onNavigateToRegister: () => void }) {
  const { formState, login, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <AuthScaffold title="Welcome back" subtitle="Your next little adventure is waiting.">
      <AuthTextField
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          clearError();
        }}
        label="Email"
        icon="email"
        keyboardType="email-address"
        editable={!formState.loading}
      />
      <AuthTextField
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          clearError();
        }}
        label="Password"
        icon="lock"
        editable={!formState.loading}
        secure={!showPassword}
        trailing={
          <VisibilityToggle
            visible={showPassword}
            onToggle={() => setShowPassword((v) => !v)}
          />
        }
      />
      {formState.error ? <ErrorBanner message={formState.error} /> : null}
      <View style={{ height: 4 }} />
      <PrimaryCta
        label="Sign in"
        loading={formState.loading}
        onPress={() => login(email, password)}
      />
      <View style={{ alignItems: 'center' }}>
        <AuthFooter
          prompt="New to Chirpy? "
          action="Create account"
          enabled={!formState.loading}
          onPress={onNavigateToRegister}
        />
      </View>
    </AuthScaffold>
  );
}

export function RegisterScreen({ onNavigateToLogin }: { onNavigateToLogin: () => void }) {
  const { formState, register, clearError } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <AuthScaffold
      title="Create account"
      subtitle="Save trips and sync them across your devices."
    >
      <AuthTextField
        value={username}
        onChangeText={(t) => {
          setUsername(t);
          clearError();
        }}
        label="Username"
        icon="person"
        editable={!formState.loading}
      />
      <AuthTextField
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          clearError();
        }}
        label="Email"
        icon="email"
        keyboardType="email-address"
        editable={!formState.loading}
      />
      <AuthTextField
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          clearError();
        }}
        label="Password (min 8)"
        icon="lock"
        editable={!formState.loading}
        secure={!showPassword}
        trailing={
          <VisibilityToggle
            visible={showPassword}
            onToggle={() => setShowPassword((v) => !v)}
          />
        }
      />
      <AuthTextField
        value={confirm}
        onChangeText={(t) => {
          setConfirm(t);
          clearError();
        }}
        label="Confirm password"
        icon="lock"
        editable={!formState.loading}
        secure={!showConfirm}
        trailing={
          <VisibilityToggle
            visible={showConfirm}
            onToggle={() => setShowConfirm((v) => !v)}
          />
        }
      />
      {formState.error ? <ErrorBanner message={formState.error} /> : null}
      <View style={{ height: 4 }} />
      <PrimaryCta
        label="Create account"
        loading={formState.loading}
        onPress={() => register(username, email, password, confirm)}
      />
      <View style={{ alignItems: 'center' }}>
        <AuthFooter
          prompt="Already have an account? "
          action="Sign in"
          enabled={!formState.loading}
          onPress={onNavigateToLogin}
        />
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  authRoot: {
    flex: 1,
    overflow: 'hidden',
  },
  primaryBackdrop: {
    position: 'absolute',
    width: 330,
    height: 330,
    borderRadius: 165,
    right: -150,
    top: -150,
  },
  sunBackdrop: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    left: -115,
    top: 215,
  },
  bottomBackdrop: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    right: -170,
    bottom: -125,
  },
  sparkleOne: { position: 'absolute', top: 86, left: 34 },
  sparkleTwo: { position: 'absolute', top: 214, right: 30, transform: [{ rotate: '18deg' }] },
  scaffold: {
    paddingTop: 38,
    paddingHorizontal: 20,
    paddingBottom: 34,
    alignItems: 'center',
    flexGrow: 1,
  },
  formCard: {
    width: '100%',
    marginTop: 20,
    padding: 20,
    borderRadius: 28,
    borderWidth: 1,
    shadowColor: '#082521',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  formAccent: {
    width: 34,
    height: 5,
    borderRadius: 3,
    marginBottom: 13,
  },
  title: {
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  formFields: { width: '100%', gap: 12, marginTop: 18 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 18,
    paddingLeft: 9,
    paddingRight: 14,
    height: 58,
  },
  fieldIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  primaryCta: {
    height: 54,
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
  footerNote: {
    maxWidth: 280,
    marginTop: 18,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});
