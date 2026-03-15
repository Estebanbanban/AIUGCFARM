"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Youtube,
  ExternalLink,
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
  Shield,
  Key,
  Globe,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useYouTubeConnections, useYouTubeConnectUrl } from "@/hooks/use-youtube";

/* -------------------------------------------------------------------------- */
/*  Copyable code block                                                        */
/* -------------------------------------------------------------------------- */

function CopyBlock({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="group relative">
      {label && (
        <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      )}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
        <code className="flex-1 truncate text-sm text-foreground">{text}</code>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          {copied ? (
            <Check className="size-4 text-emerald-500" />
          ) : (
            <Copy className="size-4" />
          )}
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Collapsible step                                                           */
/* -------------------------------------------------------------------------- */

function SetupStep({
  number,
  title,
  description,
  done,
  children,
  defaultOpen = false,
}: {
  number: number;
  title: string;
  description: string;
  done?: boolean;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/30"
      >
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
            done
              ? "bg-emerald-500/15 text-emerald-500"
              : "bg-primary/10 text-primary"
          )}
        >
          {done ? <Check className="size-4" /> : number}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-medium", done && "text-muted-foreground")}>
            {title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        {open ? (
          <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t border-border/50 px-5 py-4 bg-muted/10">
          {children}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main page                                                                  */
/* -------------------------------------------------------------------------- */

export default function YouTubeSetupPage() {
  const { data: connections, isLoading: loadingConnections } = useYouTubeConnections();
  const connectUrl = useYouTubeConnectUrl();
  const hasConnections = (connections?.length ?? 0) > 0;

  const redirectUri = typeof window !== "undefined"
    ? `${window.location.origin}/settings/youtube-callback`
    : "https://yourapp.com/settings/youtube-callback";

  async function handleConnect() {
    try {
      const { url } = await connectUrl.mutateAsync();
      window.location.href = url;
    } catch {
      toast.error("Failed to start YouTube connection. Make sure the Google OAuth credentials are configured.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link href="/settings">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">YouTube Setup Guide</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Connect your YouTube channel to publish videos directly from CineRads.
          </p>
        </div>
      </div>

      {/* Status card */}
      <Card className={cn(
        "border-l-4",
        hasConnections ? "border-l-emerald-500 bg-emerald-500/5" : "border-l-amber-500 bg-amber-500/5"
      )}>
        <CardContent className="flex items-center gap-4 py-4">
          {loadingConnections ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : hasConnections ? (
            <>
              <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">YouTube Connected</p>
                <p className="text-xs text-muted-foreground">
                  {connections!.length} channel{connections!.length > 1 ? "s" : ""} connected.
                  You can publish videos directly from the generation page.
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/settings">
                  Manage Channels
                </Link>
              </Button>
            </>
          ) : (
            <>
              <AlertCircle className="size-5 text-amber-500 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">YouTube Not Connected</p>
                <p className="text-xs text-muted-foreground">
                  Follow the steps below to set up YouTube publishing.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Overview */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: Key,
            title: "Google Cloud Project",
            desc: "Create OAuth credentials to let CineRads access YouTube on your behalf.",
          },
          {
            icon: Shield,
            title: "YouTube API Access",
            desc: "Enable the YouTube Data API so CineRads can upload videos to your channel.",
          },
          {
            icon: Globe,
            title: "Connect & Publish",
            desc: "Link your YouTube channel and start publishing UGC videos with one click.",
          },
        ].map((item) => (
          <div
            key={item.title}
            className="flex flex-col gap-2 rounded-xl border border-border/50 p-4"
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
              <item.icon className="size-4 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">{item.title}</p>
            <p className="text-xs text-muted-foreground">{item.desc}</p>
          </div>
        ))}
      </div>

      <Separator />

      {/* Steps */}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Setup Steps</h2>

        {/* Step 1 */}
        <SetupStep
          number={1}
          title="Create a Google Cloud Project"
          description="Set up a project in Google Cloud Console (free)"
          defaultOpen={!hasConnections}
        >
          <div className="flex flex-col gap-4">
            <ol className="flex flex-col gap-3 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="shrink-0 font-mono text-xs text-primary">1.</span>
                <span>
                  Go to{" "}
                  <a
                    href="https://console.cloud.google.com/projectcreate"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    Google Cloud Console
                    <ExternalLink className="size-3" />
                  </a>{" "}
                  and create a new project (e.g., &quot;CineRads YouTube&quot;).
                </span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 font-mono text-xs text-primary">2.</span>
                <span>Select your new project from the top dropdown.</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 font-mono text-xs text-primary">3.</span>
                <span>This is completely free — Google Cloud projects have no cost until you use paid services.</span>
              </li>
            </ol>
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
              <p className="text-xs text-primary">
                Already have a Google Cloud project? Skip to step 2.
              </p>
            </div>
          </div>
        </SetupStep>

        {/* Step 2 */}
        <SetupStep
          number={2}
          title="Enable the YouTube Data API"
          description="Turn on the API that allows video uploads"
        >
          <div className="flex flex-col gap-4">
            <ol className="flex flex-col gap-3 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="shrink-0 font-mono text-xs text-primary">1.</span>
                <span>
                  In your Google Cloud project, go to{" "}
                  <a
                    href="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    YouTube Data API v3
                    <ExternalLink className="size-3" />
                  </a>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 font-mono text-xs text-primary">2.</span>
                <span>Click the blue <strong>&quot;Enable&quot;</strong> button.</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 font-mono text-xs text-primary">3.</span>
                <span>Wait a few seconds for it to activate.</span>
              </li>
            </ol>
          </div>
        </SetupStep>

        {/* Step 3 */}
        <SetupStep
          number={3}
          title="Configure the OAuth Consent Screen"
          description="Set up what users see when authorizing YouTube access"
        >
          <div className="flex flex-col gap-4">
            <ol className="flex flex-col gap-3 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="shrink-0 font-mono text-xs text-primary">1.</span>
                <span>
                  Go to{" "}
                  <a
                    href="https://console.cloud.google.com/apis/credentials/consent"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    OAuth Consent Screen
                    <ExternalLink className="size-3" />
                  </a>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 font-mono text-xs text-primary">2.</span>
                <span>Choose <strong>&quot;External&quot;</strong> user type, then click Create.</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 font-mono text-xs text-primary">3.</span>
                <span>
                  Fill in the required fields:
                </span>
              </li>
            </ol>

            <div className="ml-5 flex flex-col gap-2 rounded-lg border border-border/50 bg-muted/30 p-3">
              <div className="grid gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">App name</span>
                  <span className="font-medium text-foreground">CineRads</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">User support email</span>
                  <span className="font-medium text-foreground">Your email</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Developer contact email</span>
                  <span className="font-medium text-foreground">Your email</span>
                </div>
              </div>
            </div>

            <ol start={4} className="flex flex-col gap-3 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="shrink-0 font-mono text-xs text-primary">4.</span>
                <span>On the <strong>Scopes</strong> page, click &quot;Add or Remove Scopes&quot; and add:</span>
              </li>
            </ol>

            <div className="ml-5 flex flex-col gap-2">
              <CopyBlock
                text="https://www.googleapis.com/auth/youtube.upload"
                label="Upload scope"
              />
              <CopyBlock
                text="https://www.googleapis.com/auth/youtube.readonly"
                label="Read scope"
              />
            </div>

            <ol start={5} className="flex flex-col gap-3 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="shrink-0 font-mono text-xs text-primary">5.</span>
                <span>
                  On the <strong>Test Users</strong> page, add your Google email address (and any team members).
                </span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 font-mono text-xs text-primary">6.</span>
                <span>Click <strong>Save and Continue</strong> through the remaining screens.</span>
              </li>
            </ol>

            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  <strong>Important:</strong> While in &quot;Testing&quot; mode, only users you add as test users can connect.
                  For production, you&apos;ll need to submit for Google&apos;s OAuth verification (takes 1-4 weeks).
                </p>
              </div>
            </div>
          </div>
        </SetupStep>

        {/* Step 4 */}
        <SetupStep
          number={4}
          title="Create OAuth Credentials"
          description="Generate the Client ID and Secret that CineRads needs"
        >
          <div className="flex flex-col gap-4">
            <ol className="flex flex-col gap-3 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="shrink-0 font-mono text-xs text-primary">1.</span>
                <span>
                  Go to{" "}
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    Credentials page
                    <ExternalLink className="size-3" />
                  </a>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 font-mono text-xs text-primary">2.</span>
                <span>
                  Click <strong>&quot;+ Create Credentials&quot;</strong> &rarr; <strong>&quot;OAuth client ID&quot;</strong>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 font-mono text-xs text-primary">3.</span>
                <span>Application type: <strong>Web application</strong></span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 font-mono text-xs text-primary">4.</span>
                <span>Name: <strong>CineRads YouTube</strong></span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 font-mono text-xs text-primary">5.</span>
                <span>Under <strong>&quot;Authorized redirect URIs&quot;</strong>, click &quot;+ Add URI&quot; and paste:</span>
              </li>
            </ol>

            <div className="ml-5">
              <CopyBlock text={redirectUri} label="Redirect URI" />
            </div>

            <ol start={6} className="flex flex-col gap-3 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="shrink-0 font-mono text-xs text-primary">6.</span>
                <span>Click <strong>Create</strong>.</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 font-mono text-xs text-primary">7.</span>
                <span>
                  Copy the <strong>Client ID</strong> and <strong>Client Secret</strong> from the popup.
                  You&apos;ll need these in the next step.
                </span>
              </li>
            </ol>

            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
              <p className="text-xs text-primary">
                Keep the Client Secret safe — never share it publicly or commit it to git.
              </p>
            </div>
          </div>
        </SetupStep>

        {/* Step 5 */}
        <SetupStep
          number={5}
          title="Add Credentials to CineRads"
          description="Set the environment variables for your deployment"
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Add these three environment variables to your Supabase project (or your deployment platform):
            </p>

            <div className="flex flex-col gap-2">
              <CopyBlock text="GOOGLE_CLIENT_ID=your-client-id-here" label="Variable 1" />
              <CopyBlock text="GOOGLE_CLIENT_SECRET=your-client-secret-here" label="Variable 2" />
              <CopyBlock text={`YOUTUBE_REDIRECT_URI=${redirectUri}`} label="Variable 3" />
            </div>

            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <p><strong>For Supabase Edge Functions:</strong></p>
              <ol className="flex flex-col gap-2 ml-1">
                <li className="flex gap-2">
                  <span className="shrink-0 font-mono text-xs text-primary">1.</span>
                  <span>
                    Go to your{" "}
                    <a
                      href="https://supabase.com/dashboard"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      Supabase Dashboard
                      <ExternalLink className="size-3" />
                    </a>
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 font-mono text-xs text-primary">2.</span>
                  <span>Go to <strong>Settings &rarr; Edge Functions &rarr; Secrets</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 font-mono text-xs text-primary">3.</span>
                  <span>Add each variable above as a new secret.</span>
                </li>
              </ol>
            </div>

            <p className="text-sm text-muted-foreground">
              Or via the Supabase CLI:
            </p>

            <CopyBlock text="supabase secrets set GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=xxx YOUTUBE_REDIRECT_URI=xxx" />
          </div>
        </SetupStep>

        {/* Step 6 */}
        <SetupStep
          number={6}
          title="Connect Your YouTube Channel"
          description="Link your account and start publishing"
          done={hasConnections}
        >
          <div className="flex flex-col gap-4">
            {hasConnections ? (
              <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
                <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Connected to {connections!.map((c) => c.channel_title).join(", ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You&apos;re all set! Go to any completed generation and click &quot;Publish to YouTube&quot;.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Once the credentials are set up, click the button below to connect your YouTube channel:
                </p>
                <div>
                  <Button
                    onClick={handleConnect}
                    disabled={connectUrl.isPending}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {connectUrl.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Youtube className="size-4" />
                    )}
                    Connect YouTube Channel
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  You&apos;ll be redirected to Google to authorize CineRads to upload videos on your behalf.
                  You can revoke access at any time from your{" "}
                  <a
                    href="https://myaccount.google.com/permissions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    Google Account settings
                  </a>
                  .
                </p>
              </>
            )}
          </div>
        </SetupStep>
      </div>

      <Separator />

      {/* FAQ */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Common Questions</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              q: "Is this free?",
              a: "Yes. Google Cloud projects are free, and the YouTube Data API has a generous free quota (about 6 video uploads per day by default).",
            },
            {
              q: "Can I connect multiple channels?",
              a: "Yes. Go to Settings > Connected Accounts and click \"Add Channel\" for each YouTube channel you want to publish to.",
            },
            {
              q: "What gets published?",
              a: "The stitched video (Hook + Body + CTA combined). Make sure to stitch your video before publishing.",
            },
            {
              q: "Can I set videos to private?",
              a: "Yes. When publishing, you choose the visibility: Public, Unlisted, or Private. Default is Private so you can review before going public.",
            },
            {
              q: "What about the OAuth verification?",
              a: "While in \"Testing\" mode, only you and added test users can connect. For production (all users), submit for Google's verification — takes 1-4 weeks.",
            },
            {
              q: "How do I increase the upload limit?",
              a: "Request a quota increase in Google Cloud Console > APIs & Services > YouTube Data API > Quotas. Each upload uses 1,600 units of 10,000/day default.",
            },
          ].map((item) => (
            <div
              key={item.q}
              className="rounded-xl border border-border/50 p-4"
            >
              <p className="text-sm font-medium text-foreground">{item.q}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
