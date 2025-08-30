-- Example function
CREATE OR REPLACE FUNCTION get_user_posts(user_uuid uuid)
RETURNS TABLE(
    post_id uuid,
    title text,
    content text,
    created_at timestamptz
) AS $$
BEGIN
    RETURN QUERY
    SELECT id, title, content, created_at
    FROM posts
    WHERE user_id = user_uuid
    ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql;