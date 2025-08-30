-- Enable RLS
ALTER TABLE public.maintenance_mode ENABLE ROW LEVEL SECURITY;

-- Allow read access to all
CREATE POLICY "Allow public read" ON public.maintenance_mode
  FOR SELECT
  TO public
  USING (true);
