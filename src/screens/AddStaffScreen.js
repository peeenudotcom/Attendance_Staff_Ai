import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS, SHADOWS, RADIUS, SPACING, FONTS } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { useHeaderInset } from '../utils/safeArea';
import { staffAPI } from '../services/api';

export default function AddStaffScreen({ navigation }) {
  const { colors: C } = useTheme();
  const headerTop = useHeaderInset(12);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [salaryType, setSalaryType] = useState('monthly');
  const [salary, setSalary] = useState('');
  const [sendInvite, setSendInvite] = useState(true);
  const [saving, setSaving] = useState(false);

  const departments = ['Sales', 'Marketing', 'Development', 'Support', 'HR', 'Operations', 'Finance'];
  const salaryTypes = [
    { key: 'monthly', label: 'Monthly', icon: '📅' },
    { key: 'daily', label: 'Daily', icon: '☀️' },
    { key: 'hourly', label: 'Hourly', icon: '⏱️' },
    { key: 'weekly', label: 'Weekly', icon: '📆' },
  ];

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Required', 'Please enter staff name');
    if (phone.length < 10) return Alert.alert('Required', 'Please enter valid phone number');
    if (!salary) return Alert.alert('Required', 'Please enter salary amount');

    setSaving(true);
    try {
      await staffAPI.create({ name: name.trim(), phone, department, designation, salaryType, salary: Number(salary), sendInvite });
      Alert.alert('Staff Added', `${name.trim()} has been added.`, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert('Could not add staff', e.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView style={[styles.container, { backgroundColor: C.bg }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      {/* Header */}
      <View style={[styles.header, { paddingTop: headerTop, backgroundColor: C.bgCard, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: C.bgElevated }]}>
          <Text style={[styles.backIcon, { color: C.textPrimary }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Add Staff Member</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Form */}
      <View style={styles.form}>
        {/* Avatar Placeholder */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatarCircle, { backgroundColor: C.accentSoft, borderColor: C.accentBorder }]}>
            <Text style={styles.avatarIcon}>👤</Text>
          </View>
          <TouchableOpacity style={styles.avatarButton}>
            <Text style={[styles.avatarButtonText, { color: C.textAccent }]}>Add Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Basic Info */}
        <View style={[styles.card, { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border }]}>
          <Text style={[styles.cardTitle, { color: C.textPrimary }]}>Basic Information</Text>

          <Text style={[styles.label, { color: C.textMuted }]}>Full Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: C.bgElevated, borderColor: C.border, color: C.textPrimary }]}
            placeholder="Enter staff name"
            placeholderTextColor={C.textMuted}
            value={name}
            onChangeText={setName}
          />

          <Text style={[styles.label, { color: C.textMuted }]}>Phone Number *</Text>
          <View style={styles.phoneRow}>
            <View style={[styles.codeBox, { backgroundColor: C.bgElevated, borderColor: C.border }]}>
              <Text style={[styles.codeText, { color: C.textPrimary }]}>🇮🇳 +91</Text>
            </View>
            <TextInput
              style={[styles.input, { flex: 1, backgroundColor: C.bgElevated, borderColor: C.border, color: C.textPrimary }]}
              placeholder="10 digit number"
              placeholderTextColor={C.textMuted}
              keyboardType="phone-pad"
              maxLength={10}
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          <Text style={[styles.label, { color: C.textMuted }]}>Designation</Text>
          <TextInput
            style={[styles.input, { backgroundColor: C.bgElevated, borderColor: C.border, color: C.textPrimary }]}
            placeholder="e.g. Sales Executive, Developer"
            placeholderTextColor={C.textMuted}
            value={designation}
            onChangeText={setDesignation}
          />
        </View>

        {/* Department */}
        <View style={[styles.card, { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border }]}>
          <Text style={[styles.cardTitle, { color: C.textPrimary }]}>Department</Text>
          <View style={styles.chipGrid}>
            {departments.map((dept) => (
              <TouchableOpacity
                key={dept}
                style={[
                  styles.chip,
                  { backgroundColor: C.bgElevated, borderColor: C.border },
                  department === dept && { backgroundColor: C.accentSoft, borderColor: C.accentBorder },
                ]}
                onPress={() => setDepartment(dept)}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: C.textMuted },
                    department === dept && { color: C.textAccent, fontWeight: '600' },
                  ]}
                >
                  {dept}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Salary */}
        <View style={[styles.card, { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border }]}>
          <Text style={[styles.cardTitle, { color: C.textPrimary }]}>Salary Details</Text>

          <Text style={[styles.label, { color: C.textMuted }]}>Salary Type</Text>
          <View style={styles.salaryTypeRow}>
            {salaryTypes.map((type) => (
              <TouchableOpacity
                key={type.key}
                style={[
                  styles.salaryTypeCard,
                  { backgroundColor: C.bgElevated, borderColor: C.border },
                  salaryType === type.key && { backgroundColor: C.accentSoft, borderColor: C.accentBorder },
                ]}
                onPress={() => setSalaryType(type.key)}
              >
                <Text style={styles.salaryTypeIcon}>{type.icon}</Text>
                <Text
                  style={[
                    styles.salaryTypeText,
                    { color: C.textMuted },
                    salaryType === type.key && { color: C.textAccent },
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: C.textMuted }]}>Amount (₹) *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: C.bgElevated, borderColor: C.border, color: C.textPrimary }]}
            placeholder={salaryType === 'monthly' ? 'e.g. 25000' : salaryType === 'daily' ? 'e.g. 800' : 'e.g. 150'}
            placeholderTextColor={C.textMuted}
            keyboardType="numeric"
            value={salary}
            onChangeText={setSalary}
          />
        </View>

        {/* Invite */}
        <View style={[styles.card, { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border }]}>
          <View style={styles.switchRow}>
            <View>
              <Text style={[styles.switchLabel, { color: C.textPrimary }]}>Send App Invite</Text>
              <Text style={[styles.switchDesc, { color: C.textMuted }]}>Send WhatsApp invite to download Staff App</Text>
            </View>
            <Switch
              value={sendInvite}
              onValueChange={setSendInvite}
              trackColor={{ false: COLORS.gray300, true: COLORS.accent + '60' }}
              thumbColor={sendInvite ? COLORS.accent : COLORS.gray400}
            />
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity style={[styles.saveButton, saving && { opacity: 0.6 }]} onPress={handleSave} activeOpacity={0.8} disabled={saving}>
          <Text style={[styles.saveButtonText, { color: '#ffffff' }]}>{saving ? 'Adding…' : 'Add Staff Member'}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.xl, paddingBottom: 16, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.gray100, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 20, color: COLORS.text },
  headerTitle: { ...FONTS.h3 },

  form: { padding: SPACING.xl },

  avatarSection: { alignItems: 'center', marginBottom: 20 },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.accentSoft, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.accentBorder, borderStyle: 'dashed' },
  avatarIcon: { fontSize: 32 },
  avatarButton: { marginTop: 8 },
  avatarButtonText: { ...FONTS.captionMedium, color: COLORS.accent },

  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.xl, marginBottom: 12, ...SHADOWS.sm },
  cardTitle: { ...FONTS.h3, fontSize: 16, marginBottom: 16 },

  label: { ...FONTS.captionMedium, color: COLORS.gray600, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: COLORS.gray50, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: COLORS.text },

  phoneRow: { flexDirection: 'row', gap: 8 },
  codeBox: { backgroundColor: COLORS.gray100, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, justifyContent: 'center' },
  codeText: { fontSize: 14, fontWeight: '600', color: COLORS.text },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: COLORS.gray100, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.accentSoft, borderColor: COLORS.accent },
  chipText: { fontSize: 13, fontWeight: '500', color: COLORS.gray600 },
  chipTextActive: { color: COLORS.accent, fontWeight: '600' },

  salaryTypeRow: { flexDirection: 'row', gap: 8 },
  salaryTypeCard: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: RADIUS.sm, backgroundColor: COLORS.gray50, borderWidth: 1.5, borderColor: COLORS.border },
  salaryTypeActive: { backgroundColor: COLORS.accentSoft, borderColor: COLORS.accent },
  salaryTypeIcon: { fontSize: 18, marginBottom: 4 },
  salaryTypeText: { fontSize: 11, fontWeight: '600', color: COLORS.gray500 },
  salaryTypeTextActive: { color: COLORS.accent },

  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  switchDesc: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  saveButton: { backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingVertical: 16, alignItems: 'center', marginTop: 8, ...SHADOWS.accent },
  saveButtonText: { ...FONTS.button, color: COLORS.white },
});
