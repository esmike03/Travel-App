// A shareable receipt for a plan's budget: every expense as a line item, then
// what each named traveller owes once the shared lines are split.
//
// It is deliberately available at any point in a trip — a receipt for a plan
// still being filled in is how a group agrees what they are about to spend, not
// only how they settle up afterwards. The header says which of the two it is.
//
// Captured with react-native-view-shot at a fixed pixel width and handed to the
// OS share sheet, exactly like ShareCard.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
// The legacy entry point on purpose. In SDK 57 the package's main export
// became the new Asset/Query API, whose module body eagerly requires the
// `ExpoMediaLibraryNext` native module — which Expo Go does not carry, so a
// bare `from 'expo-media-library'` crashes the app on load. Everything used
// here (permissions + saveToLibraryAsync) is the legacy API anyway.
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import { BudgetItem, PlanMeta, budgetSplit, budgetSpent, tripTitle } from '../context/PlansContext';
import { showToast } from '../utils/toast';

// Authored at these exact pixels and only scaled down for the preview, so the
// captured PNG is native resolution rather than an upscaled screenshot.
const RECEIPT_W = 720;
// No backdrop: the slip is the whole image. The only padding is room for the
// paper's shadow to fall into, and it is transparent like everything else
// around the paper.
//
// The notches are therefore transparent in the exported PNG. Apps that honour
// alpha show the tear over whatever is behind it; ones that flatten it will
// fill the bites with their own background colour.
const SHEET_PAD = 18;
const PAPER_W = RECEIPT_W - SHEET_PAD * 2;
// Plain white, not the cream a till slip actually is: the app's light theme
// background is #FAF8F2, and cream paper on it was the same colour to within a
// point on every channel, so the receipt disappeared into the page.
const PAPER = '#FFFFFF';
// The torn contour, drawn on the paper itself. Close to the paper — it should
// read as the shaded lip of a tear, not an outline around a sticker.
const TEAR_EDGE = '#BFBAB2';
const INK = '#171717';
const FADED = '#6B6B6B';
// Receipts read as receipts largely because of the monospace; the families
// differ by platform, so both are named and RN falls back to the first present.
const MONO = 'monospace';

// Depth of the tear, and how far apart its direction changes. Real torn paper
// has no period at all, so both the spacing and the depth of every point are
// jittered — an even sawtooth reads as a decorative border, not a tear.
const TEAR_H = 17;
const TEAR_STEP_MIN = 7;
const TEAR_STEP_VAR = 15;

/**
 * mulberry32 — a tiny seeded PRNG.
 *
 * Seeded, not Math.random: the tear has to be stable across re-renders, or the
 * edge reshuffles itself on every keystroke in the budget behind it (and the
 * preview would not match the captured PNG).
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/**
 * An irregular tear across `width`, as an SVG path.
 *
 * The jagged line is the paper's outer boundary; the shape is closed along the
 * side that meets the body, so the bites come out of the outer edge rather than
 * being sealed inside the sheet.
 */
function tearPaths(
  width: number,
  height: number,
  seed: number,
  teethPointUp: boolean
): { paper: string; edge: string } {
  const rnd = mulberry32(seed);
  const points: string[] = [];
  let x = 0;
  while (x < width) {
    // Depth never reaches 0 or the full height: a tear that touches the flat
    // edge would nick a hole through the paper, and one that runs the whole
    // depth leaves a spike.
    points.push(`${x.toFixed(1)},${(height * (0.15 + rnd() * 0.7)).toFixed(1)}`);
    x = Math.min(width, x + TEAR_STEP_MIN + rnd() * TEAR_STEP_VAR);
  }
  points.push(`${width},${(height * (0.15 + rnd() * 0.7)).toFixed(1)}`);

  // The flat side is the one the paper continues on.
  const flat = teethPointUp ? height : 0;
  return {
    paper: `M0,${flat}L${points.join('L')}L${width},${flat}Z`,
    // Just the jagged run, left open. Stroking the closed shape instead would
    // draw a line across the paper where the strip meets the body.
    edge: `M${points.join('L')}`,
  };
}

/** A torn edge. The jagged side faces away from the body: up for the top edge. */
function TornEdge({ seed, teethPointUp }: { seed: number; teethPointUp: boolean }) {
  const { paper, edge } = useMemo(
    () => tearPaths(PAPER_W, TEAR_H, seed, teethPointUp),
    [seed, teethPointUp]
  );
  return (
    <Svg width={PAPER_W} height={TEAR_H} viewBox={`0 0 ${PAPER_W} ${TEAR_H}`}>
      <Path d={paper} fill={PAPER} />
      {/* The torn contour, inked onto the paper. Without a backdrop behind the
          notches there is nothing to silhouette the tear against, so the edge
          has to draw itself — this is what keeps the effect once the receipt is
          on a surface its own colour. */}
      <Path
        d={edge}
        fill="none"
        stroke={TEAR_EDGE}
        strokeWidth={2.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function formatPeso(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? '-' : '';
  return `${sign}₱${Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function receiptDate(): string {
  return new Date().toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** A dashed rule, the way a till receipt separates its blocks. */
function Rule() {
  return <Text style={styles.rule}>{'- '.repeat(34)}</Text>;
}

function Line({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  const weight = bold ? ('700' as const) : ('400' as const);
  const color = muted ? FADED : INK;
  return (
    <View style={styles.line}>
      <Text numberOfLines={1} style={[styles.lineLabel, { fontWeight: weight, color }]}>
        {label}
      </Text>
      <Text style={[styles.lineValue, { fontWeight: weight, color }]}>{value}</Text>
    </View>
  );
}

export function BudgetReceiptView({
  meta,
  items,
  planLabel,
  complete,
}: {
  meta: PlanMeta;
  items: BudgetItem[];
  planLabel: string;
  /** Every stop visited — decides whether this is a final or a running total. */
  complete: boolean;
}) {
  const effective = useMemo<PlanMeta>(() => ({ ...meta, items }), [meta, items]);
  const spent = budgetSpent(effective);
  const split = budgetSplit(effective);
  const target = meta.targetBudget;
  const remaining = target != null ? target - spent : null;
  // Seeded off the plan, so one trip's receipt always tears the same way and
  // two different trips don't come out identical. The two edges are offset from
  // each other or the slip looks machine-cut, top matching bottom exactly.
  const seed = useMemo(() => hashString(`${planLabel}|${tripTitle(meta)}`), [planLabel, meta]);

  return (
    <View style={styles.sheet}>
      <View style={styles.receipt}>
        <TornEdge seed={seed} teethPointUp />

        <View style={styles.body}>
          <Text style={styles.brand}>C H I R P Y</Text>
          <Text style={styles.brandSub}>BOHOL TRAVEL COMPANION</Text>

          <Rule />

          <Text style={styles.title} numberOfLines={2}>
            {tripTitle(meta)}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {planLabel}
          </Text>
          {/* A receipt for a trip still running is a quote, not a bill — say which
            so nobody reads a running total as the final word. */}
          <Text style={styles.status}>
            {complete ? 'FINAL TOTAL' : 'RUNNING TOTAL · TRIP IN PROGRESS'}
          </Text>

          <Rule />

          {items.length === 0 ? (
            <Text style={styles.empty}>No expenses recorded</Text>
          ) : (
            items.map((item) => (
              <Line
                key={item.id}
                label={`${item.label.trim() || 'Expense'}${item.shared ? '  (split)' : ''}`}
                value={formatPeso(item.amount)}
              />
            ))
          )}

          <Rule />

          <Line label="TOTAL" value={formatPeso(spent)} bold />
          {target != null ? (
            <>
              <Line label="Budget" value={formatPeso(target)} muted />
              <Line
                label={remaining != null && remaining < 0 ? 'Over by' : 'Left'}
                value={formatPeso(Math.abs(remaining ?? 0))}
                muted
              />
            </>
          ) : null}

          {/* Only when the costs are actually being split. On a solo trip the
            "split" is just the total again, which reads as a mistake. */}
          {split.length > 1 ? (
            <>
              <Rule />
              <Text style={styles.sectionLabel}>SPLIT BETWEEN {split.length} PEOPLE</Text>
              {split.map((share, i) => (
                <Line
                  key={`${share.name}-${i}`}
                  label={share.name}
                  value={formatPeso(share.amount)}
                />
              ))}
            </>
          ) : null}

          <Rule />

          <Text style={styles.footer}>{receiptDate()}</Text>
          <Text style={styles.footerThanks}>SALAMAT · SAFE TRAVELS</Text>
        </View>

        <TornEdge seed={seed ^ 0x9e3779b9} teethPointUp={false} />
      </View>
    </View>
  );
}

/** Full-screen sheet: preview the receipt, then share or save it. */
export default function BudgetReceiptModal({
  meta,
  items,
  planLabel,
  complete,
  onClose,
}: {
  meta: PlanMeta;
  items: BudgetItem[];
  planLabel: string;
  complete: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const shotRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const [receiptHeight, setReceiptHeight] = useState(0);

  // A Modal would have handled Back for us; as a plain layer it has to, or Back
  // would close the whole plan sheet out from under the receipt.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  // The receipt's height depends on how many lines it has, so it is measured
  // rather than fixed; the preview box reserves the scaled result.
  const previewW = Math.min(screenW - 40, 360);
  const scale = previewW / RECEIPT_W;

  const capture = async (): Promise<string> =>
    captureRef(shotRef, { format: 'png', quality: 1, result: 'tmpfile' });

  const onShare = async () => {
    setBusy(true);
    try {
      const uri = await capture();
      if (!(await Sharing.isAvailableAsync())) {
        showToast('Sharing is not available on this device');
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: `${tripTitle(meta)} receipt · Chirpy`,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn('[BudgetReceipt] share failed:', e);
      showToast(`Couldn't share: ${message}`);
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    setBusy(true);
    try {
      let perm = await MediaLibrary.getPermissionsAsync(true);
      if (!perm.granted && perm.canAskAgain)
        perm = await MediaLibrary.requestPermissionsAsync(true);
      if (!perm.granted) {
        showToast(
          perm.canAskAgain
            ? 'Photo access is needed to save the receipt'
            : 'Photo access is blocked — enable it for Expo Go in Settings'
        );
        return;
      }
      const uri = await capture();
      await MediaLibrary.saveToLibraryAsync(uri);
      showToast('Saved to your photos');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn('[BudgetReceipt] save failed:', e);
      showToast(`Couldn't save: ${message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    // An absolutely-positioned layer, not a Modal: this opens from inside the
    // plan sheet, which is already a Modal, and a Modal inside a Modal renders
    // blank on Android. The caller's screen is flex:1, so this fills it.
    <View style={[StyleSheet.absoluteFill, { zIndex: 10, elevation: 10 }]}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[styles.sheetHeader, { paddingTop: Math.max(insets.top, 12) + 6 }]}>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: withAlpha(colors.surfaceVariant, pressed ? 0.9 : 0.55),
              },
            ]}
          >
            <MaterialIcons name="close" size={20} color={colors.onSurface} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sheetTitle, { color: colors.onSurface }]}>Share the receipt</Text>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 12,
                color: colors.onSurfaceVariant,
                marginTop: 1,
              }}
            >
              {complete ? 'Final total' : 'Running total — the trip is still on'}
            </Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 28,
            alignItems: 'center',
          }}
        >
          {/* The captured view keeps its full 720px layout and is only visually
              scaled — captureRef snapshots the view's own layout box, so giving
              it the preview's width would clip the receipt to a narrow slice.
              A transform does not affect layout, so the box that reserves room
              for it has to be sized from the measured height. Until that first
              measurement lands the height is left unset rather than 0: a 0-high
              box clips the receipt away entirely on Android, and if the measure
              is ever missed the result is a blank sheet with nothing on it. */}
          <View
            style={[{ width: previewW }, receiptHeight > 0 && { height: receiptHeight * scale }]}
          >
            <View
              ref={shotRef}
              collapsable={false}
              onLayout={(e) => setReceiptHeight(e.nativeEvent.layout.height)}
              style={{
                width: RECEIPT_W,
                transform: [{ scale }],
                transformOrigin: 'top left',
              }}
            >
              <BudgetReceiptView
                meta={meta}
                items={items}
                planLabel={planLabel}
                complete={complete}
              />
            </View>
          </View>
        </ScrollView>

        <View
          style={[
            styles.actionBar,
            {
              paddingBottom: Math.max(insets.bottom, 12),
              borderTopColor: withAlpha(colors.outlineVariant, 0.7),
              backgroundColor: colors.background,
            },
          ]}
        >
          <Pressable
            disabled={busy}
            onPress={onSave}
            style={({ pressed }) => [
              styles.actionButton,
              {
                flex: 1,
                borderWidth: 1,
                borderColor: withAlpha(colors.outlineVariant, 0.9),
                opacity: busy ? 0.5 : pressed ? 0.8 : 1,
              },
            ]}
          >
            <MaterialIcons name="download" size={18} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Save</Text>
          </Pressable>
          <Pressable
            disabled={busy}
            onPress={onShare}
            style={({ pressed }) => [
              styles.actionButton,
              {
                flex: 2,
                backgroundColor: colors.primary,
                opacity: busy ? 0.5 : pressed ? 0.88 : 1,
              },
            ]}
          >
            {busy ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <>
                <MaterialIcons name="share" size={18} color={colors.onPrimary} />
                <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>Share</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// Receipt styles are authored at export pixels (720 wide); the sheet styles
// below them are ordinary screen points.
const styles = StyleSheet.create({
  // What the notches show through to, and what gets captured.
  sheet: {
    width: RECEIPT_W,
    // Transparent on purpose — see SHEET_PAD.
    padding: SHEET_PAD,
  },
  receipt: {
    width: PAPER_W,
    // No background of its own: the torn edges are the paper's real outline, so
    // a rectangle here would fill the notches back in.
    alignItems: 'stretch',
  },
  body: {
    backgroundColor: PAPER,
    paddingHorizontal: 52,
    paddingTop: 18,
    paddingBottom: 22,
  },
  brand: {
    fontFamily: MONO,
    fontSize: 34,
    fontWeight: '700',
    color: INK,
    textAlign: 'center',
    letterSpacing: 2,
  },
  brandSub: {
    fontFamily: MONO,
    fontSize: 15,
    color: FADED,
    textAlign: 'center',
    letterSpacing: 3,
    marginTop: 4,
  },
  rule: {
    fontFamily: MONO,
    fontSize: 15,
    color: FADED,
    marginVertical: 12,
  },
  title: {
    fontFamily: MONO,
    fontSize: 27,
    fontWeight: '700',
    color: INK,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: MONO,
    fontSize: 17,
    color: FADED,
    textAlign: 'center',
    marginTop: 4,
  },
  status: {
    fontFamily: MONO,
    fontSize: 15,
    fontWeight: '700',
    color: INK,
    textAlign: 'center',
    letterSpacing: 1.5,
    marginTop: 10,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    paddingVertical: 4,
  },
  lineLabel: { flex: 1, fontFamily: MONO, fontSize: 19 },
  lineValue: { fontFamily: MONO, fontSize: 19 },
  sectionLabel: {
    fontFamily: MONO,
    fontSize: 15,
    fontWeight: '700',
    color: FADED,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  empty: {
    fontFamily: MONO,
    fontSize: 18,
    color: FADED,
    textAlign: 'center',
    paddingVertical: 8,
  },
  footer: {
    fontFamily: MONO,
    fontSize: 16,
    color: FADED,
    textAlign: 'center',
  },
  footerThanks: {
    fontFamily: MONO,
    fontSize: 17,
    fontWeight: '700',
    color: INK,
    textAlign: 'center',
    letterSpacing: 2,
    marginTop: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  sheetTitle: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 52,
    borderRadius: 16,
  },
});
