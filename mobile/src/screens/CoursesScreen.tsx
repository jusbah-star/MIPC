import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, radii } from '../theme';
import type { Course, Material, Profile } from '../types';

export function CoursesScreen({ profile }: { profile: Profile }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [materials, setMaterials] = useState<Record<string, Material[]>>({});

  const loadCourses = useCallback(async () => {
    setLoading(true);
    if (profile.role === 'student') {
      const { data } = await supabase
        .from('enrollments')
        .select('course_id, status, courses(id, code, title, description, credits)')
        .eq('student_id', profile.id)
        .eq('status', 'active');
      const rows = (data || []) as any[];
      setCourses(rows.map((row) => row.courses).filter(Boolean) as Course[]);
    } else if (profile.role === 'lecturer' || profile.role === 'hod' || profile.role === 'admin' || profile.role === 'registrar') {
      const { data } = await supabase
        .from('courses')
        .select('id, code, title, description, credits')
        .order('code');
      setCourses((data || []) as Course[]);
    } else {
      setCourses([]);
    }
    setLoading(false);
  }, [profile.id, profile.role]);

  useEffect(() => { void loadCourses(); }, [loadCourses]);

  async function toggleMaterials(courseId: string) {
    if (selectedCourse === courseId) {
      setSelectedCourse(null);
      return;
    }
    setSelectedCourse(courseId);
    if (materials[courseId]) return;

    const { data } = await supabase
      .from('course_materials')
      .select('id, title, description, material_category, resource_url, content, file_name, created_at')
      .eq('course_id', courseId)
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(100);
    setMaterials((current) => ({ ...current, [courseId]: (data || []) as Material[] }));
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.green700} /></View>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Courses & materials</Text>
      <Text style={styles.subtitle}>Only records permitted by your MIPC account and database policies are shown.</Text>

      {courses.length ? courses.map((course) => {
        const open = selectedCourse === course.id;
        const courseMaterials = materials[course.id] || [];
        return (
          <View key={course.id} style={styles.card}>
            <Text style={styles.code}>{course.code}</Text>
            <Text style={styles.courseTitle}>{course.title}</Text>
            {!!course.description && <Text style={styles.description}>{course.description}</Text>}
            <Pressable onPress={() => void toggleMaterials(course.id)} style={styles.materialButton}>
              <Text style={styles.materialButtonText}>{open ? 'Hide materials' : 'View lesson materials'}</Text>
            </Pressable>
            {open && (
              <View style={styles.materialList}>
                {courseMaterials.length ? courseMaterials.map((material) => (
                  <View key={material.id} style={styles.material}>
                    <Text style={styles.materialCategory}>{(material.material_category || 'RESOURCE').replace(/_/g, ' ').toUpperCase()}</Text>
                    <Text style={styles.materialTitle}>{material.title}</Text>
                    {!!material.description && <Text style={styles.materialDescription}>{material.description}</Text>}
                    {!!material.content && <Text style={styles.materialDescription}>{material.content}</Text>}
                    {!!material.file_name && <Text style={styles.fileLabel}>Attached: {material.file_name}</Text>}
                    {!!material.resource_url && (
                      <Pressable onPress={() => void Linking.openURL(material.resource_url!)}>
                        <Text style={styles.link}>Open resource link</Text>
                      </Pressable>
                    )}
                  </View>
                )) : <Text style={styles.noMaterials}>No published materials are available for this course.</Text>}
              </View>
            )}
          </View>
        );
      }) : (
        <View style={styles.empty}><Text style={styles.emptyText}>No course workspace is available for this account.</Text></View>
      )}
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
  code: { color: colors.green700, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  courseTitle: { color: colors.navy950, fontSize: 17, fontWeight: '800', marginTop: 5 },
  description: { color: colors.ink600, lineHeight: 20, marginTop: 6 },
  materialButton: { marginTop: 14, borderRadius: 10, backgroundColor: colors.green100, paddingVertical: 10, paddingHorizontal: 12, alignSelf: 'flex-start' },
  materialButtonText: { color: colors.green800, fontWeight: '800', fontSize: 12 },
  materialList: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 14, paddingTop: 12 },
  material: { backgroundColor: colors.cream50, borderRadius: 12, padding: 12, marginBottom: 9 },
  materialCategory: { color: colors.gold500, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  materialTitle: { color: colors.navy950, fontWeight: '800', marginTop: 4 },
  materialDescription: { color: colors.ink600, lineHeight: 19, fontSize: 12, marginTop: 4 },
  fileLabel: { color: colors.ink600, fontSize: 11, fontWeight: '700', marginTop: 8 },
  link: { color: colors.navy700, fontWeight: '800', fontSize: 12, marginTop: 8 },
  noMaterials: { color: colors.ink600, fontSize: 12, lineHeight: 18 },
  empty: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, padding: 18 },
  emptyText: { color: colors.ink600, lineHeight: 21 }
});
