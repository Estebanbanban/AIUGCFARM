"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useYouTubeCallback } from "@/hooks/use-youtube";

type CallbackState = "processing" | "success" | "error";

export default function YouTubeCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<CallbackState>("processing");
  const [errorMsg, setErrorMsg] = useState("");
  const callback = useYouTubeCallback();
  // Guard against React Strict Mode double-mount AND back/forward navigation
  // (OAuth codes are single-use — second exchange always fails)
  const hasFired = useRef(
    typeof sessionStorage !== "undefined" &&
    sessionStorage.getItem("yt_callback_fired") === "1"
  );

  useEffect(() => {
    if (hasFired.current) {
      // Already processed — redirect to settings
      setState("success");
      setTimeout(() => router.push("/settings"), 1000);
      return;
    }
    hasFired.current = true;
    try { sessionStorage.setItem("yt_callback_fired", "1"); } catch {};

    const code = searchParams.get("code");
    const stateParam = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      setState("error");
      setErrorMsg(
        error === "access_denied"
          ? "You denied access to your YouTube account."
          : `OAuth error: ${error}`
      );
      return;
    }

    if (!code || !stateParam) {
      setState("error");
      setErrorMsg("Missing authorization code. Please try connecting again.");
      return;
    }

    callback.mutate(
      { code, state: stateParam },
      {
        onSuccess: () => {
          setState("success");
          toast.success("YouTube channel connected!");
          try { sessionStorage.removeItem("yt_callback_fired"); } catch {};
          setTimeout(() => router.push("/settings"), 2000);
        },
        onError: (err) => {
          setState("error");
          setErrorMsg(err instanceof Error ? err.message : "Failed to connect YouTube account.");
        },
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-10">
          {state === "processing" && (
            <>
              <div className="flex size-16 items-center justify-center rounded-full bg-red-500/10">
                <Loader2 className="size-8 animate-spin text-red-500" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">
                  Connecting YouTube...
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Please wait while we set up your connection.
                </p>
              </div>
            </>
          )}

          {state === "success" && (
            <>
              <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle2 className="size-8 text-emerald-500" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">
                  YouTube Connected!
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Redirecting to settings...
                </p>
              </div>
            </>
          )}

          {state === "error" && (
            <>
              <div className="flex size-16 items-center justify-center rounded-full bg-red-500/10">
                <XCircle className="size-8 text-red-500" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">
                  Connection Failed
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {errorMsg}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => router.push("/settings")}>
                  Back to Settings
                </Button>
                <Button onClick={() => router.push("/settings")}>
                  <Youtube className="size-4" />
                  Try Again
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
