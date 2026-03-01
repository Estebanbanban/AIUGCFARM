import { z } from "zod";

export const createGenerationSchema = z.object({
  product_id: z.string().uuid(),
  persona_id: z.string().uuid(),
  mode: z.enum(["easy", "expert"]).default("easy"),
});

export type CreateGenerationInput = z.infer<typeof createGenerationSchema>;
