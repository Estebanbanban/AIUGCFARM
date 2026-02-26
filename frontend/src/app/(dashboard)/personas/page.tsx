"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { Plus, Users, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const mockPersonas = [
  {
    id: "persona-1",
    name: "Sophie",
    gender: "Female",
    ageRange: "25-35",
    skinTone: "#F1C27D",
    hairColor: "Dark Brown",
    bodyType: "Average",
    clothingStyle: "Casual",
    selected_image_url: null as string | null,
  },
];

const mockSlots = { used: 1, total: 3 };

export default function PersonasPage() {
  const hasPersonas = mockPersonas.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            AI Personas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mockSlots.used}/{mockSlots.total} persona slots used
          </p>
        </div>
        <Button
          asChild
          className="bg-violet-600 hover:bg-violet-700"
          disabled={mockSlots.used >= mockSlots.total}
        >
          <Link href="/dashboard/personas/new">
            <Plus className="size-4" />
            Create New Persona
          </Link>
        </Button>
      </div>

      {/* Persona Grid */}
      {hasPersonas ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mockPersonas.map((persona) => (
            <Link
              key={persona.id}
              href={`/dashboard/personas/${persona.id}`}
              className="group"
            >
              <Card className="h-full transition-colors hover:border-violet-500/30">
                <CardContent className="flex flex-col items-center gap-4">
                  {/* Avatar / Image */}
                  <div className="flex size-24 items-center justify-center rounded-full bg-muted">
                    {persona.selected_image_url ? (
                      <img
                        src={persona.selected_image_url}
                        alt={persona.name}
                        className="size-full rounded-full object-cover"
                      />
                    ) : (
                      <User className="size-10 text-muted-foreground" />
                    )}
                  </div>

                  {/* Name & Info */}
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-foreground">
                      {persona.name}
                    </h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {persona.gender} / {persona.ageRange}
                    </p>
                  </div>

                  {/* Attribute Badges */}
                  <div className="flex flex-wrap justify-center gap-1.5">
                    <Badge variant="secondary" className="text-xs">
                      {persona.hairColor} hair
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {persona.bodyType}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {persona.clothingStyle}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <div className="flex size-14 items-center justify-center rounded-full bg-violet-500/10">
              <Users className="size-7 text-violet-500" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-foreground">
                Create your first AI persona
              </h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Build a custom AI avatar to star in your UGC video ads.
                Customize appearance, style, and more.
              </p>
            </div>
            <Button asChild className="bg-violet-600 hover:bg-violet-700">
              <Link href="/dashboard/personas/new">
                <Plus className="size-4" />
                Create Persona
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
