import { Feed } from "feed";
import { getAllPosts } from "@/lib/blog";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://cinerads.com";

export async function GET() {
  const posts = getAllPosts();

  const feed = new Feed({
    title: "CineRads Blog",
    description:
      "Expert tips on UGC video ads, e-commerce growth, AI marketing, and tutorials.",
    id: SITE_URL,
    link: `${SITE_URL}/blog`,
    language: "en",
    favicon: `${SITE_URL}/favicon.ico`,
    copyright: `All rights reserved ${new Date().getFullYear()}, CineRads`,
    author: {
      name: "CineRads Team",
      link: SITE_URL,
    },
  });

  for (const post of posts) {
    feed.addItem({
      title: post.title,
      id: `${SITE_URL}/blog/${post.slug}`,
      link: `${SITE_URL}/blog/${post.slug}`,
      description: post.description,
      date: new Date(post.date),
      author: [{ name: post.author }],
      image: post.image.startsWith("http")
        ? post.image
        : `${SITE_URL}${post.image}`,
    });
  }

  return new Response(feed.rss2(), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
