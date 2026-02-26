import { z } from "zod";

export const checkoutSchema = z.object({
  priceId: z.string().startsWith("price_"),
  plan: z.enum(["starter", "growth", "scale"]),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
