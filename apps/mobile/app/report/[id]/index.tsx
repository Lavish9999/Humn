import { useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { mobileSupabase } from '@human/database/mobile';
import { colors, radii, spacing } from '../../../src/theme';

const reasons = [
  ['suspected_ai', 'Suspected AI-generated content'],
  ['undisclosed_ai', 'Undisclosed AI alteration'],
  ['stolen_work', 'Stolen work'],
  ['misleading_claim', 'Misleading real-world claim'],
  ['copyright', 'Copyright infringement'],
  ['spam', 'Spam or scam'],
  ['other', 'Other'],
] as const;

export default function ReportWork() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [reason, setReason] = useState<(typeof reasons)[number][0]>('suspected_ai');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (details.trim().length < 10) return Alert.alert('Add more detail', 'Explain what you noticed so a moderator can assess it.');
    setBusy(true);
    const { error } = await mobileSupabase.functions.invoke('create-report', { body: { workId: id, reason, details: details.trim() } });
    setBusy(false);
    if (error) return Alert.alert('Report failed', error.message);
    Alert.alert('Report received', 'The Work will not be automatically removed. A trust-and-safety review can now evaluate the evidence.', [{ text: 'Done', onPress: () => router.back() }]);
  }

  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
    <Text style={{ fontSize: 34, fontWeight: '800' }}>Report a concern</Text>
    <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>Reports route to a moderation case. Coordinated reports do not automatically remove content.</Text>
    <View style={{ gap: 8 }}>{reasons.map(([value, label]) => <Pressable key={value} onPress={() => setReason(value)} style={{ borderWidth: 1, borderColor: reason === value ? colors.accent : colors.border, backgroundColor: reason === value ? colors.accent : colors.surface, borderRadius: radii.control, padding: 13 }}><Text style={{ color: reason === value ? 'white' : colors.text, fontWeight: '700' }}>{label}</Text></Pressable>)}</View>
    <TextInput value={details} onChangeText={setDetails} multiline maxLength={4000} placeholder="Explain why this may violate the policy…" style={{ minHeight: 150, textAlignVertical: 'top', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.control, padding: 15 }} />
    <Pressable disabled={busy} onPress={submit} style={{ backgroundColor: colors.accent, borderRadius: radii.control, padding: 16, alignItems: 'center', opacity: busy ? .7 : 1 }}><Text style={{ color: 'white', fontWeight: '800' }}>{busy ? 'Submitting…' : 'Submit report'}</Text></Pressable>
  </ScrollView></SafeAreaView>;
}
