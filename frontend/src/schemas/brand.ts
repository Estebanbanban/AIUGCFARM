import { z } from "zod";

export const createBrandSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url().optional(),
  tone_of_voice: z.string().max(500).optional(),
  target_demographic: z.string().max(500).optional(),
  key_selling_points: z.array(z.string()).max(10).optional(),
});

export const updateBrandSchema = createBrandSchema.partial();

export type CreateBrandInput = z.infer<typeof createBrandSchema>;
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;
