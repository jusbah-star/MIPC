import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../supabase/migrations/0024_academic_material_uploads.sql', import.meta.url);
const hardeningMigrationPath = new URL('../supabase/migrations/0025_academic_material_rpc_hardening.sql', import.meta.url);
const uploaderPath = new URL('../src/components/academic-material-uploader.tsx', import.meta.url);
const lecturerPath = new URL('../src/app/(portal)/lecturer/courses/page.tsx', import.meta.url);
const hodPath = new URL('../src/app/(portal)/hod/page.tsx', import.meta.url);
const publishPath = new URL('../src/app/api/course-materials/publish/route.ts', import.meta.url);
const ticketPath = new URL('../src/app/api/course-materials/upload-ticket/route.ts', import.meta.url);
const downloadPath = new URL('../src/app/api/course-materials/[materialId]/route.ts', import.meta.url);
const studentPath = new URL('../src/app/(portal)/student/courses/[courseId]/page.tsx', import.meta.url);

const [migration, hardeningMigration, uploader, lecturer, hod, publishRoute, ticketRoute, downloadRoute, student] = await Promise.all([
  readFile(migrationPath, 'utf8'),
  readFile(hardeningMigrationPath, 'utf8'),
  readFile(uploaderPath, 'utf8'),
  readFile(lecturerPath, 'utf8'),
  readFile(hodPath, 'utf8'),
  readFile(publishPath, 'utf8'),
  readFile(ticketPath, 'utf8'),
  readFile(downloadPath, 'utf8'),
  readFile(studentPath, 'utf8')
]);

test('academic materials use a private storage bucket with a 25 MB limit', () => {
  assert.match(migration, /'course-materials'/);
  assert.match(migration, /false,\s*26214400/i);
  assert.match(migration, /application\/pdf/);
  assert.match(migration, /wordprocessingml\.document/);
  assert.match(migration, /presentationml\.presentation/);
});

test('material rows support class scope, academic categories, and file metadata', () => {
  assert.match(migration, /class_section_id uuid references public\.class_sections/i);
  assert.match(migration, /material_category text/i);
  assert.match(migration, /storage_path text/i);
  assert.match(migration, /file_name text/i);
  assert.match(migration, /questionnaire/);
  assert.match(migration, /assignment/);
  assert.match(migration, /past_paper/);
});

test('students can only read published materials for their enrollment and class', () => {
  assert.match(migration, /student_can_read_course_material/i);
  assert.match(migration, /student\.class_section_id = target_class_section_id/i);
  assert.match(migration, /students read published scoped course materials/i);
});

test('lecturer and HOD publication authorization is class aware', () => {
  assert.match(migration, /can_manage_course_material/i);
  assert.match(migration, /course_class_assignments cca/i);
  assert.match(migration, /actor\.role = 'hod'/i);
  assert.match(lecturer, /AcademicMaterialUploader/);
  assert.match(hod, /HOD lesson materials & uploads/);
});

test('large files bypass the server action body limit through signed uploads', () => {
  assert.match(uploader, /uploadToSignedUrl/);
  assert.match(uploader, /\/api\/course-materials\/upload-ticket/);
  assert.match(ticketRoute, /createSignedUploadUrl/);
  assert.match(ticketRoute, /authorizeCourseMaterialTarget/);
});

test('publishing verifies the uploaded object and uses a service-only privileged RPC', () => {
  assert.match(publishRoute, /\.list\(folder, \{ search: objectName/);
  assert.match(publishRoute, /publish_course_material_service/);
  assert.match(publishRoute, /publisher_id: user\.id/);
  assert.match(publishRoute, /authorization\.admin as any/);
  assert.match(hardeningMigration, /publish_course_material_service/);
  assert.match(hardeningMigration, /revoke all on function public\.publish_course_material_service[\s\S]*from public, anon, authenticated/i);
  assert.match(hardeningMigration, /grant execute on function public\.publish_course_material_service[\s\S]*to service_role/i);
});

test('students download private files through an authenticated signed-download endpoint', () => {
  assert.match(downloadRoute, /createSignedUrl/);
  assert.match(downloadRoute, /supabase\.auth\.getUser/);
  assert.match(student, /\/api\/course-materials\/\$\{material\.id\}/);
  assert.match(student, /Download file/);
});
