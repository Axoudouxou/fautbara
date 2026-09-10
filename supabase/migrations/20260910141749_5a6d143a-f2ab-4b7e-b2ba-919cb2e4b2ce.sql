revoke all on function public.admin_list_wallet_withdrawals(p_status text) from anon;
revoke all on function public.bookings_refresh_grade() from anon;
revoke all on function public.enforce_offer_rate_cap() from anon;
revoke all on function public.purchase_pack(p_offer_id uuid, p_pack_slug text, p_child_id uuid, p_format text, p_commune text, p_address text) from anon;
revoke all on function public.session_reports_refresh_grade() from anon;
revoke all on function public.session_reports_validate_earning() from anon;
revoke all on function public.teacher_rate_cap(p_teacher_id uuid) from anon;

revoke all on function public.bookings_refresh_grade() from authenticated;
revoke all on function public.enforce_offer_rate_cap() from authenticated;
revoke all on function public.session_reports_refresh_grade() from authenticated;
revoke all on function public.session_reports_validate_earning() from authenticated;
revoke all on function public.refresh_teacher_grade(p_teacher_id uuid) from authenticated;
revoke all on function public.refresh_teacher_grade(p_teacher_id uuid) from anon;

notify pgrst, 'reload schema';