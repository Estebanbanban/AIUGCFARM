-- Atomically append a single image path to a persona's generated_images array.
-- Using a DB function avoids the read-modify-write race condition that occurs
-- when two parallel edge function calls try to append images to the same persona
-- at the same time (both would read the same empty array and overwrite each other).
CREATE OR REPLACE FUNCTION append_persona_image(
  p_persona_id uuid,
  p_owner_id   uuid,
  p_image_path text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE personas
  SET
    generated_images = generated_images || ARRAY[p_image_path],
    regen_count      = COALESCE(regen_count, 0) + 1,
    updated_at       = NOW()
  WHERE id = p_persona_id AND owner_id = p_owner_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'persona_not_found';
  END IF;
END;
$$;

-- Grant execute to service_role (used by edge functions via admin client)
GRANT EXECUTE ON FUNCTION append_persona_image(uuid, uuid, text) TO service_role;
