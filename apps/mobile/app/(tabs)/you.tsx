import { useState } from 'react';
import { Alert, Pressable, SafeAreaView, Share, Text, View } from 'react-native';
import { mobileSupabase } from '@human/database/mobile';
import { colors, radii, spacing } from '../../src/theme';

export default function You() {
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null);

  async function exportData() {
    setBusy('export');
    const { data, error } = await mobileSupabase.functions.invoke('export-user-data');
    setBusy(null);
    if (error) return Alert.alert('Export failed', error.message);
    await Share.share({ message: JSON.stringify(data?.data ?? data, null, 2), title: 'Humn account export' });
  }

  function confirmDelete() {
    Alert.alert(
      'Delete your account?',
      'This permanently removes your profile, Works, Collections, private evidence, sessions, and account access. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: async () => {
            setBusy('delete');
            const { error } = await mobileSupabase.functions.invoke('delete-account');
            setBusy(null);
            if (error) Alert.alert('Deletion failed', error.message);
            else await mobileSupabase.auth.signOut();
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <Text style={{ fontSize: 34, fontWeight: '800' }}>You</Text>
        <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>
          Profile, Studio, privacy, verification history, subscriptions, exports, and account controls.
        </Text>
        <Pressable onPress={exportData} disabled={busy !== null} style={{ padding: 15, borderRadius: radii.control, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontWeight: '700' }}>{busy === 'export' ? 'Preparing export…' : 'Export my data'}</Text>
        </Pressable>
        <Pressable onPress={() => mobileSupabase.auth.signOut()} disabled={busy !== null} style={{ padding: 15, borderRadius: radii.control, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontWeight: '700' }}>Sign out</Text>
        </Pressable>
        <Pressable onPress={confirmDelete} disabled={busy !== null} style={{ padding: 15, borderRadius: radii.control, borderWidth: 1, borderColor: colors.danger }}>
          <Text style={{ fontWeight: '800', color: colors.danger }}>{busy === 'delete' ? 'Deleting…' : 'Delete account permanently'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
