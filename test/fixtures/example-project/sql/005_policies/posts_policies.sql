-- Enable RLS on posts table
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Published posts are viewable by everyone
CREATE POLICY "Published posts are viewable" ON public.posts
  FOR SELECT
  USING (status = 'published');

-- Users can view their own posts
CREATE POLICY "Users can view own posts" ON public.posts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own posts
CREATE POLICY "Users can create posts" ON public.posts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own posts
CREATE POLICY "Users can update own posts" ON public.posts
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own posts
CREATE POLICY "Users can delete own posts" ON public.posts
  FOR DELETE
  USING (auth.uid() = user_id);