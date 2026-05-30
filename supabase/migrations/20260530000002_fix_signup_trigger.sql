-- Fix: handle_new_user trigger now creates profiles for ALL new users.
-- - Regular signup (owner): role='owner', barbershop_id=NULL
-- - Invite (barber): role='barber', barbershop_id from invite metadata

CREATE OR REPLACE FUNCTION public.handle_new_user_from_invite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.raw_user_meta_data ? 'barbershop_id' THEN
    -- Invited barber: set role + barbershop_id from invite metadata
    INSERT INTO public.profiles (id, barbershop_id, role, full_name)
    VALUES (
      NEW.id,
      (NEW.raw_user_meta_data->>'barbershop_id')::UUID,
      COALESCE(NEW.raw_user_meta_data->>'role', 'barber'),
      NEW.raw_user_meta_data->>'full_name'
    )
    ON CONFLICT (id) DO NOTHING;
  ELSE
    -- Regular signup: owner account, barbershop_id stays NULL until Phase 1 onboarding
    INSERT INTO public.profiles (id, barbershop_id, role, full_name)
    VALUES (
      NEW.id,
      NULL,
      'owner',
      NEW.raw_user_meta_data->>'full_name'
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
