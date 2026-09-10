alter table public.teacher_profiles disable trigger teacher_profiles_guard_verification;

update public.teacher_profiles
   set identity_verified = true,
       qualifications_verified = (user_id <> '11111111-1111-4111-8111-000000000001'),
       verification_status = 'approved',
       verification_decided_at = now(),
       verification_submitted_at = now()
 where user_id in (
   '11111111-1111-4111-8111-000000000001',
   '11111111-1111-4111-8111-000000000002',
   '11111111-1111-4111-8111-000000000003',
   '11111111-1111-4111-8111-000000000004'
 );

alter table public.teacher_profiles enable trigger teacher_profiles_guard_verification;