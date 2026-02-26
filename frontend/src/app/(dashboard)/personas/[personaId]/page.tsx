"use client";

export const dynamic = "force-dynamic";

import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Pencil,
  Sparkles,
  Clock,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const mockPersona = {
  id: "persona-1",
  name: "Sophie",
  attributes: {
    gender: "Female",
    age: "25-35",
    skin_tone: "#F1C27D",
    hair_color: "Dark Brown",
    hair_style: "Medium Straight",
    eye_color: "Brown",
    body_type: "Average",
    clothing_style: "Casual",
    accessories: ["Earrings", "Watch"],
  },
  selected_image_url: null as string | null,
  created_at: "Feb 10, 2026",
};

const mockGenerations = [
  {
    id: "gen-1",
    productName: "Vitamin C Serum",
    date: "Feb 24, 2026",
    videoCount: 4,
    status: "completed",
  },
  {
    id: "gen-2",
    productName: "Running Shoes X1",
    date: "Feb 20, 2026",
    videoCount: 4,
    status: "completed",
  },
];

export default function PersonaDetailPage() {
  const params = useParams();
  const personaId = params.personaId as string;

  const attributes = [
    { label: "Gender", value: mockPersona.attributes.gender },
    { label: "Age Range", value: mockPersona.attributes.age },
    { label: "Hair Color", value: mockPersona.attributes.hair_color },
    { label: "Hair Style", value: mockPersona.attributes.hair_style },
    { label: "Eye Color", value: mockPersona.attributes.eye_color },
    { label: "Body Type", value: mockPersona.attributes.body_type },
    { label: "Clothing Style", value: mockPersona.attributes.clothing_style },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/dashboard/personas">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {mockPersona.name}
          </h1>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/personas/new">
            <Pencil className="size-4" />
            Edit & Regenerate
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Persona Image */}
        <Card>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="flex size-48 items-center justify-center rounded-xl bg-muted">
              {mockPersona.selected_image_url ? (
                <img
                  src={mockPersona.selected_image_url}
                  alt={mockPersona.name}
                  className="size-full rounded-xl object-cover"
                />
              ) : (
                <User className="size-16 text-muted-foreground" />
              )}
            </div>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-foreground">
                {mockPersona.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                Created {mockPersona.created_at}
              </p>
            </div>

            {/* Skin Tone */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Skin Tone</span>
              <div
                className="size-5 rounded-full border"
                style={{
                  backgroundColor: mockPersona.attributes.skin_tone,
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Persona Details */}
        <div className="flex flex-col gap-6">
          {/* Attributes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Attributes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {attributes.map((attr) => (
                  <Badge
                    key={attr.label}
                    variant="secondary"
                    className="gap-1.5 px-3 py-1.5 text-sm"
                  >
                    <span className="text-muted-foreground">{attr.label}:</span>
                    <span className="text-foreground">{attr.value}</span>
                  </Badge>
                ))}
              </div>

              {mockPersona.attributes.accessories.length > 0 && (
                <div className="mt-4">
                  <span className="text-xs font-medium uppercase text-muted-foreground">
                    Accessories
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {mockPersona.attributes.accessories.map((acc) => (
                      <Badge key={acc} variant="outline" className="text-xs">
                        {acc}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* Generations using this persona */}
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-semibold text-foreground">
              Generations using this persona
            </h3>

            {mockGenerations.length > 0 ? (
              <div className="flex flex-col gap-3">
                {mockGenerations.map((gen) => (
                  <Link
                    key={gen.id}
                    href={`/dashboard/generate/${gen.id}`}
                    className="group"
                  >
                    <Card className="transition-colors hover:border-violet-500/30">
                      <CardContent className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 items-center justify-center rounded-lg bg-violet-500/10">
                            <Video className="size-4 text-violet-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {gen.productName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {gen.videoCount} videos
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="size-3" />
                          {gen.date}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-8">
                  <Sparkles className="size-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No generations yet with this persona.
                  </p>
                  <Button
                    asChild
                    size="sm"
                    className="bg-violet-600 hover:bg-violet-700"
                  >
                    <Link href="/dashboard/generate">
                      <Sparkles className="size-4" />
                      Generate Video
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
