import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { RADIUS, SPACING, FONTS } from '../utils/theme';

export default function ChatBubble({ message }) {
  const { colors: C } = useTheme();
  const isUser = message.sender === 'user';

  return (
    <View style={[styles.row, isUser && styles.rowUser]}>
      {!isUser && (
        <View style={[styles.avatar, { backgroundColor: C.accentSoft }]}>
          <Text style={styles.avatarText}>✦</Text>
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser
            ? { backgroundColor: C.accentStart || '#7C3AED', borderBottomRightRadius: 4 }
            : { backgroundColor: C.bgCard, borderColor: C.border, borderWidth: 1, borderBottomLeftRadius: 4 },
        ]}
      >
        <Text style={[styles.text, { color: isUser ? '#fff' : C.textPrimary }]}>
          {message.text}
        </Text>
        <Text style={[styles.time, { color: isUser ? 'rgba(255,255,255,0.6)' : C.textMuted }]}>
          {message.time}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginBottom: 12, paddingHorizontal: SPACING.lg, alignItems: 'flex-end' },
  rowUser: { flexDirection: 'row-reverse' },
  avatar: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  avatarText: { fontSize: 14, color: '#A78BFA' },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.lg },
  text: { ...FONTS.body, fontSize: 14, lineHeight: 20 },
  time: { fontSize: 10, marginTop: 4, textAlign: 'right' },
});
