/**
 * GenerateScreen
 * Main screen for image-to-image generation.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
  PermissionsAndroid,
  Share,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { launchCamera, launchImageLibrary, MediaType } from 'react-native-image-picker';
import { Picker } from '@react-native-picker/picker';
import Toast from 'react-native-toast-message';

import { generateImage, fetchModels, fetchSamplers, SDModel } from '../services/api';
import { saveGeneratedImage } from '../services/storage';
import { COLORS, FONTS } from '../utils/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Params {
  prompt: string;
  negative_prompt: string;
  denoising_strength: number;
  cfg_scale: number;
  steps: number;
  sampler: string;
  checkpoint: string;
  width: number;
  height: number;
  restore_faces: boolean;
  use_controlnet: boolean;
  enable_hr: boolean;
  hr_scale: number;
}

const DEFAULT_PARAMS: Params = {
  prompt: '',
  negative_prompt: 'blurry, low quality, deformed, ugly',
  denoising_strength: 0.5,
  cfg_scale: 7,
  steps: 20,
  sampler: 'Euler a',
  checkpoint: '',
  width: 512,
  height: 512,
  restore_faces: false,
  use_controlnet: false,
  enable_hr: false,
  hr_scale: 2.0,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function GenerateScreen() {
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/jpeg');
  const [resultBase64, setResultBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<SDModel[]>([]);
  const [samplers, setSamplers] = useState<string[]>(['Euler a', 'DPM++ 2M Karras', 'DDIM']);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Load models and samplers on mount
  useEffect(() => {
    (async () => {
      try {
        const [m, s] = await Promise.all([fetchModels(), fetchSamplers()]);
        setModels(m);
        if (s.length > 0) setSamplers(s);
      } catch {
        // Server may not be running yet – silently ignore
      }
    })();
  }, []);

  const updateParam = <K extends keyof Params>(key: K, value: Params[K]) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  // ─── Permissions ─────────────────────────────────────────────────────────

  const requestStoragePermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    try {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      ]);
      return (
        granted[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE] === 'granted' &&
        granted[PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE] === 'granted'
      );
    } catch {
      return false;
    }
  };

  const requestCameraPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
      );
      return granted === 'granted';
    } catch {
      return false;
    }
  };

  // ─── Image Picker ─────────────────────────────────────────────────────────

  const pickFromGallery = async () => {
    const ok = await requestStoragePermission();
    if (!ok) {
      Alert.alert('Permission Required', 'Storage permission is needed to pick images.');
      return;
    }
    launchImageLibrary(
      { mediaType: 'photo' as MediaType, quality: 1 },
      response => {
        if (response.assets && response.assets[0]) {
          const asset = response.assets[0];
          setImageUri(asset.uri ?? null);
          setImageMime(asset.type ?? 'image/jpeg');
          setResultBase64(null);
        }
      },
    );
  };

  const pickFromCamera = async () => {
    const ok = await requestCameraPermission();
    if (!ok) {
      Alert.alert('Permission Required', 'Camera permission is needed.');
      return;
    }
    launchCamera(
      { mediaType: 'photo' as MediaType, quality: 1, saveToPhotos: false },
      response => {
        if (response.assets && response.assets[0]) {
          const asset = response.assets[0];
          setImageUri(asset.uri ?? null);
          setImageMime(asset.type ?? 'image/jpeg');
          setResultBase64(null);
        }
      },
    );
  };

  const showImagePicker = () => {
    Alert.alert('Select Image', 'Choose image source', [
      { text: 'Camera', onPress: pickFromCamera },
      { text: 'Gallery', onPress: pickFromGallery },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ─── Generate ─────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!imageUri) {
      Alert.alert('No Image', 'Please upload an image first.');
      return;
    }
    if (!params.prompt.trim()) {
      Alert.alert('No Prompt', 'Please enter a prompt.');
      return;
    }

    setLoading(true);
    setResultBase64(null);

    try {
      const b64 = await generateImage({
        ...params,
        imageUri,
        imageMime,
      });
      setResultBase64(b64);
      Toast.show({ type: 'success', text1: 'Image generated!' });
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ??
        err?.message ??
        'Unknown error';
      Alert.alert('Generation Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  // ─── Save / Share ─────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!resultBase64) return;
    const ok = await requestStoragePermission();
    if (!ok) {
      Alert.alert('Permission Required', 'Storage permission needed to save.');
      return;
    }
    try {
      await saveGeneratedImage(resultBase64, params.prompt);
      Toast.show({ type: 'success', text1: 'Image saved to Pictures/LocalAI/' });
    } catch (err: any) {
      Alert.alert('Save Failed', err?.message ?? 'Unknown error');
    }
  };

  const handleShare = async () => {
    if (!resultBase64) return;
    try {
      await Share.share({ message: 'Generated by Local AI Editor', url: `data:image/jpeg;base64,${resultBase64}` });
    } catch (err: any) {
      Alert.alert('Share Failed', err?.message ?? 'Unknown error');
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── Header ── */}
      <Text style={styles.title}>Local AI Image Editor</Text>

      {/* ── Prompt ── */}
      <Text style={styles.label}>Prompt</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        multiline
        numberOfLines={4}
        placeholder="Describe what you want..."
        placeholderTextColor={COLORS.placeholder}
        value={params.prompt}
        onChangeText={v => updateParam('prompt', v)}
      />

      <Text style={styles.label}>Negative Prompt</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        multiline
        numberOfLines={3}
        placeholder="What to avoid..."
        placeholderTextColor={COLORS.placeholder}
        value={params.negative_prompt}
        onChangeText={v => updateParam('negative_prompt', v)}
      />

      {/* ── Image Input ── */}
      <Text style={styles.label}>Input Image</Text>
      <TouchableOpacity style={styles.uploadBtn} onPress={showImagePicker}>
        <Text style={styles.uploadBtnText}>
          {imageUri ? '✓ Image Selected – Tap to Change' : '📷 Upload Image'}
        </Text>
      </TouchableOpacity>
      {imageUri && (
        <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
      )}

      {/* ── Sliders ── */}
      <Text style={styles.label}>
        Denoising Strength: {params.denoising_strength.toFixed(2)}
      </Text>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={1}
        step={0.01}
        value={params.denoising_strength}
        onValueChange={v => updateParam('denoising_strength', parseFloat(v.toFixed(2)))}
        minimumTrackTintColor={COLORS.primary}
        maximumTrackTintColor={COLORS.border}
        thumbTintColor={COLORS.primary}
      />

      <Text style={styles.label}>CFG Scale: {params.cfg_scale.toFixed(1)}</Text>
      <Slider
        style={styles.slider}
        minimumValue={1}
        maximumValue={20}
        step={0.5}
        value={params.cfg_scale}
        onValueChange={v => updateParam('cfg_scale', parseFloat(v.toFixed(1)))}
        minimumTrackTintColor={COLORS.primary}
        maximumTrackTintColor={COLORS.border}
        thumbTintColor={COLORS.primary}
      />

      <Text style={styles.label}>Steps: {params.steps}</Text>
      <Slider
        style={styles.slider}
        minimumValue={1}
        maximumValue={50}
        step={1}
        value={params.steps}
        onValueChange={v => updateParam('steps', Math.round(v))}
        minimumTrackTintColor={COLORS.primary}
        maximumTrackTintColor={COLORS.border}
        thumbTintColor={COLORS.primary}
      />

      {/* ── Sampler ── */}
      <Text style={styles.label}>Sampler</Text>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={params.sampler}
          onValueChange={v => updateParam('sampler', v)}
          style={styles.picker}
          dropdownIconColor={COLORS.text}
        >
          {samplers.map(s => (
            <Picker.Item key={s} label={s} value={s} color={COLORS.text} />
          ))}
        </Picker>
      </View>

      {/* ── Model Selector ── */}
      <Text style={styles.label}>Model Checkpoint</Text>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={params.checkpoint}
          onValueChange={v => updateParam('checkpoint', v)}
          style={styles.picker}
          dropdownIconColor={COLORS.text}
        >
          <Picker.Item label="(current model)" value="" color={COLORS.placeholder} />
          {models.map(m => (
            <Picker.Item key={m.model_name} label={m.title} value={m.title} color={COLORS.text} />
          ))}
        </Picker>
      </View>

      {/* ── Advanced Options ── */}
      <TouchableOpacity
        style={styles.advancedToggle}
        onPress={() => setShowAdvanced(v => !v)}
      >
        <Text style={styles.advancedToggleText}>
          {showAdvanced ? '▲ Hide Advanced Options' : '▼ Show Advanced Options'}
        </Text>
      </TouchableOpacity>

      {showAdvanced && (
        <View style={styles.advancedSection}>
          {/* Output size */}
          <Text style={styles.label}>Output Width: {params.width}px</Text>
          <Slider
            style={styles.slider}
            minimumValue={256}
            maximumValue={1024}
            step={64}
            value={params.width}
            onValueChange={v => updateParam('width', Math.round(v))}
            minimumTrackTintColor={COLORS.accent}
            maximumTrackTintColor={COLORS.border}
            thumbTintColor={COLORS.accent}
          />

          <Text style={styles.label}>Output Height: {params.height}px</Text>
          <Slider
            style={styles.slider}
            minimumValue={256}
            maximumValue={1024}
            step={64}
            value={params.height}
            onValueChange={v => updateParam('height', Math.round(v))}
            minimumTrackTintColor={COLORS.accent}
            maximumTrackTintColor={COLORS.border}
            thumbTintColor={COLORS.accent}
          />

          {/* Toggles */}
          <ToggleRow
            label="Face Enhancement (Restore Faces)"
            value={params.restore_faces}
            onToggle={v => updateParam('restore_faces', v)}
          />
          <ToggleRow
            label="ControlNet (Face Preservation)"
            value={params.use_controlnet}
            onToggle={v => updateParam('use_controlnet', v)}
          />
          <ToggleRow
            label="High-Resolution Upscaling"
            value={params.enable_hr}
            onToggle={v => updateParam('enable_hr', v)}
          />

          {params.enable_hr && (
            <>
              <Text style={styles.label}>Upscale Factor: {params.hr_scale.toFixed(1)}x</Text>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={4}
                step={0.5}
                value={params.hr_scale}
                onValueChange={v => updateParam('hr_scale', parseFloat(v.toFixed(1)))}
                minimumTrackTintColor={COLORS.accent}
                maximumTrackTintColor={COLORS.border}
                thumbTintColor={COLORS.accent}
              />
            </>
          )}
        </View>
      )}

      {/* ── Generate Button ── */}
      <TouchableOpacity
        style={[styles.generateBtn, loading && styles.generateBtnDisabled]}
        onPress={handleGenerate}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.generateBtnText}>Generate Image</Text>
        )}
      </TouchableOpacity>

      {loading && (
        <Text style={styles.loadingHint}>
          Processing... This may take up to 60 seconds.
        </Text>
      )}

      {/* ── Result ── */}
      {resultBase64 && (
        <View style={styles.resultSection}>
          <Text style={styles.label}>Generated Image</Text>
          <Image
            source={{ uri: `data:image/jpeg;base64,${resultBase64}` }}
            style={styles.resultImage}
            resizeMode="contain"
          />
          <View style={styles.resultActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleSave}>
              <Text style={styles.actionBtnText}>💾 Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.shareBtn]} onPress={handleShare}>
              <Text style={styles.actionBtnText}>📤 Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Sub-component: Toggle Row ────────────────────────────────────────────────

function ToggleRow({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <TouchableOpacity style={styles.toggleRow} onPress={() => onToggle(!value)}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={[styles.toggleIndicator, value && styles.toggleIndicatorOn]}>
        <Text style={styles.toggleText}>{value ? 'ON' : 'OFF'}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    color: COLORS.text,
    marginTop: 14,
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  uploadBtn: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    paddingVertical: 16,
    alignItems: 'center',
  },
  uploadBtnText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  previewImage: {
    width: '100%',
    height: 220,
    borderRadius: 8,
    marginTop: 10,
    backgroundColor: COLORS.surface,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  pickerWrapper: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  picker: {
    color: COLORS.text,
    height: 50,
  },
  advancedToggle: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 8,
  },
  advancedToggleText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  advancedSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  toggleLabel: {
    color: COLORS.text,
    fontSize: 14,
    flex: 1,
  },
  toggleIndicator: {
    backgroundColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  toggleIndicatorOn: {
    backgroundColor: COLORS.primary,
  },
  toggleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  generateBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  generateBtnDisabled: {
    opacity: 0.6,
  },
  generateBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  loadingHint: {
    textAlign: 'center',
    color: COLORS.placeholder,
    marginTop: 10,
    fontSize: 13,
  },
  resultSection: {
    marginTop: 24,
  },
  resultImage: {
    width: '100%',
    height: 320,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
  },
  resultActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
  },
  actionBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  shareBtn: {
    backgroundColor: COLORS.accent,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
