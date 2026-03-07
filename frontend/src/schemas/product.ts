import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  price: z.number().positive().optional(),
  currency: z.string().length(3).default("USD"),
  store_url: z.string().url().optional(),
  images: z.array(z.string().url()).max(10).optional(),
  category: z.string().max(100).optional(),
  source: z.enum(["shopify", "generic", "manual", "saas"]).default("manual"),
  confirmed: z.boolean().default(false),
});

export const updateProductSchema = createProductSchema.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
