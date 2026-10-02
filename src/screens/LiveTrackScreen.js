import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions,
} from 'react-native';
import { COLORS, SHADOWS, RADIUS, SPACING, FONTS } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { useHeaderInset } from '../utils/safeArea';

const { width } = Dimensions.get('window');

const STAFF_LOCATIONS = [
  { id: '1', name: 'Rahul Sharma', dept: 'Sales', status: 'active', location: 'Sector 17, Chandigarh', lastSeen: '2 min ago', battery: 85, distance: '1.2 km from office' },
  { id: '2', name: 'Priya Verma', dept: 'Marketing', status: 'active', location: 'IT Park, Mohali', lastSeen: '5 min ago', battery: 62, distance: '4.5 km from office' },
  { id: '3', name: 'Amit Kumar', dept: 'Development', status: 'active', location: 'Office - Main Branch', lastSeen: 'Now', battery: 90, distance: 'In office' },
  { id: '4', name: 'Sunita Devi', dept: 'Support', status: 'offline', location: 'Last: Sector 22, Chandigarh', lastSeen: '1 hr ago', battery: 15, distance: '3.8 km from office' },
  { id: '5', name: 'Vikram Singh', dept: 'Sales', status: 'active', location: 'Phase 8, Mohali', lastSeen: '1 min ago', battery: 45, distance: '6.2 km from office' },
  { id: '6', name: 'Neha Gupta', dept: 'HR', status: 'active', location: 'Office - Main Branch', lastSeen: 'Now', battery: 78, distance: 'In office' },
];

const OFFICE_LOCATIONS = [
  { name: 'Main Branch', address: 'SCO 123, Sector 17, Chandigarh', staff: 4, radius: '200m' },
  { name: 'IT Park Office', address: 'IT Park, Phase 1, Mohali', staff: 2, radius: '150m' },
];

export default function LiveTrackScreen({ navigation }) {
  const { colors: C } = useTheme();
  const headerTop = useHeaderInset(12);
  const [filter, setFilter] = useState('all');

  const activeCount = STAFF_LOCATIONS.filter(s => s.status === 'active').length;
  const inOffice = STAFF_LOCATIONS.filter(s => s.distance === 'In office').length;
  const onField = activeCount - inOffice;
  const offline = STAFF_LOCATIONS.filter(s => s.status === 'offline').length;

  const filtered = filter === 'all' ? STAFF_LOCATIONS :
    filter === 'active' ? STAFF_LOCATIONS.filter(s => s.status === 'active') :
    filter === 'office' ? STAFF_LOCATIONS.filter(s => s.distance === 'In office') :
    filter === 'field' ? STAFF_LOCATIONS.filter(s => s.status === 'active' && s.distance !== 'In office') :
    STAFF_LOCATIONS.filter(s => s.status === 'offline');

  const getBatteryColor = (b) => b > 50 ? COLORS.success : b > 20 ? COLORS.warning : COLORS.danger;
  const getBatteryIcon = (b) => b > 75 ? '🔋' : b > 50 ? '🔋' : b > 20 ? '🪫' : '🪫';

  return (
    <ScrollView style={[styles.container, { backgroundColor: C.bg }]} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: headerTop, backgroundColor: C.bgCard, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: C.bgElevated }]}>
          <Text style={[styles.backIcon, { color: C.textPrimary }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Live Tracking</Text>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      {/* Map Placeholder */}
      <View style={styles.mapCard}>
        <View style={[styles.mapPlaceholder, { backgroundColor: C.bgElevated }]}>
          <Text style={styles.mapIcon}>🗺️</Text>
          <Text style={[styles.mapText, { color: C.textPrimary }]}>Live Map View</Text>
          <Text style={[styles.mapSubtext, { color: C.textMuted }]}>{activeCount} staff tracked in real-time</Text>
          <View style={styles.mapDots}>
            {STAFF_LOCATIONS.filter(s => s.status === 'active').map((s, i) => (
              <View key={s.id} style={[styles.mapDotItem, { left: 30 + (i * 50), top: 20 + (i % 3) * 30 }]}>
                <View style={[styles.mapDotPulse, { backgroundColor: s.distance === 'In office' ? COLORS.success : COLORS.accent }]} />
                <Text style={styles.mapDotLabel}>{s.name.split(' ')[0]}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: C.bgCard, borderTopColor: COLORS.success }]}>
          <Text style={[styles.statValue, { color: COLORS.success }]}>{inOffice}</Text>
          <Text style={[styles.statLabel, { color: C.textMuted }]}>In Office</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: C.bgCard, borderTopColor: COLORS.accent }]}>
          <Text style={[styles.statValue, { color: COLORS.accent }]}>{onField}</Text>
          <Text style={[styles.statLabel, { color: C.textMuted }]}>On Field</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: C.bgCard, borderTopColor: COLORS.gray400 }]}>
          <Text style={[styles.statValue, { color: COLORS.gray400 }]}>{offline}</Text>
          <Text style={[styles.statLabel, { color: C.textMuted }]}>Offline</Text>
        </View>
      </View>

      {/* Office Locations */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Office Locations</Text>
        {OFFICE_LOCATIONS.map((office) => (
          <View key={office.name} style={[styles.officeCard, { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border }]}>
            <View style={styles.officeIcon}>
              <Text style={{ fontSize: 20 }}>🏢</Text>
            </View>
            <View style={styles.officeInfo}>
              <Text style={[styles.officeName, { color: C.textPrimary }]}>{office.name}</Text>
              <Text style={[styles.officeAddress, { color: C.textMuted }]}>{office.address}</Text>
            </View>
            <View style={styles.officeRight}>
              <Text style={[styles.officeStaff, { color: C.textAccent }]}>{office.staff}</Text>
              <Text style={[styles.officeRadius, { color: C.textMuted }]}>{office.radius}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Filter */}
      <View style={styles.filterRow}>
        {[
          { key: 'all', label: `All (${STAFF_LOCATIONS.length})` },
          { key: 'office', label: `Office (${inOffice})` },
          { key: 'field', label: `Field (${onField})` },
          { key: 'offline', label: `Offline (${offline})` },
        ].map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterChip,
              { backgroundColor: C.bgCard, borderColor: C.border },
              filter === f.key && { backgroundColor: C.bg, borderColor: C.border },
            ]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, { color: C.textMuted }, filter === f.key && { color: C.textPrimary }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Staff List */}
      {filtered.map((staff) => (
        <TouchableOpacity key={staff.id} style={[styles.staffCard, { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border }]} activeOpacity={0.7}>
          <View style={styles.staffRow}>
            <View style={[styles.staffAvatar, { backgroundColor: staff.status === 'active' ? COLORS.successLight : COLORS.gray100 }]}>
              <Text style={styles.staffInitial}>{staff.name[0]}</Text>
              <View style={[styles.statusIndicator, { backgroundColor: staff.status === 'active' ? COLORS.success : COLORS.gray400 }]} />
            </View>
            <View style={styles.staffInfo}>
              <Text style={[styles.staffName, { color: C.textPrimary }]}>{staff.name}</Text>
              <Text style={[styles.staffDept, { color: C.textMuted }]}>{staff.dept}</Text>
            </View>
            <View style={styles.staffMeta}>
              <Text style={[styles.lastSeen, { color: C.textMuted }]}>{staff.lastSeen}</Text>
              <View style={styles.batteryRow}>
                <Text style={{ fontSize: 12 }}>{getBatteryIcon(staff.battery)}</Text>
                <Text style={[styles.batteryText, { color: getBatteryColor(staff.battery) }]}>{staff.battery}%</Text>
              </View>
            </View>
          </View>
          <View style={[styles.locationRow, { borderTopColor: C.border }]}>
            <Text style={styles.locationPin}>📍</Text>
            <Text style={[styles.locationText, { color: C.textPrimary }]}>{staff.location}</Text>
            <Text style={[styles.distanceText, { color: C.textMuted }]}>{staff.distance}</Text>
          </View>
        </TouchableOpacity>
      ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.xl, paddingBottom: 16, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.gray100, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 20, color: COLORS.text },
  headerTitle: { ...FONTS.h3 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.dangerLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.danger },
  liveText: { fontSize: 11, fontWeight: '700', color: COLORS.danger, letterSpacing: 1 },

  mapCard: { margin: SPACING.xl, borderRadius: RADIUS.xl, overflow: 'hidden', ...SHADOWS.md },
  mapPlaceholder: { height: 180, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  mapIcon: { fontSize: 36 },
  mapText: { fontSize: 16, fontWeight: '600', color: COLORS.white, marginTop: 8 },
  mapSubtext: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  mapDots: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  mapDotItem: { position: 'absolute', alignItems: 'center' },
  mapDotPulse: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  mapDotLabel: { fontSize: 8, color: 'rgba(255,255,255,0.6)', marginTop: 2 },

  statsRow: { flexDirection: 'row', paddingHorizontal: SPACING.xl, gap: 10 },
  statCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', borderTopWidth: 3, ...SHADOWS.sm },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '500', color: COLORS.textMuted, marginTop: 2 },

  section: { paddingHorizontal: SPACING.xl, marginTop: 20 },
  sectionTitle: { ...FONTS.h3, fontSize: 16, marginBottom: 10 },

  officeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: 8, ...SHADOWS.xs },
  officeIcon: { width: 40, height: 40, borderRadius: RADIUS.sm, backgroundColor: COLORS.accentSoft, justifyContent: 'center', alignItems: 'center' },
  officeInfo: { flex: 1, marginLeft: 12 },
  officeName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  officeAddress: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  officeRight: { alignItems: 'center' },
  officeStaff: { fontSize: 18, fontWeight: '700', color: COLORS.accent },
  officeRadius: { fontSize: 10, color: COLORS.textMuted },

  filterRow: { flexDirection: 'row', paddingHorizontal: SPACING.xl, gap: 6, marginTop: 20, marginBottom: 12 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  filterActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: 11, fontWeight: '500', color: COLORS.gray500 },
  filterTextActive: { color: COLORS.white },

  staffCard: { backgroundColor: COLORS.white, marginHorizontal: SPACING.xl, marginBottom: 8, borderRadius: RADIUS.lg, padding: SPACING.lg, ...SHADOWS.sm },
  staffRow: { flexDirection: 'row', alignItems: 'center' },
  staffAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  staffInitial: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  statusIndicator: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: COLORS.white },
  staffInfo: { flex: 1, marginLeft: 12 },
  staffName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  staffDept: { fontSize: 12, color: COLORS.textMuted },
  staffMeta: { alignItems: 'flex-end' },
  lastSeen: { fontSize: 11, color: COLORS.textMuted },
  batteryRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  batteryText: { fontSize: 11, fontWeight: '600' },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.gray100, gap: 6 },
  locationPin: { fontSize: 14 },
  locationText: { fontSize: 13, color: COLORS.text, flex: 1 },
  distanceText: { fontSize: 11, color: COLORS.textMuted },
});
