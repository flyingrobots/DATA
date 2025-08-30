-- Maintenance mode table
CREATE TABLE IF NOT EXISTS public.maintenance_mode (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  enabled boolean DEFAULT true,
  message text DEFAULT 'System maintenance in progress',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default maintenance mode
INSERT INTO public.maintenance_mode (enabled)
VALUES (true)
ON CONFLICT (id) DO NOTHING;
