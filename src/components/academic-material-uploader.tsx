'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileTextIcon } from '@/components/icons';

export type AcademicMaterialTarget = {
  lessonId?: string | null;
  lessonLabel?: string | null;
  courseId: string;
  courseLabel: string;
  classSectionId?: string | null;
  scopeLabel: string;
};

type SignedUploadTicket = {
  bucket?: string;
  path?: string;
  token?: string;
  signedUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  error?: string;
};

const categories = [
  ['book', 'Book / textbook'],
  ['handout', 'Handout / lecture notes'],
  ['questionnaire', 'Questionnaire'],
  ['assignment', 'Assignment / problem set'],
  ['past_paper', 'Past paper / revision'],
  ['presentation', 'Presentation / slides'],
  ['worksheet', 'Worksheet / practical'],
  ['reference', 'Reference material'],
  ['other', 'Other academic material']
] as const;

const allowedTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'image/jpeg',
  'image/png'
];

const maxFileSize = 25 * 1024 * 1024;

function uploadFailureMessage(raw: string, status: number) {
  let detail = raw.trim();
  if (detail) {
    try {
      const parsed = JSON.parse(detail);
      detail = String(parsed?.message ?? parsed?.error ?? parsed?.error_description ?? detail);
    } catch {
      // Keep the plain-text Storage response when it is not JSON.
    }
  }
  detail = detail.replace(/\s+/g, ' ').slice(0, 240);
  return detail
    ? `The file could not be uploaded: ${detail}`
    : `The file could not be uploaded by secure storage (HTTP ${status}).`;
}

async function uploadToSignedUrlDirectly(ticket: SignedUploadTicket, file: File) {
  if (!ticket.signedUrl) {
    throw new Error('The secure upload ticket is incomplete. Refresh the page and try again.');
  }

  let uploadUrl: URL;
  try {
    uploadUrl = new URL(ticket.signedUrl);
  } catch {
    throw new Error('The secure upload address is invalid. Refresh the page and try again.');
  }
  if (uploadUrl.protocol !== 'https:') {
    throw new Error('The secure upload address is not HTTPS.');
  }

  const form = new FormData();
  form.append('cacheControl', '3600');
  form.append('', file);

  let response: Response;
  try {
    response = await fetch(uploadUrl.toString(), {
      method: 'PUT',
      body: form,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: { 'x-upsert': 'false' }
    });
  } catch (error) {
    const detail = error instanceof Error && error.message ? ` (${error.message})` : '';
    throw new Error(`The browser could not reach secure file storage${detail}. Check your connection and try again.`);
  }

  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    throw new Error(uploadFailureMessage(raw, response.status));
  }
}

export function AcademicMaterialUploader({
  targets,
  title = 'Upload lesson material',
  description = 'Attach books, questionnaires, assignments, handouts, slides, worksheets, past papers, or other teaching resources.',
  emptyMessage = 'No lesson is available for uploads. Create a lesson/topic first in Lessons & Materials.'
}: {
  targets: AcademicMaterialTarget[];
  title?: string;
  description?: string;
  emptyMessage?: string;
}) {
  const router = useRouter();
  const options = useMemo(() => targets.map((target, index) => ({ ...target, key: String(index) })), [targets]);
  const [targetKey, setTargetKey] = useState(options[0]?.key ?? '');
  const [materialTitle, setMaterialTitle] = useState('');
  const [category, setCategory] = useState('handout');
  const [materialDescription, setMaterialDescription] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [instructions, setInstructions] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [published, setPublished] = useState(true);
  const [status, setStatus] = useState<{ kind: 'idle' | 'saving' | 'success' | 'error'; message?: string }>({ kind: 'idle' });

  const selectedTarget = options.find((item) => item.key === targetKey) ?? options[0];
  const hasTargets = options.length > 0;

  function chooseFile(nextFile: File | null) {
    setStatus({ kind: 'idle' });
    setFile(null);
    if (!nextFile) return;
    if (!allowedTypes.includes(nextFile.type)) {
      setStatus({ kind: 'error', message: 'Use PDF, Word, PowerPoint, Excel, TXT, JPG, or PNG files.' });
      return;
    }
    if (nextFile.size > maxFileSize) {
      setStatus({ kind: 'error', message: 'Academic files must be 25 MB or smaller.' });
      return;
    }
    setFile(nextFile);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status.kind === 'saving') return;
    if (!selectedTarget) {
      setStatus({ kind: 'error', message: emptyMessage });
      return;
    }
    if (!materialTitle.trim()) {
      setStatus({ kind: 'error', message: 'Add a title for this material.' });
      return;
    }
    if (!file && !resourceUrl.trim() && !instructions.trim()) {
      setStatus({ kind: 'error', message: 'Attach a file, add an HTTPS resource link, or enter lesson instructions.' });
      return;
    }

    setStatus({ kind: 'saving', message: file ? 'Preparing secure upload…' : 'Publishing material…' });
    let ticket: SignedUploadTicket | null = null;

    try {
      if (file) {
        const ticketResponse = await fetch('/api/course-materials/upload-ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lessonId: selectedTarget.lessonId ?? null,
            courseId: selectedTarget.courseId,
            classSectionId: selectedTarget.classSectionId ?? null,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size
          })
        });
        ticket = await ticketResponse.json().catch(() => ({}));
        if (!ticketResponse.ok) throw new Error(ticket?.error || 'We could not prepare the file upload.');

        setStatus({ kind: 'saving', message: 'Uploading file securely…' });
        await uploadToSignedUrlDirectly(ticket ?? {}, file);
      }

      setStatus({ kind: 'saving', message: 'Saving lesson material…' });
      const response = await fetch('/api/course-materials/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId: selectedTarget.lessonId ?? null,
          courseId: selectedTarget.courseId,
          classSectionId: selectedTarget.classSectionId ?? null,
          title: materialTitle.trim(),
          description: materialDescription.trim(),
          category,
          resourceUrl: resourceUrl.trim(),
          content: instructions.trim(),
          published,
          storagePath: ticket?.path ?? null,
          fileName: ticket?.fileName ?? null,
          fileType: ticket?.fileType ?? null,
          fileSize: ticket?.fileSize ?? null
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'The material could not be published.');

      setMaterialTitle('');
      setMaterialDescription('');
      setResourceUrl('');
      setInstructions('');
      setFile(null);
      const input = document.getElementById('academic-material-file') as HTMLInputElement | null;
      if (input) input.value = '';
      setStatus({ kind: 'success', message: published ? 'Material published to students.' : 'Material saved as a draft.' });
      router.refresh();
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'The material could not be published.' });
    }
  }

  return (
    <form onSubmit={submit} className="mipc-panel grid grid-cols-1 gap-5 p-6 lg:grid-cols-2" aria-labelledby="academic-material-uploader-title" noValidate>
      <div className="lg:col-span-2">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mipc-green-100 text-mipc-green-800"><FileTextIcon className="h-5 w-5" /></span>
          <div><h2 id="academic-material-uploader-title" className="font-display text-xl font-bold text-ink-950">{title}</h2><p className="mt-1 text-sm leading-6 text-ink-600">{description}</p></div>
        </div>
      </div>

      {!hasTargets && (
        <div className="lg:col-span-2 rounded-xl border border-brass-500/30 bg-brass-400/10 px-4 py-3 text-sm leading-6 text-ink-700" role="status">
          <strong className="text-ink-950">Upload unavailable:</strong> {emptyMessage}
        </div>
      )}

      <div className="lg:col-span-2">
        <label className="mipc-label" htmlFor="academic-material-target">Lesson / audience</label>
        <select id="academic-material-target" className="mipc-input" value={targetKey} onChange={(event) => { setTargetKey(event.target.value); setStatus({ kind: 'idle' }); }} required disabled={!hasTargets}>
          {!hasTargets && <option value="">No lessons available for upload</option>}
          {options.map((target) => <option key={target.key} value={target.key}>{target.courseLabel}{target.lessonLabel ? ` · ${target.lessonLabel}` : ''} · {target.scopeLabel}</option>)}
        </select>
      </div>

      <div><label className="mipc-label" htmlFor="academic-material-category">Material category</label><select id="academic-material-category" className="mipc-input" value={category} onChange={(event) => setCategory(event.target.value)} disabled={!hasTargets}>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div><label className="mipc-label" htmlFor="academic-material-title">Title</label><input id="academic-material-title" className="mipc-input" value={materialTitle} onChange={(event) => setMaterialTitle(event.target.value)} minLength={3} maxLength={180} required disabled={!hasTargets} placeholder="e.g. Reinforced concrete worked examples" /></div>

      <div className="lg:col-span-2">
        <label className="mipc-label" htmlFor="academic-material-file">Upload file</label>
        <input id="academic-material-file" className="mipc-input file:mr-4 file:rounded-lg file:border-0 file:bg-mipc-navy-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-mipc-navy-900" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.jpeg,.png" disabled={!hasTargets} onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} />
        <p className="mt-1.5 text-xs text-ink-500">PDF, Word, PowerPoint, Excel, TXT, JPG or PNG · maximum 25 MB. Files are stored privately.</p>
        {file && <p className="mt-2 text-xs font-semibold text-mipc-green-700">Selected: {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</p>}
      </div>

      <div><label className="mipc-label" htmlFor="academic-material-resource">Optional HTTPS resource link</label><input id="academic-material-resource" className="mipc-input" type="url" value={resourceUrl} onChange={(event) => setResourceUrl(event.target.value)} disabled={!hasTargets} placeholder="https://…" /></div>
      <div><label className="mipc-label" htmlFor="academic-material-description">Short description</label><input id="academic-material-description" className="mipc-input" value={materialDescription} onChange={(event) => setMaterialDescription(event.target.value)} maxLength={3000} disabled={!hasTargets} placeholder="What students should use this for" /></div>
      <div className="lg:col-span-2"><label className="mipc-label" htmlFor="academic-material-instructions">Instructions / lesson note</label><textarea id="academic-material-instructions" className="mipc-input" rows={4} value={instructions} onChange={(event) => setInstructions(event.target.value)} maxLength={20000} disabled={!hasTargets} placeholder="Reading instructions, questions, task details, references, or other guidance…" /></div>

      <div className="flex flex-wrap items-center justify-between gap-4 lg:col-span-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-ink-800"><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} disabled={!hasTargets} className="h-4 w-4 accent-mipc-green-700" /> Publish to students now</label>
        <button type="submit" className="mipc-button-primary" disabled={status.kind === 'saving'}>{status.kind === 'saving' ? 'Saving…' : hasTargets ? 'Upload material' : 'Why can’t I upload?'}</button>
      </div>

      {status.message && <p className={`lg:col-span-2 rounded-xl px-4 py-3 text-sm ${status.kind === 'error' ? 'bg-signal-danger-bg text-signal-danger' : status.kind === 'success' ? 'bg-signal-ok-bg text-signal-ok' : 'bg-mipc-navy-50 text-ink-700'}`} role={status.kind === 'error' ? 'alert' : 'status'}>{status.message}</p>}
    </form>
  );
}
