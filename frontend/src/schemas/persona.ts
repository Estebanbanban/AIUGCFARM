import { z } from "zod";

export const personaGenders = ["male", "female", "non_binary"] as const;
export const personaAgeRanges = [
  "18_25",
  "25_35",
  "35_45",
  "45_55",
  "55_plus",
] as const;
export const personaBodyTypes = [
  "slim",
  "average",
  "athletic",
  "curvy",
  "plus_size",
] as const;

export const skinTones = [
  "#FDDBB4",
  "#F1C27D",
  "#E0AC69",
  "#C68642",
  "#8D5524",
  "#5C3A1E",
] as const;

export const ethnicities = [
  "White / Caucasian",
  "Black / African",
  "East Asian",
  "South Asian",
  "Southeast Asian",
  "Latino / Hispanic",
  "Middle Eastern",
  "Mixed / Multiracial",
] as const;

export const hairColors = [
  "Black",
  "Dark Brown",
  "Light Brown",
  "Blonde",
  "Red",
  "Auburn",
  "Gray",
  "White",
  "Pink",
  "Blue",
] as const;

export const hairStyles = [
  "Short Straight",
  "Short Curly",
  "Medium Straight",
  "Medium Wavy",
  "Long Straight",
  "Long Curly",
  "Buzz Cut",
  "Bob",
  "Ponytail",
  "Braids",
  "Afro",
  "Bald",
] as const;

export const eyeColors = [
  "Brown",
  "Blue",
  "Green",
  "Hazel",
  "Gray",
  "Amber",
] as const;

export const clothingStyles = [
  "Casual",
  "Business Casual",
  "Streetwear",
  "Sporty",
  "Elegant",
  "Bohemian",
  "Minimalist",
] as const;

export const accessories = [
  "None",
  "Glasses",
  "Sunglasses",
  "Earrings",
  "Necklace",
  "Watch",
  "Hat",
  "Scarf",
] as const;

export const personaAttributesSchema = z.object({
  gender: z.enum(personaGenders),
  ethnicity: z.string().optional(),
  skin_tone: z.string().optional(),
  age: z.enum(personaAgeRanges),
  hair_color: z.string(),
  hair_style: z.string(),
  eye_color: z.string(),
  body_type: z.enum(personaBodyTypes),
  clothing_style: z.string(),
  accessories: z.array(z.string()).max(5),
});

export const createPersonaSchema = z.object({
  name: z.string().min(1).max(50),
  attributes: personaAttributesSchema,
});

export const updatePersonaSchema = createPersonaSchema.partial();

export type CreatePersonaInput = z.infer<typeof createPersonaSchema>;
