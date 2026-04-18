import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Image, TextInput, Switch, Alert, Modal, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../context/AppContext';
import { THEMES, QUALITY_OPTIONS, FORMAT_OPTIONS } from '../constants';
import { getStorageInfo, formatBytes } from '../utils/downloader';

export default function SettingsScreen({ navigation }) {
  const { theme, settings, saveSettings, profile, saveProfile, library, showToast, haptic } = useApp();
  const insets = useSafeAreaInsets();

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(profile.name || '');
  const [serverInput, setServerInput] = useState(settings.customServer || 'https://wave-backened-production.up.railway.app');
  const [themeVisible, setThemeVisible] = useState(false);
  const [storageInfo, setStorageInfo] = useState(null);

  const pickProfilePicture = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { showToast('Need photo access', 'error'); return; }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled) {
        await saveProfile({ picture: result.assets[0].uri });
        showToast('Profile picture updated! 📸', 'success');
        haptic('medium');
      }
    } catch (e) {
      showToast('Could not pick image', 'error');
    }
  };

  const takeSelfie = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { showToast('Need camera access', 'error'); return; }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled) {
        await saveProfile({ picture: result.assets[0].uri });
        showToast('Profile picture updated! 📸', 'success');
        haptic('medium');
      }
    } catch (e) {
      showToast('Could not open camera', 'error');
    }
  };

  const saveName = async () => {
    if (!nameInput.trim()) return;
    await saveProfile({ name: nameInput.trim() });
    setEditingName(false);
    showToast('Name updated ✅', 'success');
    haptic('light');
  };

  const saveServer = async () => {
    await saveSettings({ customServer: serverInput.trim() });
    showToast('Server URL saved ✅', 'success');
    haptic('light');
  };

  const loadStorageInfo = async () => {
    const info = await getStorageInfo();
    setStorageInfo(info);
  };

  const clearCache = async () => {
    Alert.alert('Clear Cache', 'This will remove app cache. Downloads stay.', [
      { text: 'Clear', onPress: () => showToast('Cache cleared ✅', 'success') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const SectionHeader = ({ title, icon }) => (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={14} color={theme.primary} />
      <Text style={[styles.sectionTitle, { color: theme.sub }]}>{title.toUpperCase()}</Text>
    </View>
  );

  const SettingRow = ({ icon, label, value, onPress, rightElement, danger, desc }) => (
    <TouchableOpacity
      style={[styles.settingRow, { borderBottomColor: `${theme.border}60` }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.settingIcon, { backgroundColor: `${danger ? theme.danger : theme.primary}20` }]}>
        <Ionicons name={icon} size={16} color={danger ? theme.danger : theme.primary} />
      </View>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingLabel, { color: danger ? theme.danger : theme.text }]}>{label}</Text>
        {desc && <Text style={[styles.settingDesc, { color: theme.sub }]}>{desc}</Text>}
      </View>
      {rightElement || (
        value ? <Text style={[styles.settingValue, { color: theme.sub }]}>{value}</Text> : null
      )}
      {onPress && !rightElement && <Ionicons name="chevron-forward" size={16} color={theme.sub} />}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: `${theme.bg}f0`, borderBottomColor: `${theme.border}80` }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
        <Text style={[styles.headerSub, { color: theme.sub }]}>Customize your WAVE</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <LinearGradient colors={[`${theme.primary}30`, `${theme.accent}15`]} style={styles.profileBg} />
          <TouchableOpacity onPress={pickProfilePicture} style={styles.avatarWrap}>
            {profile.picture ? (
              <Image source={{ uri: profile.picture }} style={styles.profileAvatar} />
            ) : (
              <LinearGradient colors={[theme.primary, theme.primary2]} style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>
                  {(profile.name || 'W').charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>
            )}
            <View style={[styles.cameraBtn, { backgroundColor: theme.primary }]}>
              <Ionicons name="camera" size={12} color="#fff" />
            </View>
          </TouchableOpacity>

          {editingName ? (
            <View style={styles.nameEdit}>
              <TextInput
                style={[styles.nameInput, { borderColor: theme.primary, color: theme.text, backgroundColor: theme.bg2 }]}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Your name"
                placeholderTextColor={theme.sub}
                autoFocus
                onSubmitEditing={saveName}
              />
              <View style={styles.nameEditBtns}>
                <TouchableOpacity style={[styles.nameBtn, { borderColor: theme.border }]} onPress={() => setEditingName(false)}>
                  <Ionicons name="close" size={16} color={theme.sub} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.nameBtn, { backgroundColor: theme.primary, borderColor: theme.primary }]} onPress={saveName}>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.nameRow} onPress={() => setEditingName(true)}>
              <Text style={[styles.profileName, { color: theme.text }]}>{profile.name || 'WAVE User'}</Text>
              <Ionicons name="pencil" size={14} color={theme.sub} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          )}

          <Text style={[styles.profileStats, { color: theme.sub }]}>
            {library.length} files · {library.filter(i => i.fav).length} favorites
          </Text>

          <View style={styles.profileActions}>
            <TouchableOpacity style={[styles.profileAction, { borderColor: theme.border }]} onPress={pickProfilePicture}>
              <Ionicons name="image" size={16} color={theme.primary} />
              <Text style={[styles.profileActionText, { color: theme.primary }]}>Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.profileAction, { borderColor: theme.border }]} onPress={takeSelfie}>
              <Ionicons name="camera" size={16} color={theme.primary} />
              <Text style={[styles.profileActionText, { color: theme.primary }]}>Camera</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Theme */}
        <View style={styles.settingsGroup}>
          <SectionHeader title="Appearance" icon="color-palette" />
          <SettingRow
            icon="color-palette"
            label="Theme"
            value={THEMES[settings.theme]?.name || 'Default'}
            onPress={() => setThemeVisible(true)}
          />
          <SettingRow
            icon="text"
            label="Font Size"
            rightElement={
              <View style={styles.segmented}>
                {['small','normal','large'].map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.segBtn, { borderColor: theme.border }, settings.fontSize === s && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                    onPress={() => { saveSettings({ fontSize: s }); haptic('light'); }}
                  >
                    <Text style={[styles.segText, { color: settings.fontSize === s ? '#fff' : theme.sub }]}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            }
          />
          <SettingRow
            icon="sparkles"
            label="Background Animations"
            rightElement={
              <Switch
                value={settings.backgroundAnimations !== false}
                onValueChange={v => { saveSettings({ backgroundAnimations: v }); haptic('light'); }}
                trackColor={{ false: theme.border, true: `${theme.primary}80` }}
                thumbColor={settings.backgroundAnimations !== false ? theme.primary : theme.sub}
              />
            }
          />
        </View>

        {/* AI Assistant info row */}
        <View style={styles.settingsGroup}>
          <SectionHeader title="AI Assistant" icon="chatbubbles" />
          <SettingRow
            icon="chatbubbles"
            label="ARIA powered by server"
            desc="API keys are set in Railway environment variables"
          />
        </View>

        {/* Downloads */}
        <View style={styles.settingsGroup}>
          <SectionHeader title="Downloads" icon="cloud-download" />
          <SettingRow
            icon="server"
            label="Default Quality"
            rightElement={
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {['360p','480p','720p','1080p'].map(q => (
                  <TouchableOpacity
                    key={q}
                    style={[styles.segBtn, { borderColor: theme.border, marginRight: 6 }, settings.defaultQuality === q && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                    onPress={() => { saveSettings({ defaultQuality: q }); haptic('light'); }}
                  >
                    <Text style={[styles.segText, { color: settings.defaultQuality === q ? '#fff' : theme.sub }]}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            }
          />
          <SettingRow
            icon="document"
            label="Default Format"
            rightElement={
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {['mp4','mp3','m4a','webm'].map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.segBtn, { borderColor: theme.border, marginRight: 6 }, settings.defaultFormat === f && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                    onPress={() => { saveSettings({ defaultFormat: f }); haptic('light'); }}
                  >
                    <Text style={[styles.segText, { color: settings.defaultFormat === f ? '#fff' : theme.sub }]}>{f.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            }
          />
          <SettingRow
            icon="notifications"
            label="Download Notifications"
            rightElement={
              <Switch
                value={settings.downloadNotifications !== false}
                onValueChange={v => { saveSettings({ downloadNotifications: v }); haptic('light'); }}
                trackColor={{ false: theme.border, true: `${theme.primary}80` }}
                thumbColor={settings.downloadNotifications !== false ? theme.primary : theme.sub}
              />
            }
          />
          <SettingRow
            icon="library"
            label="Auto-add to Library"
            rightElement={
              <Switch
                value={settings.autoAddToLibrary !== false}
                onValueChange={v => { saveSettings({ autoAddToLibrary: v }); haptic('light'); }}
                trackColor={{ false: theme.border, true: `${theme.primary}80` }}
                thumbColor={settings.autoAddToLibrary !== false ? theme.primary : theme.sub}
              />
            }
          />
        </View>

        {/* Playback */}
        <View style={styles.settingsGroup}>
          <SectionHeader title="Playback" icon="musical-notes" />
          <SettingRow
            icon="infinite"
            label="Crossfade"
            rightElement={
              <Switch
                value={settings.crossfade === true}
                onValueChange={v => { saveSettings({ crossfade: v }); haptic('light'); }}
                trackColor={{ false: theme.border, true: `${theme.primary}80` }}
                thumbColor={settings.crossfade ? theme.primary : theme.sub}
              />
            }
          />
          <SettingRow
            icon="volume-high"
            label="Volume Normalization"
            rightElement={
              <Switch
                value={settings.normalization === true}
                onValueChange={v => { saveSettings({ normalization: v }); haptic('light'); }}
                trackColor={{ false: theme.border, true: `${theme.primary}80` }}
                thumbColor={settings.normalization ? theme.primary : theme.sub}
              />
            }
          />
          <SettingRow
            icon="phone-portrait"
            label="Haptic Feedback"
            rightElement={
              <Switch
                value={settings.hapticFeedback !== false}
                onValueChange={v => { saveSettings({ hapticFeedback: v }); haptic('light'); }}
                trackColor={{ false: theme.border, true: `${theme.primary}80` }}
                thumbColor={settings.hapticFeedback !== false ? theme.primary : theme.sub}
              />
            }
          />
        </View>

        {/* Server */}
        <View style={styles.settingsGroup}>
          <SectionHeader title="Server" icon="server" />
          <View style={styles.keySection}>
            <Text style={[styles.keyLabel, { color: theme.sub }]}>Backend Server URL</Text>
            <View style={[styles.keyRow, { borderColor: theme.border, backgroundColor: theme.card }]}>
              <Ionicons name="globe" size={16} color={theme.sub} />
              <TextInput
                style={[styles.keyInput, { color: theme.text }]}
                value={serverInput}
                onChangeText={setServerInput}
                placeholder="https://..."
                placeholderTextColor={theme.sub}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>
            <TouchableOpacity style={[styles.saveKeysBtn, { backgroundColor: theme.primary }]} onPress={saveServer}>
              <Text style={styles.saveKeysBtnText}>Save Server URL</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Storage */}
        <View style={styles.settingsGroup}>
          <SectionHeader title="Storage" icon="save" />
          <SettingRow
            icon="analytics"
            label="Check Storage"
            onPress={async () => { await loadStorageInfo(); }}
          />
          {storageInfo && (
            <View style={[styles.storageInfo, { backgroundColor: theme.bg2, borderColor: theme.border }]}>
              <Text style={[styles.storageText, { color: theme.text }]}>Free: {formatBytes(storageInfo.free)}</Text>
              <Text style={[styles.storageText, { color: theme.text }]}>Total: {formatBytes(storageInfo.total)}</Text>
              <Text style={[styles.storageText, { color: theme.primary }]}>WAVE Library: {formatBytes(library.reduce((s, i) => s + (i.size || 0), 0))}</Text>
            </View>
          )}
          <SettingRow icon="trash" label="Clear App Cache" onPress={clearCache} />
        </View>

        {/* About */}
        <View style={styles.settingsGroup}>
          <SectionHeader title="About" icon="information-circle" />
          <SettingRow icon="musical-notes" label="WAVE Version" value="2.0.0" />
          <SettingRow icon="code-slash" label="Built with Expo + React Native" />
          <SettingRow icon="heart" label="Made for Music Lovers" />
        </View>
      </ScrollView>

      {/* Theme Picker Modal */}
      <Modal visible={themeVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.themeSheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>🎨 Choose Theme</Text>
            <FlatList
              data={Object.entries(THEMES)}
              numColumns={3}
              keyExtractor={([key]) => key}
              renderItem={({ item: [key, t] }) => (
                <TouchableOpacity
                  style={[
                    styles.themeOption,
                    { borderColor: settings.theme === key ? theme.primary : 'transparent' }
                  ]}
                  onPress={() => { saveSettings({ theme: key }); haptic('medium'); setThemeVisible(false); }}
                >
                  <LinearGradient
                    colors={[t.primary, t.accent || t.primary2]}
                    style={styles.themeCircle}
                  />
                  <Text style={[styles.themeName, { color: settings.theme === key ? theme.primary : theme.sub }]}>
                    {t.name}
                  </Text>
                  {settings.theme === key && (
                    <Ionicons name="checkmark-circle" size={14} color={theme.primary} />
                  )}
                </TouchableOpacity>
              )}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  headerSub: { fontSize: 12, marginTop: 2 },
  profileCard: {
    margin: 14, borderRadius: 20, borderWidth: 1, padding: 20,
    alignItems: 'center', overflow: 'hidden', position: 'relative',
  },
  profileBg: { position: 'absolute', inset: 0 },
  avatarWrap: { position: 'relative', marginBottom: 12 },
  profileAvatar: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  profileAvatarText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  cameraBtn: {
    position: 'absolute', bottom: 0, right: 0, width: 24, height: 24,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  profileName: { fontSize: 20, fontWeight: '800' },
  profileStats: { fontSize: 12, marginBottom: 14 },
  nameEdit: { width: '100%', alignItems: 'center', marginBottom: 8 },
  nameInput: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, width: '80%', marginBottom: 8 },
  nameEditBtns: { flexDirection: 'row', gap: 10 },
  nameBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  profileActions: { flexDirection: 'row', gap: 10 },
  profileAction: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  profileActionText: { fontSize: 13, fontWeight: '600' },
  settingsGroup: { marginBottom: 6 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, paddingTop: 16 },
  sectionTitle: { fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', fontWeight: '700' },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, gap: 12,
  },
  settingIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: 14, fontWeight: '500' },
  settingDesc: { fontSize: 11, marginTop: 2 },
  settingValue: { fontSize: 13 },
  segmented: { flexDirection: 'row', gap: 4 },
  segBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5 },
  segText: { fontSize: 11, fontWeight: '600' },
  keySection: { paddingHorizontal: 16, paddingBottom: 8 },
  keyLabel: { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '700', marginBottom: 8 },
  keyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 6,
  },
  keyInput: { flex: 1, fontSize: 14 },
  keyHint: { fontSize: 11, marginBottom: 4 },
  saveKeysBtn: { borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12 },
  saveKeysBtnText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 1 },
  storageInfo: { marginHorizontal: 16, borderRadius: 10, borderWidth: 1, padding: 12, gap: 4, marginBottom: 4 },
  storageText: { fontSize: 13 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  themeSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 24, maxHeight: '75%' },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 20 },
  themeOption: { flex: 1/3, alignItems: 'center', padding: 10, borderRadius: 12, borderWidth: 2 },
  themeCircle: { width: 44, height: 44, borderRadius: 22, marginBottom: 6 },
  themeName: { fontSize: 10, fontWeight: '600', textAlign: 'center', marginBottom: 2 },
});
