-- Le téléphone devient obligatoire à l'inscription (formulaire front) : on
-- le persiste désormais dès la création du profil, comme display_name l'est
-- déjà. Pas de vérification par OTP ici (aucun fournisseur SMS configuré) —
-- c'est une donnée de contact déclarative, au même titre que l'était déjà
-- profiles.phone quand il était rempli plus tard dans les paramètres du
-- compte.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _role public.app_role;
begin
  insert into public.profiles (user_id, display_name, phone)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1)),
    nullif(trim(new.raw_user_meta_data->>'phone'), '')
  );

  begin
    _role := (new.raw_user_meta_data->>'role')::public.app_role;
  exception when others then
    _role := null;
  end;

  if _role in ('parent', 'student', 'teacher') then
    insert into public.user_roles (user_id, role) values (new.id, _role);
  end if;

  if _role = 'teacher' then
    insert into public.teacher_profiles (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$function$;
