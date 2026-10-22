// Haazri UI kit: the building blocks every screen uses, matching the design (navy header, white sheet, yellow
// highlight). Screens should use these rather than their own colours so the app stays consistent.
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, TextInput, ActivityIndicator, StatusBar,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, AVATAR_TINTS } from './tokens';
import { weekdayShort, useLang } from '../i18n';
import { istToday } from './dates';

export { T, AVATAR_TINTS, STATUS_COLOR } from './tokens';
export * from './dates';

/** A line icon (Feather set: calendar, file-text, users, user, check, x, clock, search, plus, chevron-right…). */
export const Icon = ({ name, size = 22, color = T.text, style }) => <Feather name={name} size={size} color={color} style={style} />;

/** Initials in a soft coloured circle. */
export function Avatar({ name = '', size = 40, style }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: AVATAR_TINTS[h % AVATAR_TINTS.length], alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize: size * 0.36, fontWeight: '700', color: T.navyDeep }}>{initials}</Text>
    </View>
  );
}

/**
 * The navy top of a screen: "haazri" with the user's avatar, a big title and subtitle, an optional button on the
 * right of the title, and optional content below (segmented control, week strip, calendar).
 */
export function AppHeader({ title, subtitle, right, children, avatarName, onAvatarPress, onBack, compact }) {
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: T.page, paddingTop: insets.top + 6, paddingHorizontal: T.pad, paddingBottom: 30 }}>
      <View style={s.brandRow}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} hitSlop={12} style={s.backBtn} accessibilityLabel={t('common.back')}>
            <Icon name="chevron-left" size={26} color={T.onNavy} />
          </TouchableOpacity>
        ) : <Text style={s.brand}>{t('common.appName')}</Text>}
        {avatarName !== undefined && (
          <TouchableOpacity onPress={onAvatarPress} disabled={!onAvatarPress} activeOpacity={0.8}>
            <Avatar name={avatarName} size={36} style={{ backgroundColor: T.white, borderWidth: 1, borderColor: T.glassBorder, ...T.shadow }} />
          </TouchableOpacity>
        )}
      </View>
      {!!title && (
        <View style={[s.titleRow, compact && { marginTop: 10 }]}>
          <View style={{ flex: 1, paddingRight: right ? 12 : 0 }}>
            <Text style={[s.title, { fontSize: titleSize(title, !!right, compact) }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{title}</Text>
            {!!subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
          </View>
          {right}
        </View>
      )}
      {children ? <View style={{ marginTop: 12 }}>{children}</View> : null}
    </View>
  );
}

// Big titles shrink to fit on one line next to a header button ("October 2026" + "Month view").
function titleSize(title, withButton, compact) {
  const max = compact ? 24 : 28;
  if (!withButton) return max;
  return Math.max(19, Math.min(max, Math.floor(200 / (Math.max(1, String(title).length) * 0.58))));
}

/**
 * A whole screen: navy header, then the white sheet with rounded top corners that scrolls.
 * Pass `scroll={false}` to lay out the sheet yourself.
 */
export function Screen({ header, children, refreshing, onRefresh, scroll = true, footer, keyboard }) {
  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: T.pad, paddingTop: 20, paddingBottom: 120 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={T.navy} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : <View style={{ flex: 1 }}>{children}</View>;
  const content = (
    <View style={{ flex: 1, backgroundColor: T.page }}>
      <StatusBar barStyle="dark-content" backgroundColor={T.page} />
      {header}
      <View style={s.sheet}>
        {body}
        {footer}
      </View>
    </View>
  );
  return keyboard
    ? <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{content}</KeyboardAvoidingView>
    : content;
}

/** Two or more options in a pill on the navy header ("My day | Team", "To review 1 | My leave"). */
export function Segmented({ options, value, onChange, style }) {
  return (
    <View style={[s.segWrap, style]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <TouchableOpacity key={o.value} onPress={() => onChange(o.value)} activeOpacity={0.8} style={[s.segItem, on && s.segOn]}>
            <Text style={[s.segText, on && { color: T.onNavy }]} numberOfLines={1}>{o.label}</Text>
            {o.badge ? <View style={s.segBadge}><Text style={s.segBadgeText}>{o.badge}</Text></View> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** "Month view ⌄" pill on the header. */
export function ViewToggle({ label, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={s.viewToggle}>
      <Icon name="calendar" size={18} color={T.onNavy} />
      <Text style={s.viewToggleText} numberOfLines={1}>{label}</Text>
      <Icon name="chevron-down" size={16} color={T.onNavy} />
    </TouchableOpacity>
  );
}

/**
 * One week (7 dates) on the navy header: weekday above, day number below. `selected` dates are yellow (next to each
 * other they join into one block); `dots` maps a date to a dot colour; today is outlined.
 */
export function WeekStrip({ dates, selected = [], dots = {}, onPress, disabled }) {
  const { t } = useLang();
  const today = istToday();
  const sel = new Set(selected);
  return (
    <View style={s.weekRow}>
      {dates.map((d, i) => {
        const on = sel.has(d);
        const prevOn = on && sel.has(dates[i - 1]);
        const nextOn = on && sel.has(dates[i + 1]);
        return (
          <TouchableOpacity key={d} disabled={disabled || !onPress} onPress={() => onPress?.(d)} activeOpacity={0.8}
            style={[s.weekCell, i > 0 && !on && !sel.has(dates[i - 1]) && s.weekSep,
              on && { backgroundColor: T.yellow, borderTopLeftRadius: prevOn ? 0 : 12, borderBottomLeftRadius: prevOn ? 0 : 12, borderTopRightRadius: nextOn ? 0 : 12, borderBottomRightRadius: nextOn ? 0 : 12 },
              !on && d === today && s.todayOutline]}>
            <Text style={[s.weekDay, on && { color: T.onYellow }]} numberOfLines={1}>{weekdayShort(t, d)}</Text>
            <Text style={[s.weekNum, on && { color: T.onYellow }]}>{Number(d.slice(8, 10))}</Text>
            <View style={[s.dot, { backgroundColor: dots[d] || 'transparent' }]} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * A month (from monthWeeks) on the navy header, with a weekday row, dots and the selected day(s) in yellow
 * (`selected` is one date or an array; neighbouring selected days join like WeekStrip).
 */
export function MonthGrid({ weeks, selected, dots = {}, onPress }) {
  const { t } = useLang();
  const today = istToday();
  const sel = new Set(Array.isArray(selected) ? selected : selected ? [selected] : []);
  const labels = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']; // a Monday-Sunday week, for the names
  return (
    <View>
      <View style={s.monthHead}>{labels.map((d, i) => <Text key={d} style={[s.monthHeadText, i > 0 && s.weekSep]}>{weekdayShort(t, d)}</Text>)}</View>
      {weeks.map((w, wi) => (
        <View key={wi} style={s.monthRow}>
          {w.map((d, i) => (
            <TouchableOpacity key={d || `e${wi}${i}`} disabled={!d || !onPress} onPress={() => onPress?.(d)} activeOpacity={0.8}
              style={[s.monthCell, i > 0 && s.weekSep,
                d && sel.has(d) && { backgroundColor: T.yellow,
                  borderTopLeftRadius: sel.has(w[i - 1]) ? 0 : 12, borderBottomLeftRadius: sel.has(w[i - 1]) ? 0 : 12,
                  borderTopRightRadius: sel.has(w[i + 1]) ? 0 : 12, borderBottomRightRadius: sel.has(w[i + 1]) ? 0 : 12 },
                d && !sel.has(d) && d === today && s.todayOutline]}>
              {d ? <Text style={[s.monthNum, sel.has(d) && { color: T.onYellow }]}>{Number(d.slice(8, 10))}</Text> : null}
              <View style={[s.dot, { backgroundColor: (d && dots[d]) || 'transparent' }]} />
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Small rounded label: role ("Staff" grey, "Admin" yellow) or status. */
export function Chip({ label, tone = 'grey', icon, style }) {
  const tones = {
    grey: [T.surface, T.textMuted], yellow: [T.yellowSoft, T.onYellow], green: [T.greenSoft, T.green],
    amber: [T.amberSoft, '#9A6B00'], red: [T.redSoft, T.red], blue: [T.blueSoft, '#2B7DA6'],
  };
  const [bg, fg] = tones[tone] || tones.grey;
  return (
    <View style={[s.chip, { backgroundColor: bg }, style]}>
      {icon ? <Icon name={icon} size={16} color={fg} style={{ marginRight: 6 }} /> : null}
      <Text style={[s.chipText, { color: fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/**
 * Buttons. variant: 'primary' (navy), 'accent' (yellow, e.g. "+ Add"), 'outline', 'danger' (red outline),
 * 'success' (green). `small` for header pills.
 */
export function Button({ title, onPress, variant = 'primary', icon, busy, disabled, small, style }) {
  const v = {
    primary: { bg: T.navy, fg: T.white, border: T.navy },
    accent: { bg: T.yellow, fg: T.onYellow, border: T.yellow },
    outline: { bg: T.bg, fg: T.navyDeep, border: T.line },
    danger: { bg: T.bg, fg: T.red, border: T.red },
    success: { bg: T.green, fg: '#fff', border: T.green },
  }[variant];
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled || busy} activeOpacity={0.85}
      style={[s.btn, small && s.btnSmall, { backgroundColor: v.bg, borderColor: v.border, opacity: disabled ? 0.5 : 1 }, style]}>
      {busy ? <ActivityIndicator color={v.fg} /> : (
        <>
          {icon ? <Icon name={icon} size={small ? 17 : 19} color={v.fg} style={{ marginRight: 7 }} /> : null}
          <Text style={[s.btnText, small && { fontSize: 15 }, { color: v.fg }]} numberOfLines={1} adjustsFontSizeToFit>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

/** Numbers side by side ("5 Checked in | 2 Late | 1 Not checked in"), each with an optional round icon. */
export function StatRow({ items, style }) {
  return (
    <View style={[s.statRow, style]}>
      {items.map((it, i) => (
        <View key={it.label} style={[s.statItem, i > 0 && s.statSep]}>
          {it.icon ? <View style={[s.statIcon, { backgroundColor: it.tint || T.surface }]}><Icon name={it.icon} size={19} color={it.color || T.textMuted} /></View> : null}
          {it.icon ? <Text style={s.statLabel} numberOfLines={2}>{it.label}</Text> : null}
          <Text style={[s.statValue, it.valueColor && { color: it.valueColor }]}>{it.value}</Text>
          {!it.icon ? <Text style={s.statLabel} numberOfLines={2}>{it.label}</Text> : null}
        </View>
      ))}
    </View>
  );
}

/** A row in a list: avatar or icon, title and subtitle, something on the right, chevron when tappable. */
export function ListRow({ title, subtitle, left, right, below, onPress, last }) {
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap onPress={onPress} activeOpacity={0.7} style={[s.row, !last && s.rowLine]}>
      {left ? <View style={{ marginRight: 12 }}>{left}</View> : null}
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={s.rowSub} numberOfLines={2}>{subtitle}</Text>}
        {below}
      </View>
      {right ? <View style={{ marginLeft: 10 }}>{right}</View> : null}
      {onPress ? <Icon name="chevron-right" size={20} color={T.navyDeep} style={{ marginLeft: 10 }} /> : null}
    </Wrap>
  );
}

/** Label + value rows like the leave review ("Leave type | Casual"). */
export function InfoRow({ label, value, last }) {
  return (
    <View style={[s.info, !last && s.rowLine]}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

/** A text box with a label above it. */
export function Field({ label, style, inputStyle, ...props }) {
  return (
    <View style={[{ marginBottom: 16 }, style]}>
      {!!label && <Text style={s.fieldLabel}>{label}</Text>}
      <TextInput placeholderTextColor={T.textFaint} style={[s.input, props.multiline && { minHeight: 90, textAlignVertical: 'top' }, inputStyle]} {...props} />
    </View>
  );
}

/** A tappable box showing a date ("From  📅 Mon, 12 Oct"). */
export function DateBox({ label, value, onPress, style }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[s.dateBox, style]}>
      <Text style={s.dateBoxLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
        <Icon name="calendar" size={18} color={T.navyDeep} />
        <Text style={s.dateBoxValue} numberOfLines={1}>{value}</Text>
      </View>
    </TouchableOpacity>
  );
}

/** Options shown as boxes in a row (leave type: Casual | Sick | Paid | Unpaid); the chosen one is yellow. */
export function ChoiceRow({ options, value, onChange }) {
  return (
    <View style={s.choiceRow}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <TouchableOpacity key={o.value} onPress={() => onChange(o.value)} activeOpacity={0.8} style={[s.choice, on && s.choiceOn]}>
            <Text style={[s.choiceText, on && { color: T.onYellow, fontWeight: '700' }]} numberOfLines={1} adjustsFontSizeToFit>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export const SectionTitle = ({ children, right, style }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 6 }, style]}>
    <Text style={s.sectionTitle}>{children}</Text>{right}
  </View>
);
export const Subtle = ({ children, style }) => <Text style={[s.subtle, style]}>{children}</Text>;
export const Divider = ({ style }) => <View style={[{ height: 1, backgroundColor: T.line, marginVertical: 14 }, style]} />;
export const Empty = ({ children }) => <Text style={s.empty}>{children}</Text>;
export const Loading = () => <ActivityIndicator style={{ marginTop: 40 }} color={T.navy} />;

/** A white card with a light border (used for result messages and grouped settings). */
export const Card = ({ children, style, tone }) => (
  <View style={[s.card, tone === 'green' && { borderColor: T.green, backgroundColor: T.greenSoft },
    tone === 'red' && { borderColor: T.red, backgroundColor: T.redSoft }, tone === 'yellow' && { borderColor: T.yellow, backgroundColor: T.yellowSoft }, style]}>{children}</View>
);

const s = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 38 },
  brand: { color: T.onNavy, fontSize: 24, fontWeight: '700', letterSpacing: 0.2 },
  backBtn: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  title: { color: T.onNavy, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: T.onNavyMuted, fontSize: 15, marginTop: 4 },
  sheet: { flex: 1, backgroundColor: T.bg, borderTopLeftRadius: T.sheetRadius, borderTopRightRadius: T.sheetRadius, marginTop: -18, overflow: 'hidden', borderWidth: 1, borderBottomWidth: 0, borderColor: T.glassBorder },

  segWrap: { flexDirection: 'row', alignSelf: 'flex-start', borderRadius: 14, backgroundColor: 'rgba(14,26,51,0.06)', padding: 3 },
  segItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 16, borderRadius: 10 },
  segOn: { backgroundColor: T.white, ...T.shadow },
  segText: { color: T.onNavyMuted, fontSize: 15, fontWeight: '600' },
  segBadge: { marginLeft: 8, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: T.navy, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  segBadgeText: { color: T.white, fontSize: 12, fontWeight: '700' },
  viewToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 22, borderWidth: 1, borderColor: T.glassBorder, backgroundColor: T.onNavyGlass, ...T.shadow, paddingVertical: 9, paddingHorizontal: 12 },
  viewToggleText: { color: T.onNavy, fontSize: 13, fontWeight: '600', maxWidth: 96 },

  weekRow: { flexDirection: 'row' },
  weekCell: { flex: 1, alignItems: 'center', paddingVertical: 7 },
  weekSep: { borderLeftWidth: 1, borderLeftColor: T.onNavyLine },
  weekDay: { color: T.onNavyMuted, fontSize: 13, fontWeight: '500' },
  weekNum: { color: T.onNavy, marginTop: 3, fontSize: 20, fontWeight: '700', marginTop: 6 },
  todayOutline: { borderWidth: 1.5, borderColor: T.onNavy, borderRadius: 12 },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 5 },
  monthHead: { flexDirection: 'row', marginBottom: 4 },
  monthHeadText: { flex: 1, textAlign: 'center', color: T.onNavyMuted, fontSize: 13, fontWeight: '500', paddingVertical: 4 },
  monthRow: { flexDirection: 'row' },
  monthCell: { flex: 1, alignItems: 'center', paddingVertical: 5, minHeight: 40 },
  monthNum: { color: T.onNavy, fontSize: 17, fontWeight: '700' },

  chip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 14 },
  chipText: { fontSize: 13, fontWeight: '600' },

  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1.5, paddingVertical: 13, paddingHorizontal: 18 },
  btnSmall: { borderRadius: 24, paddingVertical: 8, paddingHorizontal: 14 },
  btnText: { fontSize: 16, fontWeight: '700' },

  statRow: { flexDirection: 'row', paddingVertical: 8 },
  statItem: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  statSep: { borderLeftWidth: 1, borderLeftColor: T.line },
  statIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  statValue: { fontSize: 26, fontWeight: '800', color: T.navyDeep, marginTop: 2 },
  statLabel: { fontSize: 13, color: T.textMuted, textAlign: 'center' },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: T.line },
  rowTitle: { fontSize: 16, fontWeight: '700', color: T.navyDeep },
  rowSub: { fontSize: 14, color: T.textMuted, marginTop: 3 },
  info: { flexDirection: 'row', paddingVertical: 11 },
  infoLabel: { flex: 1, fontSize: 15, color: T.textMuted },
  infoValue: { flex: 1.3, fontSize: 15, color: T.navyDeep, fontWeight: '500' },

  fieldLabel: { fontSize: 14, fontWeight: '600', color: T.textMuted, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: T.line, borderRadius: T.radius, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: T.text, backgroundColor: T.bg },
  dateBox: { flex: 1, borderWidth: 1, borderColor: T.line, borderRadius: T.radius, paddingVertical: 10, paddingHorizontal: 12 },
  dateBoxLabel: { fontSize: 13, color: T.textMuted },
  dateBoxValue: { fontSize: 15, color: T.navyDeep, fontWeight: '600', marginLeft: 12, flexShrink: 1 },
  choiceRow: { flexDirection: 'row', gap: 10 },
  choice: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: T.radius, borderWidth: 1, borderColor: T.line, backgroundColor: T.surface },
  choiceOn: { backgroundColor: T.yellow, borderColor: T.yellow },
  choiceText: { fontSize: 15, color: T.textMuted, fontWeight: '500' },

  sectionTitle: { fontSize: 18, fontWeight: '800', color: T.navyDeep },
  subtle: { fontSize: 13, color: T.textMuted },
  empty: { fontSize: 14, color: T.textMuted, marginVertical: 18, lineHeight: 20 },
  card: { borderWidth: 1, borderColor: T.line, borderRadius: T.radiusLg, padding: 14, backgroundColor: T.bg, ...T.shadow, shadowOpacity: 0.05 },
});
