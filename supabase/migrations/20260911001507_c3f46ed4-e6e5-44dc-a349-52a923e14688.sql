DROP FUNCTION IF EXISTS public.admin_set_teacher_verification(uuid, boolean, boolean, text);

CREATE OR REPLACE FUNCTION public.admin_set_teacher_verification(
  p_teacher_id uuid,
  p_identity_verified boolean,
  p_qualifications_verified boolean,
  p_verification_status text,
  p_note text DEFAULT NULL
)
RETURNS public.teacher_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.teacher_profiles;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs';
  END IF;

  IF p_verification_status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Statut de vérification invalide';
  END IF;

  UPDATE public.teacher_profiles tp
  SET identity_verified = coalesce(p_identity_verified, tp.identity_verified),
      qualifications_verified = coalesce(p_qualifications_verified, tp.qualifications_verified),
      verification_status = p_verification_status,
      verification_note = nullif(btrim(coalesce(p_note, '')), ''),
      verification_decided_at = now(),
      updated_at = now()
  WHERE tp.user_id = p_teacher_id
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Profil intervenant introuvable';
  END IF;

  INSERT INTO public.notifications (user_id, kind, title, body, link)
  VALUES (
    p_teacher_id,
    'verification',
    CASE p_verification_status
      WHEN 'approved' THEN 'Vérification validée'
      WHEN 'rejected' THEN 'Dossier de vérification refusé'
      ELSE 'Dossier remis en attente'
    END,
    nullif(btrim(coalesce(p_note, '')), ''),
    '/pro/verification'
  );

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(),
    'teacher_verification_set',
    'teacher_profiles',
    v_row.id,
    jsonb_build_object(
      'status', p_verification_status,
      'identity_verified', v_row.identity_verified,
      'qualifications_verified', v_row.qualifications_verified
    )
  );

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_teacher_verification(uuid, boolean, boolean, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_teacher_verification(uuid, boolean, boolean, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';