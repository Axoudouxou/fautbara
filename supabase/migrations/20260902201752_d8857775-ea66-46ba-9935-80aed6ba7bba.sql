revoke all on function public.create_booking_payment(uuid) from public, anon;
grant execute on function public.create_booking_payment(uuid) to authenticated;
notify pgrst, 'reload schema';