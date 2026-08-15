import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path) => readFile(join(root, path), 'utf8');

const [registrarPage, adminPage] = await Promise.all([
  read('src/app/(portal)/registrar/students/page.tsx'),
  read('src/app/(portal)/admin/students/page.tsx')
]);

for (const [label, source] of [['Registrar', registrarPage], ['Principal', adminPage]]) {
  test(`${label} student register supports scalable focused lookup`, () => {
    assert.match(source, /searchParams/);
    assert.match(source, /name="q"/);
    assert.match(source, /Find a student/);
    assert.match(source, /registration_number/);
    assert.match(source, /full_name\.ilike/);
    assert.match(source, /registration_number\.ilike/);
    assert.match(source, /PAGE_SIZE = 50/);
    assert.match(source, /\.range\(/);
    assert.match(source, /department/);
    assert.match(source, /cohort/);
    assert.match(source, /No students match/);
  });
}

test('Registrar register can narrow a large intake by class without client-side full-list filtering', () => {
  assert.match(registrarPage, /name="class"/);
  assert.match(registrarPage, /\.eq\('class_section_id', classId\)/);
  assert.match(registrarPage, /showing \{total === 0 \? 0 : from \+ 1\}/);
});

test('Principal register preserves highlighted duplicate records across pagination', () => {
  assert.match(adminPage, /highlightedStudentId/);
  assert.match(adminPage, /\.eq\('id',highlightedStudentId\)/);
  assert.match(adminPage, /open=\{highlightedStudentId===student\.id\}/);
});
