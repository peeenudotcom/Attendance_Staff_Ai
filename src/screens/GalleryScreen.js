import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, FlatList, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SHADOWS, RADIUS, SPACING, FONTS } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';

export default function GalleryScreen() {
  const { colors: C } = useTheme();
  const [images, setImages] = useState([]);

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return Alert.alert('Permission Required', 'Gallery access is needed to upload photos');
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      const newImages = result.assets.map((asset, idx) => ({
        id: Date.now().toString() + idx,
        uri: asset.uri,
        timestamp: new Date().toISOString(),
        type: 'gallery',
        caption: '',
      }));
      setImages([...newImages, ...images]);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      return Alert.alert('Permission Required', 'Camera access is needed');
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) {
      setImages([{
        id: Date.now().toString(),
        uri: result.assets[0].uri,
        timestamp: new Date().toISOString(),
        type: 'camera',
        caption: '',
      }, ...images]);
    }
  };

  const uploadAll = () => {
    Alert.alert('Upload', `${images.length} photos will be synced to TARAhut CRM`);
  };

  const renderItem = ({ item }) => (
    <View style={[styles.imageCard, { backgroundColor: C.bgCard, borderColor: C.border }]}>
      <Image source={{ uri: item.uri }} style={styles.image} />
      <View style={styles.imageInfo}>
        <Text style={[styles.imageType, { color: C.textSecondary }]}>{item.type === 'camera' ? '📷 Camera' : '🖼️ Gallery'}</Text>
        <Text style={[styles.imageTime, { color: C.textMuted }]}>
          {new Date(item.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: C.textPrimary }]}>Gallery & Uploads</Text>
          <Text style={[styles.subtitle, { color: C.textMuted }]}>Proof of work & site photos</Text>
        </View>
        {images.length > 0 && (
          <TouchableOpacity style={[styles.uploadButton, { backgroundColor: C.accentSoft, borderColor: C.accentBorder }]} onPress={uploadAll}>
            <Text style={[styles.uploadText, { color: C.textAccent }]}>Upload All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.actionButton, { backgroundColor: C.bgCard, borderColor: C.border }]} onPress={takePhoto}>
          <Text style={styles.actionIcon}>📷</Text>
          <Text style={[styles.actionLabel, { color: C.textPrimary }]}>Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, { backgroundColor: C.bgCard, borderColor: C.border }]} onPress={pickFromGallery}>
          <Text style={styles.actionIcon}>🖼️</Text>
          <Text style={[styles.actionLabel, { color: C.textPrimary }]}>From Gallery</Text>
        </TouchableOpacity>
      </View>

      {images.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📸</Text>
          <Text style={[styles.emptyText, { color: C.textPrimary }]}>No photos yet</Text>
          <Text style={[styles.emptySubtext, { color: C.textMuted }]}>Take a photo or pick from gallery</Text>
        </View>
      ) : (
        <FlatList
          data={images}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={2}
          contentContainerStyle={{ padding: 12 }}
          columnWrapperStyle={{ gap: 8 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingTop: 64, paddingBottom: 8 },
  title: { ...FONTS.h1, fontSize: 26 },
  subtitle: { ...FONTS.small, color: COLORS.textMuted, marginTop: 4 },
  uploadButton: { backgroundColor: COLORS.accentSoft, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.accentBorder },
  uploadText: { fontSize: 12, fontWeight: '600', color: COLORS.textAccent },
  actionRow: { flexDirection: 'row', padding: SPACING.xl, gap: 12 },
  actionButton: { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  actionIcon: { fontSize: 28 },
  actionLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginTop: 8 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, opacity: 0.5 },
  emptyText: { fontSize: 18, fontWeight: '600', color: COLORS.textPrimary, marginTop: 12 },
  emptySubtext: { fontSize: 14, color: COLORS.textMuted, marginTop: 4 },
  imageCard: { flex: 1, margin: 4, borderRadius: RADIUS.sm, overflow: 'hidden', backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border },
  image: { width: '100%', height: 150 },
  imageInfo: { flexDirection: 'row', justifyContent: 'space-between', padding: 8 },
  imageType: { fontSize: 11, color: COLORS.textSecondary },
  imageTime: { fontSize: 11, color: COLORS.textMuted },
});
