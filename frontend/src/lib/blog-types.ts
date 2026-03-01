export type BlogCategory =
  | "ugc-video"
  | "ecommerce"
  | "ai-marketing"
  | "tutorials";

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: BlogCategory;
  tags: string[];
  image: string;
  imageAlt: string;
  author: string;
  readingTime: string;
  content: string;
  published: boolean;
}

export const CATEGORIES: Record<
  BlogCategory,
  { label: string; description: string }
> = {
  "ugc-video": {
    label: "UGC Video",
    description:
      "Tips and strategies for creating high-converting UGC video ads.",
  },
  ecommerce: {
    label: "E-Commerce",
    description:
      "Grow your online store with proven e-commerce marketing tactics.",
  },
  "ai-marketing": {
    label: "AI Marketing",
    description:
      "How AI is transforming digital advertising and content creation.",
  },
  tutorials: {
    label: "Tutorials",
    description:
      "Step-by-step guides for getting the most out of CineRads.",
  },
};
