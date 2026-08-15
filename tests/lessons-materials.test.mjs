import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../supabase/migrations/0028_lesson_topics_and_material_links.sql', import.meta.url);
const builderPath = new URL('../src/components/lesson-builder.tsx', import.meta.url);
const lessonsPagePath = new URL('../src/app/(portal)/lecturer/lessons/page.tsx', import.meta.url);
const lessonsApiPath = new URL('../src/app/api/lessons/route.ts', import.meta.url);
const uploaderPath = new URL('../src/components/academic-material-uploader.tsx', import.meta.url);
const uploadTicketPath = new URL('../src/app/api/course-materials/upload-ticket/route.ts', import.meta.url);
const publishPath = new URL('../src/app/api/course-materials/publish/route.ts', import.meta.url);
const materialServerPath = new URL('../src/lib/course-materials-server.ts', import.meta.url);
const navPath = new URL('../src/app/(portal)/portal-nav.tsx', import.meta.url);

const [migration, builder, lessonsPage, lessonsApi, uploader, uploadTicket, publishRoute, materialServer, nav] = await Promise.all([
  readFile(migrationPath, 'utf8'),
  readFile(builderPath, 'utf8'),
  readFile(lessonsPagePath, 'utf8'),
  readFile(lessonsApiPath, 'utf8'),
  readFile(uploaderPath, 'utf8'),
  readFile(uploadTicketPath, 'utf8'),
  readFile(publishPath, 'utf8'),
  readFile(materialServerPath, 'utf8'),
  readFile(navPath, 'utf8')
]);

test('lessons are first-class course and class scoped records', () => {
  assert.match(migration, /create table if not exists public\.lessons/i);
  assert.match(migration, /course_id uuid not null references public\.courses/i);
  assert.match(migration, /class_section_id uuid references public\.class_sections/i);
  assert.match(migration, /week_number integer/i);
  assert.match(migration, /scheduled_date date/i);
  assert.match(migration, /alter table public\.lessons enable row level security/i);
  assert.match(migration, /faculty create lessons/i);
});

test('academic materials can be linked to a real lesson without breaking legacy course materials', () => {
  assert.match(migration, /add column if not exists lesson_id uuid references public\.lessons/i);
  assert.match(migration, /lesson_id is null[\s\S]*lesson_record\.published = true/i);
  assert.match(migration, /publish_course_material_service_v2/i);
  assert.match(migration, /target_lesson_id uuid/i);
  assert.match(migration, /revoke all on function public\.publish_course_material_service_v2[\s\S]*authenticated/i);
  assert.match(migration, /grant execute on function public\.publish_course_material_service_v2[\s\S]*service_role/i);
});

test('lecturers and HODs have an explicit lesson creation workflow', () => {
  assert.match(builder, /Add lesson \/ topic/);
  assert.match(builder, /fetch\('\/api\/lessons'/);
  assert.match(lessonsApi, /authorizeCourseMaterialTarget/);
  assert.match(lessonsApi, /\.from\('lessons'\)/);
  assert.match(lessonsPage, /Course \/ module → Lesson \/ topic → Materials/);
  assert.match(lessonsPage, /<LessonBuilder targets=\{lessonScopes\}/);
  assert.match(lessonsPage, /<AcademicMaterialUploader/);
});

test('material upload resolves and authorizes lesson scope on the server', () => {
  assert.match(uploader, /lessonId: selectedTarget\.lessonId/);
  assert.match(uploadTicket, /authorizeLessonMaterialTarget/);
  assert.match(publishRoute, /authorizeLessonMaterialTarget/);
  assert.match(publishRoute, /publish_course_material_service_v2/);
  assert.match(publishRoute, /target_lesson_id: lessonId/);
  assert.match(materialServer, /export async function authorizeLessonMaterialTarget/);
});

test('lesson workspace is visible in lecturer and HOD navigation', () => {
  const matches = nav.match(/href: '\/lecturer\/lessons', label: 'Lessons & Materials'/g) ?? [];
  assert.equal(matches.length, 2);
});
