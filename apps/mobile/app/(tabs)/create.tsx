import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import { Image } from 'expo-image';
import { mobileSupabase } from '@human/database/mobile';
import { colors, radii, spacing } from '../../src/theme';

type Category = { id: string; name: string };

export default function Create() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    mobileSupabase
      .from('categories')
      .select('id,name')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        const rows = data ?? [];
        setCategories(rows);
        if (rows[0]) setCategoryId(rows[0].id);
      });
  }, []);

  async function chooseImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access is needed', 'Allow photo access to attach your original work.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
      exif: true,
    });
    if (!result.canceled) setAsset(result.assets[0] ?? null);
  }

  async function saveDraft() {
    if (!title.trim() || !categoryId || !asset) {
      Alert.alert('Draft is incomplete', 'Add a title, category, and image.');
      return;
    }

    setBusy(true);
    try {
      const { data: authData, error: authError } = await mobileSupabase.auth.getUser();
      if (authError || !authData.user) throw authError ?? new Error('Sign in again.');

      const { data: work, error: workError } = await mobileSupabase
        .from('works')
        .insert({
          creator_id: authData.user.id,
          primary_category_id: categoryId,
          title: title.trim(),
          description: description.trim() || null,
          status: 'draft',
        })
        .select('id')
        .single();
      if (workError) throw workError;

      const response = await fetch(asset.uri);
      const bytes = await response.arrayBuffer();
      const contentType = asset.mimeType || 'image/jpeg';
      const fileName = asset.fileName || `original-${Crypto.randomUUID()}.jpg`;

      const { data: sessionResult, error: sessionError } = await mobileSupabase.functions.invoke('create-upload-session', {
        body: { workId: work.id, fileName, mimeType: contentType, sizeBytes: bytes.byteLength },
      });
      if (sessionError) throw sessionError;
      const uploadSession = sessionResult?.data;
      if (!uploadSession?.path || !uploadSession?.token) throw new Error('Upload session was incomplete.');

      const { error: uploadError } = await mobileSupabase.storage
        .from(uploadSession.bucket)
        .uploadToSignedUrl(uploadSession.path, uploadSession.token, bytes, { contentType });
      if (uploadError) throw uploadError;

      const { error: finalizeError } = await mobileSupabase.functions.invoke('finalize-upload', {
        body: {
          workId: work.id,
          path: uploadSession.path,
          mediaType: 'image',
          mimeType: contentType,
          width: asset.width,
          height: asset.height,
          sourceType: 'camera_library',
        },
      });
      if (finalizeError) throw finalizeError;

      setTitle('');
      setDescription('');
      setAsset(null);
      Alert.alert('Draft saved', 'Your original file is stored privately and the Work can be resumed later.');
    } catch (error) {
      Alert.alert('Draft could not be saved', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <Text style={{ fontSize: 13, color: colors.accent, fontWeight: '800' }}>CREATE</Text>
        <Text style={{ fontSize: 34, fontWeight: '800', letterSpacing: -1.2 }}>Start a real Work.</Text>
        <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>
          This saves a private, resumable draft. Publishing remains blocked until origin declaration and evidence requirements are complete.
        </Text>

        <Pressable
          onPress={chooseImage}
          style={{
            minHeight: 210,
            borderRadius: radii.card,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: colors.border,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {asset ? (
            <Image source={asset.uri} style={{ width: '100%', height: 300 }} contentFit="cover" />
          ) : (
            <Text style={{ color: colors.accent, fontWeight: '800' }}>Choose original image</Text>
          )}
        </Pressable>

        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Work title"
          maxLength={160}
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.control, padding: 15 }}
        />
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the work and process"
          maxLength={5000}
          multiline
          style={{ minHeight: 120, textAlignVertical: 'top', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.control, padding: 15 }}
        />

        <Text style={{ fontWeight: '800' }}>Category</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {categories.map((category) => {
            const selected = category.id === categoryId;
            return (
              <Pressable
                key={category.id}
                onPress={() => setCategoryId(category.id)}
                style={{
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: selected ? colors.accent : colors.border,
                  backgroundColor: selected ? colors.accent : colors.surface,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                }}
              >
                <Text style={{ color: selected ? 'white' : colors.text, fontWeight: '700' }}>{category.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          disabled={busy}
          onPress={saveDraft}
          style={{ backgroundColor: colors.accent, borderRadius: radii.control, padding: 16, alignItems: 'center', opacity: busy ? 0.7 : 1 }}
        >
          {busy ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: '800' }}>Save private draft</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
