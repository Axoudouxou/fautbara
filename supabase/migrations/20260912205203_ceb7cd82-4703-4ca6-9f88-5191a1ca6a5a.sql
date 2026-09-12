-- 1. Référentiels du compte-rendu
ALTER TABLE public.session_reports DROP CONSTRAINT IF EXISTS session_reports_attendance_check;
UPDATE public.session_reports SET attendance = CASE attendance
  WHEN 'done' THEN 'present' WHEN 'cancelled' THEN 'absent_excused' WHEN 'absent' THEN 'absent' ELSE attendance END;
ALTER TABLE public.session_reports ADD CONSTRAINT session_reports_attendance_check
  CHECK (attendance IN ('present','absent','absent_excused'));

ALTER TABLE public.session_reports DROP CONSTRAINT IF EXISTS session_reports_progress_level_check;
UPDATE public.session_reports SET progress_level = CASE progress_level
  WHEN 'discovering' THEN 'to_reinforce' WHEN 'in_progress' THEN 'acquiring' WHEN 'mastered' THEN 'acquired' ELSE progress_level END;
ALTER TABLE public.session_reports ADD CONSTRAINT session_reports_progress_level_check
  CHECK (progress_level IN ('to_reinforce','acquiring','acquired'));

-- Travail depuis la dernière séance : texte libre
ALTER TABLE public.session_reports DROP CONSTRAINT IF EXISTS session_reports_homework_done_check;
UPDATE public.session_reports SET homework_done = CASE homework_done
  WHEN 'yes' THEN 'Travail réalisé' WHEN 'partial' THEN 'Travail partiellement réalisé' WHEN 'no' THEN 'Travail non réalisé' ELSE homework_done END;

-- Engagement qualitatif
ALTER TABLE public.session_reports ADD COLUMN IF NOT EXISTS engagement_level text;
UPDATE public.session_reports
   SET engagement_level = CASE WHEN engagement_rating >= 5 THEN 'very_good'
                               WHEN engagement_rating >= 4 THEN 'good' ELSE 'to_improve' END
 WHERE engagement_level IS NULL;
ALTER TABLE public.session_reports ALTER COLUMN engagement_level SET DEFAULT 'good';
UPDATE public.session_reports SET engagement_level = 'good' WHERE engagement_level IS NULL;
ALTER TABLE public.session_reports ALTER COLUMN engagement_level SET NOT NULL;
ALTER TABLE public.session_reports DROP CONSTRAINT IF EXISTS session_reports_engagement_level_check;
ALTER TABLE public.session_reports ADD CONSTRAINT session_reports_engagement_level_check
  CHECK (engagement_level IN ('very_good','good','to_improve'));
ALTER TABLE public.session_reports ALTER COLUMN engagement_rating DROP NOT NULL;

-- 2. Devoirs rattachés à un compte-rendu
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS session_report_id uuid REFERENCES public.session_reports(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS assignments_session_report_idx ON public.assignments (session_report_id);

-- 3. Documents du compte-rendu
CREATE TABLE IF NOT EXISTS public.session_report_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES public.session_reports(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_size integer,
  mime_type text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS session_report_documents_report_idx ON public.session_report_documents (report_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.session_report_documents TO authenticated;
GRANT ALL ON public.session_report_documents TO service_role;
ALTER TABLE public.session_report_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Report parties read documents" ON public.session_report_documents
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.session_reports r
                  WHERE r.id = session_report_documents.report_id
                    AND (r.teacher_id = auth.uid() OR r.learner_id = auth.uid())));

CREATE POLICY "Report author adds documents" ON public.session_report_documents
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.session_reports r
                 WHERE r.id = session_report_documents.report_id AND r.teacher_id = auth.uid()));

CREATE POLICY "Report author removes documents" ON public.session_report_documents
  FOR DELETE TO authenticated
  USING (teacher_id = auth.uid());