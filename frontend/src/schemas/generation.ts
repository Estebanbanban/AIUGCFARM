import { z } from "zod";

export const createSegmentBatchSchema = z.object({
  product_id: z.string().uuid(),
  persona_id: z.string().uuid(),
  segments: z.array(
    z.object({
      type: z.enum(["hook", "body", "cta"]),
      count: z.number().int().min(1).max(5),
    })
  ).min(1),
});

export const createComboSchema = z.object({
  hook_segment_id: z.string().uuid(),
  body_segment_id: z.string().uuid(),
  cta_segment_id: z.string().uuid(),
});

export type CreateSegmentBatchInput = z.infer<typeof createSegmentBatchSchema>;
export type CreateComboInput = z.infer<typeof createComboSchema>;
