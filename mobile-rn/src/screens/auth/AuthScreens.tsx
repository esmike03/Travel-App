// Ported from ui/auth/AuthScreens.kt.
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardTypeOptions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { ColorScheme } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';

function BrandHeader() {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: colors.primaryContainer,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MaterialIcons name="explore" size={36} color={colors.onPrimaryContainer} />
      </View>
      <View style={{ height: 12 }} />
      <Text style={{ fontSize: 24, fontWeight: '700', color: colors.onBackground }}>
        Travs
      </Text>
      <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>
        Bohol Travel Companion
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
          borderColor: focused ? colors.primary : colors.outlineVariant,
          backgroundColor: colors.surface,
        },
      ]}
    >
      <MaterialIcons name={props.icon} size={20} color={colors.onSurfaceVariant} />
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
      style={{
        backgroundColor: colors.primary,
        height: 52,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator color={colors.onPrimary} />
      ) : (
        <Text style={{ color: colors.onPrimary, fontSize: 16, fontWeight: '600' }}>
          {label}
        </Text>
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
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.scaffold}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ height: 64 }} />
      <BrandHeader />
      <View style={{ height: 28 }} />
      <Text style={[styles.title, { color: colors.onBackground }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
        {subtitle}
      </Text>
      <View style={{ height: 16 }} />
      <View style={{ width: '100%', gap: 12 }}>{children}</View>
      <View style={{ height: 32 }} />
    </ScrollView>
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
    <AuthScaffold title="Welcome back" subtitle="Sign in to continue exploring Bohol.">
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
          prompt="New to Travs? "
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
  scaffold: {
    paddingHorizontal: 24,
    alignItems: 'center',
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 56,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
});
