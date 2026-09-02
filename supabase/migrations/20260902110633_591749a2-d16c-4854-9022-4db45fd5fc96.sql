CREATE OR REPLACE FUNCTION public.is_profile_counterpart(p_other uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_user IS NOT NULL AND p_other IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE (c.learner_id = p_user AND c.teacher_id = p_other)
         OR (c.teacher_id = p_user AND c.learner_id = p_other)
    )
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE (b.requester_id = p_user AND b.teacher_id = p_other)
         OR (b.teacher_id = p_user AND b.requester_id = p_other)
    )
  )
$$;

REVOKE ALL ON FUNCTION public.is_profile_counterpart(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_profile_counterpart(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_profile_counterpart(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Users read profiles of conversation or booking counterparts" ON public.profiles;
CREATE POLICY "Users read profiles of conversation or booking counterparts"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_profile_counterpart(user_id, auth.uid()));

NOTIFY pgrst, 'reload schema';