"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser, useClerk } from "@clerk/nextjs";
import { callEdge } from "@/lib/api";
import { toast } from "sonner";
import { ArrowRight, CreditCard, User, Lock, Youtube, Plus, Trash2, Loader2, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useYouTubeConnections, useYouTubeConnectUrl, useYouTubeDisconnect } from "@/hooks/use-youtube";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { data: youtubeConnections, isLoading: loadingYT } = useYouTubeConnections();
  const connectYouTube = useYouTubeConnectUrl();
  const disconnectYouTube = useYouTubeDisconnect();
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  async function handleConnectYouTube() {
    try {
      const { url } = await connectYouTube.mutateAsync();
      window.location.href = url;
    } catch {
      toast.error("Failed to start YouTube connection");
    }
  }

  async function handleDisconnectYouTube(connectionId: string) {
    setDisconnectingId(connectionId);
    try {
      await disconnectYouTube.mutateAsync(connectionId);
      toast.success("YouTube channel disconnected");
    } catch {
      toast.error("Failed to disconnect channel");
    } finally {
      setDisconnectingId(null);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await callEdge("delete-account", { body: { confirm: true } });
      await signOut(() => router.push("/"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete account");
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  }

  useEffect(() => {
    if (isLoaded && user) {
      setEmail(user.emailAddresses[0]?.emailAddress ?? "");
      setFullName(user.fullName ?? "");
    }
  }, [isLoaded, user]);

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      await user?.update({ firstName: fullName.split(" ")[0], lastName: fullName.split(" ").slice(1).join(" ") });
      setMessage("Profile updated successfully.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to update profile.");
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account and billing preferences.
        </p>
      </div>

      {/* Billing Link */}
      <Card className="bg-gradient-to-r from-card to-primary/5">
        <CardContent className="flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
              <CreditCard className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Billing & Subscription</p>
              <p className="text-xs text-muted-foreground">
                Manage your plan, credits, and payment methods.
              </p>
            </div>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/settings/billing">
              Manage Billing
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Connected Accounts */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-red-500/10">
              <Youtube className="size-5 text-red-500" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">Connected Accounts</CardTitle>
              <CardDescription>
                Connect your YouTube channels to publish videos directly.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link href="/settings/youtube-setup">
                  <HelpCircle className="size-4" />
                  Setup Guide
                </Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleConnectYouTube}
                disabled={connectYouTube.isPending}
              >
                {connectYouTube.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Add Channel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingYT ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading connections...
            </div>
          ) : !youtubeConnections?.length ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                No YouTube channels connected yet.
              </p>
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/settings/youtube-setup">
                    View Setup Guide
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleConnectYouTube}
                  disabled={connectYouTube.isPending}
                >
                  <Youtube className="size-4 text-red-500" />
                  Connect YouTube
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {youtubeConnections.map((conn) => (
                <div
                  key={conn.id}
                  className="flex items-center gap-3 rounded-lg border border-border/50 px-4 py-3"
                >
                  {conn.channel_thumbnail ? (
                    <img
                      src={conn.channel_thumbnail}
                      alt={conn.channel_title}
                      className="size-9 rounded-full"
                    />
                  ) : (
                    <div className="flex size-9 items-center justify-center rounded-full bg-red-500/10">
                      <Youtube className="size-4 text-red-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {conn.channel_title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      YouTube Channel
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDisconnectYouTube(conn.id)}
                    disabled={disconnectingId === conn.id}
                  >
                    {disconnectingId === conn.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <User className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Profile</CardTitle>
              <CardDescription>Update your account details.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateProfile} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className="bg-muted/60 pr-9"
                />
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">
                Email cannot be changed.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Your name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            {message && (
              <p className="text-sm text-muted-foreground">{message}</p>
            )}

            <div>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* Delete Account */}
      <div className="rounded-xl border border-border/50 px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Delete account</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Permanently deletes your account and all associated data. This cannot be undone.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            Delete account
          </Button>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your account, all products, personas, and generated videos.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Yes, delete my account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
