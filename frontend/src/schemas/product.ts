import { z } from "zod";

export const createProductSchema = z.object({
  brand_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  price: z.number().positive().optional(),
  currency: z.string().length(3).default("USD"),
  primary_image_url: z.string().url().optional(),
  additional_image_urls: z.array(z.string().url()).max(10).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string()).max(20).optional(),
  source_url: z.string().url().optional(),
});

export const updateProductSchema = createProductSchema.partial().omit({ brand_id: true });

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
