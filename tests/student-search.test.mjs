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
  test(`${label} student register supports focused lookup`, () => {
    assert.match(source, /searchParams/);
    assert.match(source, /name="q"/);
    assert.match(source, /Find a student/);
    assert.match(source, /registration_number/);
    assert.match(source, /student\.full_name/);
    assert.match(source, /student\.email/);
    assert.match(source, /department\?\.name/);
    assert.match(source, /cohort\?\.name/);
    assert.match(source, /No students match this search/);
  });
}
