-- Cover the cohort provenance foreign key used by registrar enrollment reconciliation.
create index if not exists enrollments_source_cohort_id_idx
  on public.enrollments(source_cohort_id);
