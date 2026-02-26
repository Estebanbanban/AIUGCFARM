import { z } from "zod";

export const checkoutSchema = z.object({
  priceId: z.string().startsWith("price_"),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
