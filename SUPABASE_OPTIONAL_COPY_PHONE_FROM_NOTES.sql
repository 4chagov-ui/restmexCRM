-- Optional one-time helper. Do not run unless you want to copy old phone-only notes
-- into locations.phone. This does not delete or change notes.

update public.locations
set phone = trim(regexp_replace(notes, '^[[:space:]]*Телефон:[[:space:]]*', '', 'i'))
where (phone is null or trim(phone) = '')
  and notes ~* '^[[:space:]]*Телефон:[[:space:]]*\+?[0-9[:space:]()\-]+$';
