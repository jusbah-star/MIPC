import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, radii } from '../theme';
import type { Profile } from '../types';

const roleCopy: Record<Profile['role'], string> = {
  student: 'Courses, learning materials and examinations in one mobile workspace.',
  lecturer: 'Teaching activity, course resources and assessment visibility from your phone.',
  hod: 'Department teaching oversight with your academic workspace close at hand.',
  registrar: 'Registration and academic administration visibility for the Registrar.',
  finance: 'Student finance oversight through the authenticated MIPC campus account.',
  admin: 'Principal and administrator oversight across the MIPC digital campus.'
};

type Announcement = { id: string; title: string; body: string; published_at: string };

export function HomeScreen({ profile }: { profile: Profile }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const { data } = await supabase
      .from('announcements')
      .select('id, title, body, published_at')
      .order('published_at', { ascending: false })
      .limit(5);
    setAnnouncements((data || []) as Announcement[]);
  }

  useEffect(() => { void load(); }, []);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.green700} />}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>MIPC MOBILE</Text>
        <Text style={styles.welcome}>Welcome, {profile.full_name.split(' ')[0] || profile.full_name}</Text>
        <Text style={styles.heroCopy}>{roleCopy[profile.role]}</Text>
        <View style={styles.rolePill}><Text style={styles.rolePillText}>{profile.role.toUpperCase()}</Text></View>
      </View>

      <Text style={styles.sectionTitle}>Campus announcements</Text>
      {announcements.length ? announcements.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardBody} numberOfLines={4}>{item.body}</Text>
          <Text style={styles.cardMeta}>{new Date(item.published_at).toLocaleDateString()}</Text>
        </View>
      )) : (
        <View style={styles.empty}><Text style={styles.emptyText}>No announcements are available for your account right now.</Text></View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream50 },
  content: { padding: 18, paddingBottom: 36 },
  hero: { backgroundColor: colors.navy950, borderRadius: radii.lg, padding: 22, marginBottom: 24 },
  eyebrow: { color: '#91bca0', fontWeight: '800', letterSpacing: 1.6, fontSize: 11 },
  welcome: { color: colors.white, fontSize: 27, lineHeight: 33, fontWeight: '800', marginTop: 8 },
  heroCopy: { color: '#d7e0e8', fontSize: 14, lineHeight: 21, marginTop: 8 },
  rolePill: { alignSelf: 'flex-start', backgroundColor: colors.green700, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10, marginTop: 16 },
  rolePillText: { color: colors.white, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  sectionTitle: { color: colors.navy950, fontSize: 19, fontWeight: '800', marginBottom: 12 },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, padding: 16, marginBottom: 10 },
  cardTitle: { color: colors.navy950, fontSize: 15, fontWeight: '800' },
  cardBody: { color: colors.ink600, fontSize: 13, lineHeight: 20, marginTop: 6 },
  cardMeta: { color: colors.ink400, fontSize: 11, marginTop: 10 },
  empty: { backgroundColor: colors.white, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, padding: 18 },
  emptyText: { color: colors.ink600, lineHeight: 21 }
});
