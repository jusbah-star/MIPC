import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, radii } from '../theme';
import type { Exam, Profile } from '../types';

function statusFor(exam: Exam) {
  const now = Date.now();
  const start = new Date(exam.available_from).getTime();
  const end = new Date(exam.available_until).getTime();
  if (now < start) return 'UPCOMING';
  if (now > end) return 'CLOSED';
  return 'OPEN';
}

export function ExamsScreen({ profile }: { profile: Profile }) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    if (profile.role === 'student') {
      const { data: enrollmentRows } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('student_id', profile.id)
        .eq('status', 'active');
      const courseIds = (enrollmentRows || []).map((row: any) => row.course_id).filter(Boolean);
      if (!courseIds.length) {
        setExams([]);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('tests')
        .select('id, course_id, title, description, duration_minutes, available_from, available_until, published')
        .in('course_id', courseIds)
        .eq('published', true)
        .order('available_from', { ascending: false })
        .limit(100);
      setExams((data || []) as Exam[]);
    } else if (profile.role === 'lecturer' || profile.role === 'hod' || profile.role === 'admin') {
      const { data } = await supabase
        .from('tests')
        .select('id, course_id, title, description, duration_minutes, available_from, available_until, published')
        .order('available_from', { ascending: false })
        .limit(100);
      setExams((data || []) as Exam[]);
    } else {
      setExams([]);
    }
    setLoading(false);
  }, [profile.id, profile.role]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.green700} /></View>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Examinations</Text>
      <Text style={styles.subtitle}>Assessment windows are read from the same secured examination records as the web portal.</Text>
      {exams.length ? exams.map((exam) => {
        const status = statusFor(exam);
        return (
          <View key={exam.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.examTitle}>{exam.title}</Text>
              <View style={[styles.badge, status === 'OPEN' && styles.badgeOpen]}><Text style={[styles.badgeText, status === 'OPEN' && styles.badgeTextOpen]}>{status}</Text></View>
            </View>
            {!!exam.description && <Text style={styles.description}>{exam.description}</Text>}
            <Text style={styles.meta}>{exam.duration_minutes} minutes</Text>
            <Text style={styles.meta}>From {new Date(exam.available_from).toLocaleString()}</Text>
            <Text style={styles.meta}>Until {new Date(exam.available_until).toLocaleString()}</Text>
            {profile.role === 'student' && status === 'OPEN' && (
              <Text style={styles.phaseNote}>Secure native exam taking, autosave and submission are the next mobile delivery milestone. Until enabled, use the MIPC web examination room for live attempts.</Text>
            )}
          </View>
        );
      }) : <View style={styles.empty}><Text style={styles.emptyText}>No examinations are currently visible to this account.</Text></View>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream50 },
  content: { padding: 18, paddingBottom: 36 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream50 },
  title: { color: colors.navy950, fontSize: 25, fontWeight: '800' },
  subtitle: { color: colors.ink600, lineHeight: 21, marginTop: 6, marginBottom: 18 },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, padding: 16, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', justifyContent: 'space-between' },
  examTitle: { flex: 1, color: colors.navy950, fontSize: 16, fontWeight: '800' },
  badge: { backgroundColor: colors.infoBg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  badgeOpen: { backgroundColor: colors.green100 },
  badgeText: { color: colors.navy700, fontSize: 9, fontWeight: '900' },
  badgeTextOpen: { color: colors.green800 },
  description: { color: colors.ink600, lineHeight: 20, marginTop: 7 },
  meta: { color: colors.ink400, fontSize: 11, marginTop: 6 },
  phaseNote: { color: colors.green800, backgroundColor: colors.green100, fontSize: 11, lineHeight: 17, borderRadius: 10, padding: 10, marginTop: 12 },
  empty: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, padding: 18 },
  emptyText: { color: colors.ink600, lineHeight: 21 }
});
