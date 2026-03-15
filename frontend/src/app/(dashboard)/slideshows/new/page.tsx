"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCreateSlideshow } from "@/hooks/use-slideshows";
import { Loader2 } from "lucide-react";

export default function NewSlideshowPage() {
  const router = useRouter();
  const createSlideshow = useCreateSlideshow();
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (hasTriggered.current) return;
    hasTriggered.current = true;

    const defaultSlides = [
      { id: crypto.randomUUID(), type: "hook" as const, order: 0, imageId: null, imageUrl: null, text: "" },
      { id: crypto.randomUUID(), type: "body" as const, order: 1, imageId: null, imageUrl: null, text: "", textContent: { title: "", subtitle: "", action: "" } },
      { id: crypto.randomUUID(), type: "body" as const, order: 2, imageId: null, imageUrl: null, text: "", textContent: { title: "", subtitle: "", action: "" } },
      { id: crypto.randomUUID(), type: "body" as const, order: 3, imageId: null, imageUrl: null, text: "", textContent: { title: "", subtitle: "", action: "" } },
      { id: crypto.randomUUID(), type: "body" as const, order: 4, imageId: null, imageUrl: null, text: "", textContent: { title: "", subtitle: "", action: "" } },
    ];

    createSlideshow.mutate(
      { name: "Untitled Slideshow", slides: defaultSlides },
      {
        onSuccess: (slideshow) => {
          router.replace(`/slideshows/${slideshow.id}`);
        },
        onError: () => {
          router.replace("/slideshows");
        },
      },
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Creating slideshow...</p>
      </div>
    </div>
  );
}
