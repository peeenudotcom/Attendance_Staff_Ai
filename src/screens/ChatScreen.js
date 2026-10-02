import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RADIUS, SPACING, FONTS } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { useModalHeaderInset, useBottomInset } from '../utils/safeArea';
import { useAuth } from '../context/AuthContext';
import ChatBubble from '../components/ChatBubble';
import GlowDot from '../components/GlowDot';
import { getChatResponse, getQuickReplies } from '../utils/chatResponder';

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function timeNow() {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatScreen({ navigation }) {
  const { colors: C } = useTheme();
  const headerTop = useModalHeaderInset(12);
  const bottomInset = useBottomInset(12);
  const { user } = useAuth();
  const listRef = useRef(null);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const isAdmin = user?.role === 'admin';

  const quickReplies = getQuickReplies(isAdmin);

  const [messages, setMessages] = useState([
    {
      id: 'init',
      text: `Hi ${user?.name?.split(' ')[0] || 'there'}! I'm your TARAhut AI assistant.\n\n${isAdmin ? 'As admin, I can help you approve leaves, schedule meetings, send reminders, track attendance, and more.' : 'I can help with your attendance, leave balance, team status, and more.'}\n\nType "help" to see all commands.`,
      sender: 'ai',
      time: timeNow(),
    },
  ]);

  const openWhatsApp = (encodedText) =>
    Linking.openURL(`whatsapp://send?text=${encodedText}`).catch(() => addAIMessage('WhatsApp is not installed on this device.'));

  const handleAction = (action, data) => {
    switch (action) {
      case 'navigate':
        navigation.goBack();
        setTimeout(() => navigation.navigate(data?.screen), 100);
        break;
      // Leave decisions, reminders, scheduling and WhatsApp alerts are not connected to the
      // backend yet, so the assistant says so instead of claiming they happened.
      case 'approve_leave':
      case 'reject_leave':
      case 'approve_all_recommended':
        addAIMessage(`I can't change leave requests from chat yet. Open Leave Management to review ${data?.name ? data.name + "'s" : 'the pending'} request.`);
        break;
      case 'send_reminder':
        addAIMessage("Push reminders aren't set up yet. You can send a WhatsApp reminder instead.");
        break;
      case 'whatsapp_broadcast':
        openWhatsApp('Hi%20team!%20Please%20mark%20your%20attendance%20on%20TARAhut%20app.%20-%20Admin');
        break;
      case 'whatsapp_reminder':
        openWhatsApp('Reminder:%20Please%20mark%20your%20attendance%20today%20on%20TARAhut%20app.');
        break;
      case 'whatsapp_setup':
        addAIMessage("Scheduled WhatsApp alerts aren't available yet. For now I can open WhatsApp with a ready-made message whenever you ask.");
        break;
      case 'schedule_confirm':
        addAIMessage(`I can't create calendar events or send invites yet, so nothing was scheduled for ${data?.day}. Please add the meeting in your calendar app.`);
        break;
      case 'check_in':
        navigation.goBack();
        setTimeout(() => navigation.navigate('MarkAttendance', { type: 'check-in' }), 100);
        break;
      case 'check_out':
        navigation.goBack();
        setTimeout(() => navigation.navigate('MarkAttendance', { type: 'check-out' }), 100);
        break;
      default:
        break;
    }
  };

  const addAIMessage = (text) => {
    setMessages((prev) => [...prev, { id: makeId(), text, sender: 'ai', time: timeNow() }]);
  };

  const sendMessage = (text) => {
    if (!text.trim()) return;

    const userMsg = { id: makeId(), text: text.trim(), sender: 'user', time: timeNow() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    // Simulate AI thinking — longer for complex queries
    const thinkTime = text.length > 20 ? 800 + Math.random() * 600 : 400 + Math.random() * 400;

    setTimeout(() => {
      const result = getChatResponse(text, user?.id, { isAdmin });
      const aiMsg = {
        id: makeId(),
        text: result.response,
        sender: 'ai',
        time: timeNow(),
        actions: result.actions || [],
      };
      setMessages((prev) => [...prev, aiMsg]);
      setTyping(false);
    }, thinkTime);
  };

  const renderMessage = ({ item }) => {
    return (
      <View>
        <ChatBubble message={item} />
        {/* Action Buttons */}
        {item.actions && item.actions.length > 0 && (
          <View style={styles.actionsRow}>
            {item.actions.map((act, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.actionBtn, { backgroundColor: C.accentSoft, borderColor: C.accentBorder }]}
                onPress={() => handleAction(act.action, act.data)}
                activeOpacity={0.7}
              >
                <Text style={[styles.actionText, { color: C.textAccent }]}>{act.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: C.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: headerTop, backgroundColor: C.bgCard, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: C.bgElevated }]}>
          <Text style={[styles.backIcon, { color: C.textPrimary }]}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            <Text style={[styles.headerTitle, { color: C.textPrimary }]}>AI Assistant</Text>
            <GlowDot color={C.success} size={6} pulse />
          </View>
          <Text style={[styles.headerSub, { color: C.textMuted }]}>
            {isAdmin ? 'Admin commands enabled' : 'Ask me anything about your work'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.aiBadge, { backgroundColor: C.accentSoft }]}
          onPress={() => sendMessage('notifications')}
          activeOpacity={0.7}
        >
          <Text style={styles.aiIcon}>🔔</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={
          typing ? (
            <View style={styles.typingRow}>
              <View style={[styles.typingAvatar, { backgroundColor: C.accentSoft }]}>
                <Text style={{ fontSize: 12, color: '#A78BFA' }}>✦</Text>
              </View>
              <View style={[styles.typingBubble, { backgroundColor: C.bgCard, borderColor: C.border }]}>
                <Text style={[styles.typingText, { color: C.textMuted }]}>Thinking</Text>
                <GlowDot color={C.textMuted} size={4} pulse />
                <GlowDot color={C.textMuted} size={4} pulse />
                <GlowDot color={C.textMuted} size={4} pulse />
              </View>
            </View>
          ) : null
        }
      />

      {/* Quick Replies */}
      <View style={styles.quickRow}>
        <FlatList
          data={quickReplies}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          contentContainerStyle={{ paddingHorizontal: SPACING.lg, gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.quickChip, { backgroundColor: C.bgCard, borderColor: C.border }]}
              onPress={() => sendMessage(item)}
              activeOpacity={0.7}
            >
              <Text style={[styles.quickText, { color: C.textAccent }]}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Input */}
      <View style={[styles.inputBar, { paddingBottom: bottomInset, backgroundColor: C.bgCard, borderTopColor: C.border }]}>
        <TextInput
          style={[styles.input, { backgroundColor: C.bgElevated, borderColor: C.border, color: C.textPrimary }]}
          placeholder={isAdmin ? 'Ask or command...' : 'Ask about attendance, leaves...'}
          placeholderTextColor={C.textMuted}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => sendMessage(input)}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendBtn, { opacity: input.trim() ? 1 : 0.3 }]}
          onPress={() => sendMessage(input)}
          disabled={!input.trim()}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={[C.accentStart || '#7C3AED', C.accentEnd || '#3B82F6']}
            style={styles.sendGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.sendIcon}>➤</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 20 },
  headerCenter: { flex: 1, marginLeft: 12 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { ...FONTS.h3 },
  headerSub: { fontSize: 11, marginTop: 2 },
  aiBadge: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  aiIcon: { fontSize: 18 },

  messageList: { paddingTop: SPACING.lg, paddingBottom: SPACING.md },

  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: SPACING.lg + 38, marginTop: -4, marginBottom: 12 },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1 },
  actionText: { fontSize: 12, fontWeight: '700' },

  typingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, marginBottom: 12, gap: 8 },
  typingAvatar: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  typingBubble: { flexDirection: 'row', gap: 4, alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.lg, borderWidth: 1 },
  typingText: { fontSize: 12, marginRight: 4 },

  quickRow: { paddingVertical: 8 },
  quickChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1 },
  quickText: { fontSize: 12, fontWeight: '600' },

  inputBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: 10, borderTopWidth: 1 },
  input: { flex: 1, height: 44, borderRadius: RADIUS.full, paddingHorizontal: 18, fontSize: 15, borderWidth: 1 },
  sendBtn: { marginLeft: 10 },
  sendGradient: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  sendIcon: { fontSize: 18, color: '#fff' },
});
