// Ported from ProfileScreen in ui/screens/Screens.kt.
import React, { useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme, ThemeMode } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import RegionSetting from '../components/RegionSetting';
import { DestinationPhoto } from '../components/common';
import { ShareStopModal } from '../components/ShareCard';
import { useTrips, VisitHistory } from '../context/TripsContext';
import { destinationById } from '../data/destinations';
import { formatDate } from '../utils/planDates';
import { tripTitle, usePlans } from '../context/PlansContext';

const CHIRPY_MASCOT = require('../../assets/branding/chirpy-guide.png');

export default function ProfileScreen() {
  const { colors, mode, setMode } = useTheme();
  const { session, setNickname } = useAuth();
  const { visitHistory } = useTrips();
  const { getMeta } = usePlans();
  // Renaming edits a draft, so backing out leaves the saved nickname alone.
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  // The visit whose share card is open, if any.
  const [sharingVisit, setSharingVisit] = useState<VisitHistory | null>(null);
  const draftReady = draftName.trim().length > 0;
  const explored = useMemo(
    () =>
      visitHistory.filter((visit) => destinationById(visit.destinationId)),
    [visitHistory]
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 24, gap: 16 }}
    >
      <Text style={{ fontSize: 28, fontWeight: '700', color: colors.onBackground }}>
        Profile
      </Text>

      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: colors.primaryContainer,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MaterialIcons name="person" size={24} color={colors.onPrimaryContainer} />
          </View>
          <View>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.onSurface }}>
              {session?.name ?? 'Guest traveler'}
            </Text>
            <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>
              {session?.email || 'Local travel profile'}
            </Text>
          </View>
        </View>
      </View>

      {/* Where the app is pointed */}
      <RegionSetting />

      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <View style={styles.exploredHeader}>
          <View style={[styles.exploredHeaderIcon, { backgroundColor: withAlpha(colors.primary, 0.11) }]}>
            <MaterialIcons name="beenhere" size={21} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.onSurface }}>
              Places explored
            </Text>
            <Text style={{ fontSize: 11, color: colors.onSurfaceVariant }}>
              Saved on this device when you check off a visit
            </Text>
          </View>
          <View style={[styles.exploredCount, { backgroundColor: withAlpha(colors.primary, 0.11) }]}>
            <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '800' }}>{explored.length}</Text>
          </View>
        </View>

        {explored.length === 0 ? (
          <View style={[styles.exploredEmpty, { backgroundColor: withAlpha(colors.surfaceVariant, 0.45) }]}>
            <MaterialIcons name="explore" size={22} color={colors.onSurfaceVariant} />
            <Text style={{ flex: 1, color: colors.onSurfaceVariant, fontSize: 11, lineHeight: 16 }}>
              Check a place in Trips after visiting it and your travel history will appear here.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {explored.map((visit) => {
              const destination = destinationById(visit.destinationId)!;
              const planName = tripTitle(getMeta(visit.planKey));
              return (
                <View
                  key={visit.visitKey}
                  style={[
                    styles.exploredCard,
                    {
                      backgroundColor: withAlpha(colors.surfaceVariant, 0.42),
                      borderColor: withAlpha(colors.outlineVariant, 0.5),
                    },
                  ]}
                >
                  <View style={styles.exploredThumbWrap}>
                    <DestinationPhoto
                      destination={destination}
                      style={styles.exploredThumb}
                      iconSize={22}
                    />
                    {/* The check rides the photo, so the card reads as "been
                        there" without spending a whole row on a badge. */}
                    <View style={styles.exploredCheck}>
                      <MaterialIcons name="check" size={13} color="#fff" />
                    </View>
                  </View>

                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <Text
                      numberOfLines={2}
                      style={{ color: colors.onSurface, fontSize: 13.5, fontWeight: '700' }}
                    >
                      {destination.name}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{ color: colors.onSurfaceVariant, fontSize: 11 }}
                    >
                      {destination.municipality} · {destination.category}
                    </Text>
                    <View style={styles.exploredMetaRow}>
                      <MetaChip icon="event" label={formatDate(visit.visitDate)} />
                      <MetaChip icon="event-note" label={planName} />
                    </View>
                  </View>

                  <Pressable
                    onPress={() => setSharingVisit(visit)}
                    accessibilityRole="button"
                    accessibilityLabel={`Share visit to ${destination.name}`}
                    style={({ pressed }) => [
                      styles.exploredShare,
                      {
                        backgroundColor: withAlpha(colors.primary, pressed ? 0.2 : 0.1),
                      },
                    ]}
                  >
                    <MaterialIcons name="ios-share" size={16} color={colors.primary} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Appearance */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.onSurface }}>
          Appearance
        </Text>
        <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>
          Choose how Chirpy looks on this device.
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <ThemeOption label="Light" icon="wb-sunny" selected={mode === 'LIGHT'} onPress={() => setMode('LIGHT')} />
          <ThemeOption label="Dark" icon="dark-mode" selected={mode === 'DARK'} onPress={() => setMode('DARK')} />
          <ThemeOption
            label="System"
            icon="phone-android"
            selected={mode === 'SYSTEM'}
            onPress={() => setMode('SYSTEM')}
          />
        </View>
      </View>

      <Pressable
        onPress={() => {
          setDraftName(session?.name ?? '');
          setRenaming(true);
        }}
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          height: 48,
          borderRadius: 14,
          backgroundColor: colors.secondaryContainer,
        }}
      >
        <Text style={{ color: colors.onSecondaryContainer, fontWeight: '600' }}>
          Change nickname
        </Text>
      </Pressable>

      <Modal
        visible={renaming}
        transparent
        animationType="fade"
        onRequestClose={() => setRenaming(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setRenaming(false)}>
          {/* Swallow taps on the dialog so only the backdrop dismisses. */}
          <Pressable
            style={[styles.dialog, { backgroundColor: colors.surface }]}
            onPress={() => {}}
          >
            <Image source={CHIRPY_MASCOT} resizeMode="contain" style={styles.dialogMascot} />
            <Text
              style={{
                fontSize: 17,
                fontWeight: '700',
                color: colors.onSurface,
                textAlign: 'center',
              }}
            >
              Change nickname
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: colors.onSurfaceVariant,
                marginTop: 2,
                textAlign: 'center',
              }}
            >
              This is what Chirpy will call you.
            </Text>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Preferred nickname"
              placeholderTextColor={colors.onSurfaceVariant}
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus
              maxLength={30}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (!draftReady) return;
                setNickname(draftName);
                setRenaming(false);
              }}
              style={[
                styles.dialogInput,
                {
                  color: colors.onSurface,
                  borderColor: withAlpha(colors.outline, 0.5),
                  backgroundColor: withAlpha(colors.surfaceVariant, 0.5),
                },
              ]}
            />
            <View style={styles.dialogActions}>
              <Pressable
                onPress={() => setRenaming(false)}
                style={({ pressed }) => [styles.dialogButton, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={{ color: colors.onSurfaceVariant, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={!draftReady}
                onPress={() => {
                  setNickname(draftName);
                  setRenaming(false);
                }}
                style={({ pressed }) => [
                  styles.dialogButton,
                  {
                    backgroundColor: colors.primary,
                    opacity: !draftReady ? 0.45 : pressed ? 0.86 : 1,
                  },
                ]}
              >
                <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {sharingVisit ? (
        <ShareStopModal
          destinationId={sharingVisit.destinationId}
          date={sharingVisit.visitDate}
          visited
          onClose={() => setSharingVisit(null)}
        />
      ) : null}
    </ScrollView>
  );
}

// Small labelled fact under a card's title — date, plan, and so on.
function MetaChip({
  icon,
  label,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.metaChip, { backgroundColor: withAlpha(colors.surface, 0.75) }]}>
      <MaterialIcons name={icon} size={11} color={colors.onSurfaceVariant} />
      <Text
        numberOfLines={1}
        style={{ fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant }}
      >
        {label}
      </Text>
    </View>
  );
}

function ThemeOption({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const bg = selected ? colors.primary : withAlpha(colors.surfaceVariant, 0.6);
  const fg = selected ? colors.onPrimary : colors.onSurface;
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        borderRadius: 12,
        backgroundColor: bg,
        paddingVertical: 12,
        alignItems: 'center',
        gap: 4,
      }}
    >
      <MaterialIcons name={icon} size={20} color={fg} />
      <Text style={{ fontSize: 12, fontWeight: '600', color: fg }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  exploredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  exploredHeaderIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploredCount: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploredEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 13,
    padding: 12,
  },
  exploredCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  exploredThumbWrap: {
    width: 56,
    height: 56,
  },
  exploredThumb: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(128,128,128,0.18)',
  },
  // Overhangs the photo's bottom-right corner, so it reads as a stamp on the
  // picture rather than part of the text column.
  exploredCheck: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 21,
    height: 21,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    borderWidth: 2,
    borderColor: '#fff',
  },
  exploredMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 1,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 150,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  exploredShare: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: '#00000080',
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    padding: 20,
  },
  dialogMascot: { width: 104, height: 104, alignSelf: 'center', marginBottom: 2 },
  dialogInput: {
    height: 48,
    marginTop: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  dialogButton: {
    minWidth: 88,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
});
