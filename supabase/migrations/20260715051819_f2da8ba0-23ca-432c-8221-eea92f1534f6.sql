
-- Employees: restrict insert/update to admins
DROP POLICY IF EXISTS "Authenticated users can insert employees" ON public.employees;
DROP POLICY IF EXISTS "Authenticated users can update employees" ON public.employees;
CREATE POLICY "Admins can insert employees" ON public.employees
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update employees" ON public.employees
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Asset categories: restrict insert/update to admins
DROP POLICY IF EXISTS "Authenticated users can insert categories" ON public.asset_categories;
DROP POLICY IF EXISTS "Authenticated users can update categories" ON public.asset_categories;
CREATE POLICY "Admins can insert categories" ON public.asset_categories
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update categories" ON public.asset_categories
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Asset assignments: restrict insert/update to admins
DROP POLICY IF EXISTS "Authenticated users can insert assignments" ON public.asset_assignments;
DROP POLICY IF EXISTS "Authenticated users can update assignments" ON public.asset_assignments;
CREATE POLICY "Admins can insert assignments" ON public.asset_assignments
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update assignments" ON public.asset_assignments
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Lock down SECURITY DEFINER functions from public API roles.
-- handle_new_user_role is a trigger function; no role needs direct EXECUTE.
REVOKE ALL ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;

-- has_role is used inside RLS policies; SECURITY DEFINER means it runs as
-- owner, so revoke direct API execution from anon and PUBLIC. Keep
-- authenticated so RLS policies referencing it continue to evaluate.
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
