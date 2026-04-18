import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import BackgroundAnimation from '../components/BackgroundAnimation';

const PRESETS = [
  { label: '🎵 Recommend music', prompt: 'Recommend some great music for me to download today' },
  { label: '📥 How to download', prompt: 'How do I download a video from YouTube using WAVE?' },
  { label: '🔍 Search tips', prompt: 'What are the best sites to search for music on WAVE?' },
  { label: '🎧 Audio formats', prompt: 'What is the best audio format to download music in?' },
  { label: '🌊 About WAVE', prompt: 'What can WAVE do?' },
  { label: '🎤 Lyrics help', prompt: 'Can you help me find the lyrics to a song?' },
];

export default function ARIAScreen() {
  const { theme, settings, chatHistory, saveChatHistory, showToast, haptic } = useApp();
  const API_URL = settings.customServer || 'https://wave-backened-production.up.railway.app';

  const [messages, setMessages] = useState(
    chatHistory.length > 0 ? chatHistory : [{
      id: '0',
      role: 'assistant',
      content: "Hey! I'm ARIA 👋 Your AI assistant inside WAVE. Ask me anything about music, downloads, or just chat!",
      timestamp: new Date().toISOString(),
    }]
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState('auto'); // auto = server decides based on env keys
  const [serverProviders, setServerProviders] = useState([]); // what the server has available
  const listRef = useRef(null);
  const insets = useSafeAreaInsets();
  const typingAnim = useRef(new Animated.Value(0)).current;

  // Check what AI providers the server has available
  useEffect(() => {
    checkProviders();
  }, []);

  const checkProviders = async () => {
    try {
      const res = await fetch(`${API_URL}/aria/providers`);
      const data = await res.json();
      if (data.providers) setServerProviders(data.providers);
      if (data.default) setProvider(data.default);
    } catch (e) {
      // Server may not have this endpoint yet — silently ignore
    }
  };

  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(typingAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(typingAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      typingAnim.setValue(0);
    }
  }, [loading]);

  const sendMessage = useCallback(async (text) => {
    const content = (text || input).trim();
    if (!content || loading) return;
    haptic('light');

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const ctrl = new AbortController();
      const tm = setTimeout(() => ctrl.abort(), 30000);

      const res = await fetch(`${API_URL}/aria/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          history: newMessages
            .filter(m => m.role !== 'system')
            .slice(-20) // send last 20 messages for context
            .map(m => ({ role: m.role, content: m.content })),
          provider, // 'auto', 'gemini', or 'claude' — server picks based on available keys
        }),
        signal: ctrl.signal,
      });
      clearTimeout(tm);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }

      const data = await res.json();
      const responseText = data.reply || data.content || data.message || 'No response';
      const usedProvider = data.provider || provider;

      const assistantMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date().toISOString(),
        provider: usedProvider,
      };

      const finalMessages = [...newMessages, assistantMsg];
      setMessages(finalMessages);
      await saveChatHistory(finalMessages.slice(-50));
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      haptic('light');

    } catch (e) {
      const errText = e.name === 'AbortError' ? 'Request timed out' : (e.message || 'Failed to reach server');
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `⚠️ ${errText}\n\nMake sure your backend server has GEMINI_API_KEY or CLAUDE_API_KEY set in Railway environment variables.`,
        timestamp: new Date().toISOString(),
        isError: true,
      }]);
      showToast(errText, 'error');
    } finally {
      setLoading(false);
    }
  }, [input, messages, loading, provider, API_URL]);

  const clearChat = async () => {
    const initial = [{
      id: '0',
      role: 'assistant',
      content: "Chat cleared! I'm ARIA, ready to help 🌊",
      timestamp: new Date().toISOString(),
    }];
    setMessages(initial);
    await saveChatHistory([]);
    haptic('medium');
  };

  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
        {!isUser && (
          <LinearGradient colors={[theme.primary, theme.primary2]} style={styles.avatar}>
            <Text style={styles.avatarText}>A</Text>
          </LinearGradient>
        )}
        <View style={[
          styles.msgBubble,
          isUser
            ? { backgroundColor: theme.primary, borderBottomRightRadius: 4 }
            : { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, borderBottomLeftRadius: 4 },
          item.isError && { backgroundColor: 'rgba(255,76,76,0.12)', borderColor: 'rgba(255,76,76,0.3)' },
        ]}>
          <Text style={[styles.msgText, { color: isUser ? '#fff' : theme.text }]}>
            {item.content}
          </Text>
          <View style={styles.msgMeta}>
            <Text style={[styles.msgTime, { color: isUser ? 'rgba(255,255,255,0.55)' : theme.sub }]}>
              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {item.provider && item.provider !== 'auto' && (
              <Text style={[styles.msgProvider, { color: isUser ? 'rgba(255,255,255,0.55)' : theme.sub }]}>
                · {item.provider}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.bg }]}
      keyboardVerticalOffset={68}
    >
      <BackgroundAnimation theme={theme} intensity="low" />

      {/* Header */}
      <View style={[styles.header, {
        paddingTop: insets.top + 8,
        backgroundColor: `${theme.bg}f0`,
        borderBottomColor: `${theme.border}80`,
      }]}>
        <LinearGradient colors={[theme.primary, theme.primary2]} style={styles.ariaAvatar}>
          <Text style={styles.ariaAvatarText}>A</Text>
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>ARIA</Text>
          <Text style={[styles.headerSub, { color: theme.sub }]}>
            {loading ? '✨ Thinking...' : `AI Assistant · ${provider === 'auto' ? 'Auto' : provider}`}
          </Text>
        </View>

        {/* Provider selector — only shows options server has available */}
        {serverProviders.length > 1 && (
          <View style={styles.providerRow}>
            {['auto', ...serverProviders].map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.providerChip, { borderColor: theme.border },
                  provider === p && { backgroundColor: `${theme.primary}25`, borderColor: theme.primary }
                ]}
                onPress={() => { setProvider(p); haptic('light'); }}
              >
                <Text style={[styles.providerChipText, { color: provider === p ? theme.primary : theme.sub }]}>
                  {p === 'auto' ? '⚡ Auto' : p === 'gemini' ? '✨ Gemini' : '🤖 Claude'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity onPress={clearChat} style={styles.clearBtn}>
          <Ionicons name="trash-outline" size={18} color={theme.sub} />
        </TouchableOpacity>
      </View>

      {/* Quick presets */}
      <View style={styles.presets}>
        {PRESETS.map((p, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.presetChip, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => sendMessage(p.prompt)}
          >
            <Text style={[styles.presetText, { color: theme.sub }]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.msgList}
        style={{ zIndex: 1 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Typing dots */}
      {loading && (
        <View style={styles.typingRow}>
          <LinearGradient colors={[theme.primary, theme.primary2]} style={styles.avatar}>
            <Text style={styles.avatarText}>A</Text>
          </LinearGradient>
          <View style={[styles.typingBubble, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {[0, 1, 2].map(i => (
              <Animated.View
                key={i}
                style={[styles.typingDot, {
                  backgroundColor: theme.primary,
                  opacity: typingAnim,
                  transform: [{ scale: typingAnim.interpolate({ inputRange: [0,1], outputRange: [0.6, 1] }) }],
                }]}
              />
            ))}
          </View>
        </View>
      )}

      {/* Input bar */}
      <View style={[styles.inputBar, {
        backgroundColor: `${theme.bg}f8`,
        borderTopColor: `${theme.border}80`,
        paddingBottom: insets.bottom + 4,
      }]}>
        <TextInput
          style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
          value={input}
          onChangeText={setInput}
          placeholder="Ask ARIA anything..."
          placeholderTextColor={theme.sub}
          multiline
          maxLength={2000}
          returnKeyType="send"
          onSubmitEditing={() => sendMessage()}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          onPress={() => sendMessage()}
          style={[styles.sendBtn, {
            backgroundColor: input.trim() && !loading ? theme.primary : theme.card,
            borderColor: theme.border,
          }]}
          disabled={!input.trim() || loading}
        >
          <Ionicons name="send" size={18} color={input.trim() && !loading ? '#fff' : theme.sub} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
    flexWrap: 'wrap',
  },
  ariaAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  ariaAvatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  headerTitle: { fontSize: 16, fontWeight: '800' },
  headerSub: { fontSize: 11, marginTop: 1 },
  providerRow: { flexDirection: 'row', gap: 6 },
  providerChip: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  providerChipText: { fontSize: 11, fontWeight: '700' },
  clearBtn: { padding: 6 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 12, paddingBottom: 4 },
  presetChip: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  presetText: { fontSize: 11, fontWeight: '600' },
  msgList: { padding: 16, gap: 12, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  msgRowUser: { flexDirection: 'row-reverse' },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  msgBubble: { maxWidth: '82%', borderRadius: 16, padding: 12 },
  msgText: { fontSize: 14, lineHeight: 21 },
  msgMeta: { flexDirection: 'row', marginTop: 5, gap: 4 },
  msgTime: { fontSize: 10 },
  msgProvider: { fontSize: 10 },
  typingRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 8 },
  typingBubble: { borderRadius: 16, padding: 12, borderWidth: 1, flexDirection: 'row', gap: 5, alignItems: 'center' },
  typingDot: { width: 7, height: 7, borderRadius: 4 },
  inputBar: { flexDirection: 'row', gap: 8, padding: 12, paddingTop: 10, borderTopWidth: 1 },
  input: {
    flex: 1, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 16,
    paddingVertical: 10, fontSize: 14, maxHeight: 100,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
