ALTER TABLE public.teacher_documents
  DROP CONSTRAINT IF EXISTS teacher_documents_kind_check;

ALTER TABLE public.teacher_documents
  ADD CONSTRAINT teacher_documents_kind_check
  CHECK (
    kind IN (
      'identity_front',
      'identity_back',
      'identity',
      'cni',
      'passport',
      'selfie',
      'qualification',
      'diploma',
      'diplome',
      'certificat',
      'cv',
      'other'
    )
  );

NOTIFY pgrst, 'reload schema';