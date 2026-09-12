ALTER TABLE public.children ADD COLUMN IF NOT EXISTS avatar_path text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.learning_preferences DROP CONSTRAINT IF EXISTS learning_preferences_objective_check;
UPDATE public.learning_preferences SET objective = 'improve_grades' WHERE objective = 'confidence';
ALTER TABLE public.learning_preferences ADD CONSTRAINT learning_preferences_objective_check CHECK (objective IS NULL OR objective = ANY (ARRAY['catchup'::text, 'improve_grades'::text, 'exam'::text, 'method'::text, 'deepen'::text, 'advance'::text]));

CREATE POLICY "Parents read own child photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'child-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.children c
    WHERE c.id::text = (storage.foldername(name))[2]
      AND c.parent_id = auth.uid()
  )
);

CREATE POLICY "Parents upload own child photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'child-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.children c
    WHERE c.id::text = (storage.foldername(name))[2]
      AND c.parent_id = auth.uid()
  )
);

CREATE POLICY "Parents update own child photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'child-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.children c
    WHERE c.id::text = (storage.foldername(name))[2]
      AND c.parent_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'child-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.children c
    WHERE c.id::text = (storage.foldername(name))[2]
      AND c.parent_id = auth.uid()
  )
);

CREATE POLICY "Parents delete own child photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'child-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.children c
    WHERE c.id::text = (storage.foldername(name))[2]
      AND c.parent_id = auth.uid()
  )
);