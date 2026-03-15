"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Youtube,
  Loader2,
  Globe,
  EyeOff,
  Lock,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useYouTubeConnections,
  usePublishToYouTube,
  useYouTubeConnectUrl,
} from "@/hooks/use-youtube";

interface YouTubePublishModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  generationId: string;
  defaultTitle?: string;
  defaultDescription?: string;
}

export function YouTubePublishModal({
  open,
  onOpenChange,
  generationId,
  defaultTitle = "",
  defaultDescription = "",
}: YouTubePublishModalProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription);
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState<
    "public" | "unlisted" | "private"
  >("private");
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>("");

  const { data: connections, isLoading: loadingConnections } =
    useYouTubeConnections();
  const publishMutation = usePublishToYouTube();
  const connectUrl = useYouTubeConnectUrl();

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setDescription(defaultDescription);
      setTags("");
      setVisibility("private");
      setSelectedConnectionId("");
    }
  }, [open, defaultTitle, defaultDescription]);

  // Auto-select the first connection if only one exists
  useEffect(() => {
    if (
      open &&
      connections?.length === 1 &&
      !selectedConnectionId
    ) {
      setSelectedConnectionId(connections[0].id);
    }
  }, [open, connections, selectedConnectionId]);

  async function handleConnect() {
    try {
      const { url } = await connectUrl.mutateAsync();
      window.location.href = url;
    } catch {
      toast.error("Failed to start YouTube connection");
    }
  }

  async function handlePublish() {
    if (!selectedConnectionId) {
      toast.error("Please select a YouTube channel");
      return;
    }
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    try {
      await publishMutation.mutateAsync({
        generation_id: generationId,
        connection_id: selectedConnectionId,
        title: title.trim(),
        description: description.trim() || undefined,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        visibility,
      });
      toast.success("Video published to YouTube!");
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to publish"
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Youtube className="size-5 text-red-500" />
            Publish to YouTube
          </DialogTitle>
          <DialogDescription>
            Upload your stitched video directly to YouTube.
          </DialogDescription>
        </DialogHeader>

        {loadingConnections ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : !connections?.length ? (
          /* No connections -- prompt to connect */
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex size-16 items-center justify-center rounded-full bg-red-500/10">
              <Youtube className="size-8 text-red-500" />
            </div>
            <div className="text-center">
              <p className="font-medium text-foreground">
                No YouTube account connected
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Connect your YouTube channel to publish videos directly.
              </p>
            </div>
            <Button onClick={handleConnect} disabled={connectUrl.isPending}>
              {connectUrl.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Youtube className="size-4" />
              )}
              Connect YouTube Account
            </Button>
          </div>
        ) : (
          /* Has connections -- show publish form */
          <div className="flex flex-col gap-4 py-2">
            {/* Channel selector */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="channel">Channel</Label>
              <Select
                value={selectedConnectionId}
                onValueChange={setSelectedConnectionId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a channel" />
                </SelectTrigger>
                <SelectContent>
                  {connections.map((conn) => (
                    <SelectItem key={conn.id} value={conn.id}>
                      <div className="flex items-center gap-2">
                        {conn.channel_thumbnail && (
                          <img
                            src={conn.channel_thumbnail}
                            alt=""
                            className="size-5 rounded-full"
                          />
                        )}
                        {conn.channel_title}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Video title"
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                {title.length}/100
              </p>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Video description (optional)"
                rows={3}
              />
            </div>

            {/* Tags */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="tag1, tag2, tag3"
              />
              <p className="text-xs text-muted-foreground">Comma-separated</p>
            </div>

            {/* Visibility */}
            <div className="flex flex-col gap-2">
              <Label>Visibility</Label>
              <Select
                value={visibility}
                onValueChange={(v) =>
                  setVisibility(v as "public" | "unlisted" | "private")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">
                    <div className="flex items-center gap-2">
                      <Globe className="size-4" />
                      Public
                    </div>
                  </SelectItem>
                  <SelectItem value="unlisted">
                    <div className="flex items-center gap-2">
                      <EyeOff className="size-4" />
                      Unlisted
                    </div>
                  </SelectItem>
                  <SelectItem value="private">
                    <div className="flex items-center gap-2">
                      <Lock className="size-4" />
                      Private
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Footer -- only show publish button when connections exist */}
        {connections?.length ? (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handlePublish}
              disabled={
                publishMutation.isPending ||
                !selectedConnectionId ||
                !title.trim()
              }
              className="bg-red-600 hover:bg-red-700"
            >
              {publishMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Youtube className="size-4" />
                  Publish
                </>
              )}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
