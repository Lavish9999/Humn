import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, Share, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { mobileSupabase } from '@human/database/mobile';
import { colors, radii, spacing } from '../../../src/theme';

type Work = {
  id: string;
  title: string;
  description: string | null;
  creator_id: string;
  creator_name: string;
  creator_username: string;
  origin_status: string;
  media_url: string;
  width: number;
  height: number;
  alt_text: string | null;
};

export default function WorkDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [work, setWork] = useState<Work | null>(null);
  const [saved, setSaved] = useState(false);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const { data } = await mobileSupabase.from('discover_works').select('*').eq('id', id).maybeSingle();
      setWork(data);
      const { data: auth } = await mobileSupabase.auth.getUser();
      if (!auth.user || !data) return;
      const [save, follow] = await Promise.all([
        mobileSupabase.from('work_saves').select('work_id').eq('work_id', id).eq('user_id', auth.user.id).maybeSingle(),
        mobileSupabase.from('follows').select('creator_id').eq('creator_id', data.creator_id).eq('follower_id', auth.user.id).maybeSingle(),
      ]);
      setSaved(Boolean(save.data));
      setFollowing(Boolean(follow.data));
    })();
  }, [id]);

  async function toggleSave() {
    if (!work) return;
    setBusy(true);
    const { data: auth } = await mobileSupabase.auth.getUser();
    if (!auth.user) return router.replace('/auth');
    const result = saved
      ? await mobileSupabase.from('work_saves').delete().eq('user_id', auth.user.id).eq('work_id', work.id)
      : await mobileSupabase.from('work_saves').insert({ user_id: auth.user.id, work_id: work.id });
    setBusy(false);
    if (result.error) Alert.alert('Save failed', result.error.message);
    else setSaved(!saved);
  }

  async function toggleFollow() {
    if (!work) return;
    const { data: auth } = await mobileSupabase.auth.getUser();
    if (!auth.user) return router.replace('/auth');
    const result = following
      ? await mobileSupabase.from('follows').delete().eq('follower_id', auth.user.id).eq('creator_id', work.creator_id)
      : await mobileSupabase.from('follows').insert({ follower_id: auth.user.id, creator_id: work.creator_id });
    if (result.error) Alert.alert('Follow failed', result.error.message);
    else setFollowing(!following);
  }

  if (!work) {
    return <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}><ActivityIndicator /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView>
        <Image source={work.media_url} accessibilityLabel={work.alt_text ?? work.title} style={{ width: '100%', aspectRatio: work.width / work.height }} contentFit="cover" />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Text style={{ color: colors.verified, fontWeight: '800', textTransform: 'capitalize' }}>{work.origin_status.replaceAll('_', ' ')}</Text>
          <Text style={{ fontSize: 34, fontWeight: '800', letterSpacing: -1.2, color: colors.text }}>{work.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <View><Text style={{ fontWeight: '800' }}>{work.creator_name}</Text><Text style={{ color: colors.textSecondary }}>@{work.creator_username}</Text></View>
            <Pressable onPress={toggleFollow} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radii.control, paddingHorizontal: 14, paddingVertical: 10 }}><Text style={{ fontWeight: '800' }}>{following ? 'Following' : 'Follow'}</Text></Pressable>
          </View>
          {work.description && <Text style={{ color: colors.textSecondary, fontSize: 16, lineHeight: 24 }}>{work.description}</Text>}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable disabled={busy} onPress={toggleSave} style={{ flex: 1, backgroundColor: colors.accent, borderRadius: radii.control, padding: 15, alignItems: 'center' }}><Text style={{ color: 'white', fontWeight: '800' }}>{saved ? 'Saved' : 'Save'}</Text></Pressable>
            <Pressable onPress={() => Share.share({ message: `${work.title} by @${work.creator_username}` })} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radii.control, padding: 15 }}><Text style={{ fontWeight: '800' }}>Share</Text></Pressable>
          </View>
          <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.card, padding: spacing.md, gap: 8 }}>
            <Text style={{ fontWeight: '800' }}>Origin Status</Text>
            <Text style={{ color: colors.textSecondary, lineHeight: 21 }}>Verification reflects available evidence and platform review. It is not an absolute guarantee.</Text>
          </View>
          <Pressable onPress={() => router.push(`/report/${work.id}`)} style={{ paddingVertical: 12 }}><Text style={{ color: colors.danger, fontWeight: '700' }}>Report this Work</Text></Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
