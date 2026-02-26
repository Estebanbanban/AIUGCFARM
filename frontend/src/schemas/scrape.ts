import { z } from "zod";

export const scrapeRequestSchema = z.object({
  url: z
    .string()
    .url("Please enter a valid URL")
    .refine(
      (url) => {
        try {
          const parsed = new URL(url);
          return ["http:", "https:"].includes(parsed.protocol);
        } catch {
          return false;
        }
      },
      { message: "URL must start with http:// or https://" }
    ),
});

export type ScrapeRequestInput = z.infer<typeof scrapeRequestSchema>;
