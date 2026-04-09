/**
 * SettingsScreen
 * Configure server URL and manage presets.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  FlatList,
} from 'react-native';
import Toast from 'react-native-toast-message';

import { setServerUrl, getServerUrl, healthCheck } from '../services/api';
import { loadPresets, deletePreset, Preset } from '../services/storage';
import { COLORS } from '../utils/theme';

export default function SettingsScreen() {
  const [serverUrl, setServerUrlState] = useState('http://192.168.1.10:8000');
  const [checking, setChecking] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);

  useEffect(() => {
    getServerUrl().then(setServerUrlState);
    loadPresets().then(setPresets);
  }, []);

  const handleSaveUrl = async () => {
    if (!serverUrl.startsWith('http')) {
      Alert.alert('Invalid URL', 'URL must start with http:// or https://');
      return;
    }
    await setServerUrl(serverUrl);
    Toast.show({ type: 'success', text1: 'Server URL saved!' });
  };

  const handleTestConnection = async () => {
    setChecking(true);
    const ok = await healthCheck();
    setChecking(false);
    if (ok) {
      Toast.show({ type: 'success', text1: 'Connected!', text2: 'Backend is reachable.' });
    } else {
      Alert.alert(
        'Connection Failed',
        `Cannot reach ${serverUrl}\n\nMake sure:\n1. FastAPI backend is running\n2. Stable Diffusion WebUI is running with --api --listen\n3. Your device is on the same network`,
      );
    }
  };

  const handleDeletePreset = (id: string) => {
    Alert.alert('Delete Preset', 'Delete this preset?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deletePreset(id);
          setPresets(prev => prev.filter(p => p.id !== id));
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      {/* ── Server Configuration ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Backend Server</Text>
        <Text style={styles.hint}>
          Enter the local IP address of the machine running the FastAPI backend.
          Do NOT use localhost or 127.0.0.1.
        </Text>
        <TextInput
          style={styles.input}
          value={serverUrl}
          onChangeText={setServerUrlState}
          placeholder="http://192.168.1.10:8000"
          placeholderTextColor={COLORS.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} onPress={handleSaveUrl}>
            <Text style={styles.btnText}>Save URL</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.testBtn]}
            onPress={handleTestConnection}
            disabled={checking}
          >
            <Text style={styles.btnText}>{checking ? 'Testing...' : 'Test Connection'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Presets ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Saved Presets</Text>
        {presets.length === 0 ? (
          <Text style={styles.emptyText}>No presets saved yet.</Text>
        ) : (
          presets.map(preset => (
            <View key={preset.id} style={styles.presetItem}>
              <View style={styles.presetInfo}>
                <Text style={styles.presetName}>{preset.name}</Text>
                <Text style={styles.presetPrompt} numberOfLines={2}>
                  {preset.prompt}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDeletePreset(preset.id)}
              >
                <Text style={styles.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      {/* ── About ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.aboutText}>
          Local AI Image Editor v1.0.0{'\n'}
          All processing is performed locally.{'\n'}
          No external AI APIs are used.{'\n'}
          Powered by Stable Diffusion (Automatic1111).
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 20,
  },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 10,
  },
  hint: {
    fontSize: 12,
    color: COLORS.placeholder,
    marginBottom: 10,
    lineHeight: 18,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  testBtn: {
    backgroundColor: COLORS.accent,
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyText: {
    color: COLORS.placeholder,
    fontSize: 13,
    fontStyle: 'italic',
  },
  presetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  presetInfo: {
    flex: 1,
  },
  presetName: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 14,
  },
  presetPrompt: {
    color: COLORS.placeholder,
    fontSize: 12,
    marginTop: 2,
  },
  deleteBtn: {
    backgroundColor: '#c0392b',
    borderRadius: 6,
    padding: 8,
    marginLeft: 10,
  },
  deleteBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  aboutText: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 22,
  },
});
