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
export function Avatar({ name = '', size = 46, style }) {
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
    <View style={{ backgroundColor: T.navy, paddingTop: insets.top + 10, paddingHorizontal: T.pad, paddingBottom: 34 }}>
      <View style={s.brandRow}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} hitSlop={12} style={s.backBtn} accessibilityLabel={t('common.back')}>
            <Icon name="chevron-left" size={26} color={T.onNavy} />
          </TouchableOpacity>
        ) : <Text style={s.brand}>{t('common.appName')}</Text>}
        {avatarName !== undefined && (
          <TouchableOpacity onPress={onAvatarPress} disabled={!onAvatarPress} activeOpacity={0.8}>
            <Avatar name={avatarName} size={44} style={{ backgroundColor: '#E9ECF2' }} />
          </TouchableOpacity>
        )}
      </View>
      {!!title && (
        <View style={[s.titleRow, compact && { marginTop: 10 }]}>
          <View style={{ flex: 1, paddingRight: right ? 12 : 0 }}>
            <Text style={[s.title, compact && { fontSize: 30 }]} numberOfLines={2} adjustsFontSizeToFit>{title}</Text>
            {!!subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
          </View>
          {right}
        </View>
      )}
      {children ? <View style={{ marginTop: 16 }}>{children}</View> : null}
    </View>
  );
}

/**
 * A whole screen: navy header, then the white sheet with rounded top corners that scrolls.
 * Pass `scroll={false}` to lay out the sheet yourself.
 */
export function Screen({ header, children, refreshing, onRefresh, scroll = true, footer, keyboard }) {
  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: T.pad, paddingTop: 26, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={T.navy} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : <View style={{ flex: 1 }}>{children}</View>;
  const content = (
    <View style={{ flex: 1, backgroundColor: T.navy }}>
      <StatusBar barStyle="light-content" backgroundColor={T.navy} />
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

/** A month (from monthWeeks) on the navy header, with a weekday row, dots and the selected day in yellow. */
export function MonthGrid({ weeks, selected, dots = {}, onPress }) {
  const { t } = useLang();
  const today = istToday();
  const labels = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']; // a Monday-Sunday week, for the names
  return (
    <View>
      <View style={s.monthHead}>{labels.map((d, i) => <Text key={d} style={[s.monthHeadText, i > 0 && s.weekSep]}>{weekdayShort(t, d)}</Text>)}</View>
      {weeks.map((w, wi) => (
        <View key={wi} style={s.monthRow}>
          {w.map((d, i) => (
            <TouchableOpacity key={d || `e${wi}${i}`} disabled={!d || !onPress} onPress={() => onPress?.(d)} activeOpacity={0.8}
              style={[s.monthCell, i > 0 && s.weekSep, d && d === selected && { backgroundColor: T.yellow, borderRadius: 12 }, d && d !== selected && d === today && s.todayOutline]}>
              {d ? <Text style={[s.monthNum, d === selected && { color: T.onYellow }]}>{Number(d.slice(8, 10))}</Text> : null}
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
    primary: { bg: T.navy, fg: T.onNavy, border: T.navy },
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
          {icon ? <Icon name={icon} size={small ? 20 : 22} color={v.fg} style={{ marginRight: 8 }} /> : null}
          <Text style={[s.btnText, small && { fontSize: 17 }, { color: v.fg }]} numberOfLines={1} adjustsFontSizeToFit>{title}</Text>
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
          {it.icon ? <View style={[s.statIcon, { backgroundColor: it.tint || T.surface }]}><Icon name={it.icon} size={22} color={it.color || T.textMuted} /></View> : null}
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
      {left ? <View style={{ marginRight: 16 }}>{left}</View> : null}
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={s.rowSub} numberOfLines={2}>{subtitle}</Text>}
        {below}
      </View>
      {right ? <View style={{ marginLeft: 10 }}>{right}</View> : null}
      {onPress ? <Icon name="chevron-right" size={24} color={T.navyDeep} style={{ marginLeft: 10 }} /> : null}
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
        <Icon name="calendar" size={22} color={T.navyDeep} />
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
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  brand: { color: T.onNavy, fontSize: 30, fontWeight: '600', letterSpacing: 0.3 },
  backBtn: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  title: { color: T.onNavy, fontSize: 40, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: T.onNavyMuted, fontSize: 18, marginTop: 4 },
  sheet: { flex: 1, backgroundColor: T.bg, borderTopLeftRadius: T.sheetRadius, borderTopRightRadius: T.sheetRadius, marginTop: -22, overflow: 'hidden' },

  segWrap: { flexDirection: 'row', alignSelf: 'flex-start', borderRadius: 14, borderWidth: 1, borderColor: T.onNavyLine, backgroundColor: T.onNavyGlass, padding: 3 },
  segItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 22, borderRadius: 11 },
  segOn: { backgroundColor: T.onNavyGlassStrong },
  segText: { color: T.onNavyMuted, fontSize: 17, fontWeight: '600' },
  segBadge: { marginLeft: 8, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  segBadgeText: { color: T.navy, fontSize: 13, fontWeight: '700' },
  viewToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 22, borderWidth: 1, borderColor: T.onNavyLine, backgroundColor: T.onNavyGlass, paddingVertical: 10, paddingHorizontal: 16 },
  viewToggleText: { color: T.onNavy, fontSize: 15, fontWeight: '600', maxWidth: 110 },

  weekRow: { flexDirection: 'row' },
  weekCell: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  weekSep: { borderLeftWidth: 1, borderLeftColor: T.onNavyLine },
  weekDay: { color: T.onNavyMuted, fontSize: 14, fontWeight: '500' },
  weekNum: { color: T.onNavy, fontSize: 24, fontWeight: '700', marginTop: 6 },
  todayOutline: { borderWidth: 1.5, borderColor: T.onNavy, borderRadius: 12 },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 5 },
  monthHead: { flexDirection: 'row', marginBottom: 4 },
  monthHeadText: { flex: 1, textAlign: 'center', color: T.onNavyMuted, fontSize: 14, fontWeight: '500', paddingVertical: 4 },
  monthRow: { flexDirection: 'row' },
  monthCell: { flex: 1, alignItems: 'center', paddingVertical: 8, minHeight: 50 },
  monthNum: { color: T.onNavy, fontSize: 20, fontWeight: '700' },

  chip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 7, paddingHorizontal: 14, borderRadius: 20 },
  chipText: { fontSize: 15, fontWeight: '600' },

  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: T.radius, borderWidth: 1.5, paddingVertical: 17, paddingHorizontal: 20 },
  btnSmall: { borderRadius: 30, paddingVertical: 11, paddingHorizontal: 18 },
  btnText: { fontSize: 19, fontWeight: '700' },

  statRow: { flexDirection: 'row', paddingVertical: 8 },
  statItem: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  statSep: { borderLeftWidth: 1, borderLeftColor: T.line },
  statIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 32, fontWeight: '800', color: T.navyDeep, marginTop: 2 },
  statLabel: { fontSize: 15, color: T.textMuted, textAlign: 'center' },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: T.line },
  rowTitle: { fontSize: 19, fontWeight: '700', color: T.navyDeep },
  rowSub: { fontSize: 16, color: T.textMuted, marginTop: 3 },
  info: { flexDirection: 'row', paddingVertical: 16 },
  infoLabel: { flex: 1, fontSize: 17, color: T.textMuted },
  infoValue: { flex: 1.3, fontSize: 17, color: T.navyDeep, fontWeight: '500' },

  fieldLabel: { fontSize: 16, fontWeight: '600', color: T.textMuted, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: T.line, borderRadius: T.radius, paddingHorizontal: 16, paddingVertical: 14, fontSize: 17, color: T.text, backgroundColor: T.bg },
  dateBox: { flex: 1, borderWidth: 1, borderColor: T.line, borderRadius: T.radius, paddingVertical: 14, paddingHorizontal: 16 },
  dateBoxLabel: { fontSize: 15, color: T.textMuted },
  dateBoxValue: { fontSize: 17, color: T.navyDeep, fontWeight: '600', marginLeft: 12, flexShrink: 1 },
  choiceRow: { flexDirection: 'row', gap: 10 },
  choice: { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: T.radius, borderWidth: 1, borderColor: T.line, backgroundColor: T.surface },
  choiceOn: { backgroundColor: T.yellow, borderColor: T.yellow },
  choiceText: { fontSize: 17, color: T.textMuted, fontWeight: '500' },

  sectionTitle: { fontSize: 22, fontWeight: '800', color: T.navyDeep },
  subtle: { fontSize: 15, color: T.textMuted },
  empty: { fontSize: 16, color: T.textMuted, marginVertical: 18, lineHeight: 22 },
  card: { borderWidth: 1, borderColor: T.line, borderRadius: T.radiusLg, padding: 18, backgroundColor: T.bg },
});
