import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/auth';
import { mobileConfig } from './src/lib/supabase';
import { colors } from './src/theme';
import { LoginScreen } from './src/screens/LoginScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { CoursesScreen } from './src/screens/CoursesScreen';
import { ExamsScreen } from './src/screens/ExamsScreen';
import { MoreScreen } from './src/screens/MoreScreen';

type Tab = 'home' | 'courses' | 'exams' | 'more';

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'courses', label: 'Courses' },
  { id: 'exams', label: 'Exams' },
  { id: 'more', label: 'More' }
];

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <MobileRoot />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function MobileRoot() {
  const { loading, session, profile, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('home');

  if (!mobileConfig.configured) {
    return (
      <SafeAreaView style={styles.setup}>
        <Text style={styles.setupTitle}>Mobile configuration required</Text>
        <Text style={styles.setupBody}>Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY from the MIPC Supabase project before starting the app.</Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={colors.green700} /></View>;
  }

  if (!session || !profile) return <LoginScreen />;

  return (
    <SafeAreaView style={styles.app} edges={['top', 'left', 'right']}>
      <View style={styles.screen}>
        {tab === 'home' && <HomeScreen profile={profile} />}
        {tab === 'courses' && <CoursesScreen profile={profile} />}
        {tab === 'exams' && <ExamsScreen profile={profile} />}
        {tab === 'more' && <MoreScreen profile={profile} onSignOut={signOut} />}
      </View>
      <View style={styles.tabBar}>
        {tabs.map((item) => {
          const active = tab === item.id;
          return (
            <Pressable key={item.id} onPress={() => setTab(item.id)} style={styles.tab}>
              <View style={[styles.tabDot, active && styles.tabDotActive]} />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.cream50 },
  screen: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream50 },
  setup: { flex: 1, backgroundColor: colors.cream50, justifyContent: 'center', padding: 28 },
  setupTitle: { color: colors.navy950, fontSize: 24, fontWeight: '800' },
  setupBody: { color: colors.ink600, fontSize: 14, lineHeight: 22, marginTop: 10 },
  tabBar: { flexDirection: 'row', minHeight: 67, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.white, paddingBottom: 5 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  tabDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'transparent' },
  tabDotActive: { backgroundColor: colors.green700 },
  tabText: { color: colors.ink400, fontWeight: '700', fontSize: 11 },
  tabTextActive: { color: colors.navy950 }
});
