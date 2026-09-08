// Weather UI: a full card for the destination screen and a compact chip for trip
// stops. Both render nothing rather than a hollow placeholder when there is no
// forecast — an empty weather box is worse than no weather box.
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import { useWeather, useDestinationWeather, useForecastFor } from '../context/WeatherContext';
import { isWashout, weatherIcon, weatherLabel, weatherTint } from '../data/weather';
import { isoToDate, todayIso } from '../utils/planDates';
import { SkeletonBlock } from './Skeleton';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayLabel(iso: string): string {
  if (iso === todayIso()) return 'Today';
  return DAYS[isoToDate(iso).getDay()];
}

/** Current conditions + the week ahead, for the destination screen. */
export function WeatherCard({ destinationId }: { destinationId: number }) {
  const { colors } = useTheme();
  const { loading, offline, refresh } = useWeather();
  const weather = useDestinationWeather(destinationId);

  if (loading && !weather) {
    // Shaped like the real card, so it does not jump when the forecast lands.
    return (
      <View
        style={{
          borderRadius: 18,
          padding: 16,
          backgroundColor: withAlpha(colors.onSurfaceVariant, 0.06),
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <SkeletonBlock width={40} height={40} radius={20} />
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonBlock width="50%" height={26} />
            <SkeletonBlock width="70%" height={12} />
          </View>
        </View>
      </View>
    );
  }
  if (!weather) {
    return (
      <Pressable
        onPress={refresh}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16 }}
      >
        <MaterialIcons name="cloud-off" size={18} color={colors.onSurfaceVariant} />
        <Text style={{ flex: 1, fontSize: 13, color: colors.onSurfaceVariant }}>
          Weather unavailable. Tap to retry.
        </Text>
      </Pressable>
    );
  }

  const now = weather.current;
  const today = weather.daily[0];
  const tint = weatherTint(now?.code ?? today?.code ?? 0);

  return (
    <View
      style={{
        borderRadius: 18,
        padding: 16,
        backgroundColor: withAlpha(tint, 0.12),
        borderWidth: 1,
        borderColor: withAlpha(tint, 0.35),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <MaterialIcons
          name={weatherIcon(now?.code ?? 0, now?.isDay ?? true)}
          size={40}
          color={tint}
        />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
            <Text style={{ fontSize: 30, fontWeight: '800', color: colors.onSurface }}>
              {now ? `${Math.round(now.tempC)}°` : '—'}
            </Text>
            <Text style={{ fontSize: 14, color: colors.onSurfaceVariant, marginBottom: 5 }}>
              {weatherLabel(now?.code ?? today?.code ?? 0)}
            </Text>
          </View>
          {today ? (
            <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>
              H {Math.round(today.tempMax)}° · L {Math.round(today.tempMin)}° ·{' '}
              {today.rainChance}% rain
            </Text>
          ) : null}
        </View>
        {offline ? (
          <Pressable onPress={refresh} hitSlop={8} style={{ alignItems: 'center' }}>
            <MaterialIcons name="cloud-off" size={16} color={colors.onSurfaceVariant} />
            <Text style={{ fontSize: 9, color: colors.onSurfaceVariant }}>Offline</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingTop: 14 }}
      >
        {weather.daily.slice(0, 7).map((d) => (
          <View
            key={d.date}
            style={{
              alignItems: 'center',
              gap: 3,
              minWidth: 52,
              paddingVertical: 8,
              paddingHorizontal: 4,
              borderRadius: 12,
              backgroundColor: withAlpha(colors.surface, 0.7),
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: '700', color: colors.onSurfaceVariant }}>
              {dayLabel(d.date)}
            </Text>
            <MaterialIcons name={weatherIcon(d.code)} size={18} color={weatherTint(d.code)} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.onSurface }}>
              {Math.round(d.tempMax)}°
            </Text>
            <Text style={{ fontSize: 9, color: colors.onSurfaceVariant }}>{d.rainChance}%</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * The forecast for one stop on its planned date, as a pill. Renders nothing when
 * the date is beyond the 16-day horizon — most trips are planned before then.
 */
export function StopWeatherPill({
  destinationId,
  date,
}: {
  destinationId: number;
  date: string;
}) {
  const { colors } = useTheme();
  const day = useForecastFor(destinationId, date);
  if (!day) return null;

  const wet = isWashout(day.code, day.rainChance);
  const tint = wet ? colors.error : weatherTint(day.code);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderRadius: 50,
        backgroundColor: withAlpha(tint, 0.14),
        paddingHorizontal: 10,
        paddingVertical: 6,
      }}
    >
      <MaterialIcons name={weatherIcon(day.code)} size={14} color={tint} />
      <Text style={{ fontSize: 12, fontWeight: wet ? '700' : '400', color: colors.onSurface }}>
        {Math.round(day.tempMax)}°
        {day.rainChance >= 30 ? ` · ${day.rainChance}%` : ''}
      </Text>
    </View>
  );
}

/**
 * A rain warning for a whole plan, shown only when a stop's own day looks wet —
 * the point is to prompt a reschedule while that is still possible.
 */
export function PlanWeatherBanner({
  stops,
}: {
  stops: { destinationId: number; date: string }[];
}) {
  const { colors } = useTheme();
  const { byDestination } = useWeather();

  const wet = stops.filter((s) => {
    const day = byDestination[s.destinationId]?.daily.find((d) => d.date === s.date);
    return day ? isWashout(day.code, day.rainChance) : false;
  });
  if (wet.length === 0) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 10,
        padding: 12,
        borderRadius: 14,
        backgroundColor: withAlpha(colors.error, 0.1),
        borderWidth: 1,
        borderColor: withAlpha(colors.error, 0.35),
      }}
    >
      <MaterialIcons name="umbrella" size={18} color={colors.error} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.onSurface }}>
          Rain expected on {wet.length} {wet.length === 1 ? 'stop' : 'stops'}
        </Text>
        <Text style={{ fontSize: 11, color: colors.onSurfaceVariant }}>
          Waterfalls and cliff jumps are worst in heavy rain — consider moving these.
        </Text>
      </View>
    </View>
  );
}
