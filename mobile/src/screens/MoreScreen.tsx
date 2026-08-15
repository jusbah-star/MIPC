import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '../theme';
import type { Profile } from '../types';

const webPaths: Record<Profile['role'], string> = {
  student: '/student',
  lecturer: '/lecturer',
  hod: '/hod',
  registrar: '/registrar',
  finance: '/finance',
  admin: '/admin'
};

export function MoreScreen({ profile, onSignOut }: { profile: Profile; onSignOut: () => Promise<void> }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Account</Text>
      <View style={styles.profileCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{profile.full_name.slice(0, 1).toUpperCase()}</Text></View>
        <View style={styles.profileText}>
          <Text style={styles.name}>{profile.full_name}</Text>
          <Text style={styles.email}>{profile.email}</Text>
          <Text style={styles.role}>{profile.role.toUpperCase()}</Text>
        </View>
      </View>

      {!!profile.registration_number && <Info label="Registration number" value={profile.registration_number} />}
      {!!profile.year_of_study && <Info label="Year of study" value={`Year ${profile.year_of_study}`} />}

      <Pressable
        style={styles.action}
        onPress={() => void Linking.openURL(`https://mipc-rosy.vercel.app${webPaths[profile.role]}`)}
      >
        <Text style={styles.actionTitle}>Open full web workspace</Text>
        <Text style={styles.actionBody}>Use the production portal for advanced workflows that are not native yet.</Text>
      </Pressable>

      <Pressable style={[styles.action, styles.signOut]} onPress={() => void onSignOut()}>
        <Text style={[styles.actionTitle, styles.signOutText]}>Sign out</Text>
      </Pressable>

      <Text style={styles.version}>MIPC Digital Campus mobile · 0.1.0</Text>
    </ScrollView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream50 },
  content: { padding: 18, paddingBottom: 36 },
  title: { color: colors.navy950, fontSize: 25, fontWeight: '800', marginBottom: 16 },
  profileCard: { backgroundColor: colors.navy950, borderRadius: radii.lg, padding: 18, flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.green700, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontWeight: '900', fontSize: 21 },
  profileText: { flex: 1, marginLeft: 13 },
  name: { color: colors.white, fontWeight: '800', fontSize: 16 },
  email: { color: '#d7e0e8', fontSize: 12, marginTop: 3 },
  role: { color: '#91bca0', fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginTop: 7 },
  info: { backgroundColor: colors.white, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, padding: 14, marginBottom: 10 },
  infoLabel: { color: colors.ink400, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  infoValue: { color: colors.navy950, fontSize: 14, fontWeight: '700', marginTop: 5 },
  action: { backgroundColor: colors.white, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, padding: 16, marginTop: 4, marginBottom: 10 },
  actionTitle: { color: colors.navy950, fontWeight: '800' },
  actionBody: { color: colors.ink600, fontSize: 12, lineHeight: 18, marginTop: 4 },
  signOut: { borderColor: '#efc7c4' },
  signOutText: { color: colors.danger },
  version: { color: colors.ink400, fontSize: 10, textAlign: 'center', marginTop: 14 }
});
