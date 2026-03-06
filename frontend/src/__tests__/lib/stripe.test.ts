import { describe, it, expect } from "vitest";
import {
  PLANS,
  CREDIT_PACKS,
  SINGLE_VIDEO_PACKS,
  CREDITS_PER_SINGLE,
  CREDITS_PER_BATCH,
  CREDITS_PER_SINGLE_HD,
  CREDITS_PER_BATCH_HD,
} from "@/lib/stripe";

describe("stripe constants", () => {
  describe("per-generation credit costs", () => {
    it("standard single costs 5 credits", () => {
      expect(CREDITS_PER_SINGLE).toBe(5);
    });

    it("standard batch (triple) costs 15 credits", () => {
      expect(CREDITS_PER_BATCH).toBe(15);
    });

    it("HD single costs 10 credits", () => {
      expect(CREDITS_PER_SINGLE_HD).toBe(10);
    });

    it("HD batch (triple) costs 30 credits", () => {
      expect(CREDITS_PER_BATCH_HD).toBe(30);
    });

    it("batch is exactly 3x single for both qualities", () => {
      expect(CREDITS_PER_BATCH).toBe(CREDITS_PER_SINGLE * 3);
      expect(CREDITS_PER_BATCH_HD).toBe(CREDITS_PER_SINGLE_HD * 3);
    });
  });

  describe("PLANS", () => {
    it("has starter, growth, and scale tiers", () => {
      expect(Object.keys(PLANS)).toEqual(["starter", "growth", "scale"]);
    });

    it("starter plan has correct pricing and limits", () => {
      expect(PLANS.starter.price).toBe(25);
      expect(PLANS.starter.credits).toBe(30);
      expect(PLANS.starter.personas).toBe(2);
      expect(PLANS.starter.brands).toBe(1);
      expect(PLANS.starter.resolution).toBe("720p");
    });

    it("growth plan has correct pricing and limits", () => {
      expect(PLANS.growth.price).toBe(80);
      expect(PLANS.growth.credits).toBe(100);
      expect(PLANS.growth.personas).toBe(10);
      expect(PLANS.growth.brands).toBe(3);
      expect(PLANS.growth.resolution).toBe("1080p");
    });

    it("scale plan has correct pricing and limits", () => {
      expect(PLANS.scale.price).toBe(180);
      expect(PLANS.scale.credits).toBe(250);
      expect(PLANS.scale.personas).toBe(100);
      expect(PLANS.scale.brands).toBe(999);
      expect(PLANS.scale.resolution).toBe("1080p");
    });

    it("higher tiers cost less per credit", () => {
      const starterRate = PLANS.starter.price / PLANS.starter.credits;
      const growthRate = PLANS.growth.price / PLANS.growth.credits;
      const scaleRate = PLANS.scale.price / PLANS.scale.credits;
      expect(growthRate).toBeLessThan(starterRate);
      expect(scaleRate).toBeLessThan(growthRate);
    });

    it("every plan has at least one feature", () => {
      for (const plan of Object.values(PLANS)) {
        expect(plan.features.length).toBeGreaterThan(0);
      }
    });
  });

  describe("CREDIT_PACKS", () => {
    it("has pack_10, pack_30, and pack_100", () => {
      expect(Object.keys(CREDIT_PACKS)).toEqual(["pack_10", "pack_30", "pack_100"]);
    });

    it("pricePerCredit matches price / credits", () => {
      for (const pack of Object.values(CREDIT_PACKS)) {
        expect(pack.pricePerCredit).toBeCloseTo(pack.price / pack.credits, 2);
      }
    });

    it("larger packs have lower per-credit cost", () => {
      expect(CREDIT_PACKS.pack_30.pricePerCredit).toBeLessThan(
        CREDIT_PACKS.pack_10.pricePerCredit,
      );
      expect(CREDIT_PACKS.pack_100.pricePerCredit).toBeLessThan(
        CREDIT_PACKS.pack_30.pricePerCredit,
      );
    });

    it("pack prices are more expensive per credit than starter subscription", () => {
      const starterRate = PLANS.starter.price / PLANS.starter.credits;
      for (const pack of Object.values(CREDIT_PACKS)) {
        expect(pack.pricePerCredit).toBeGreaterThan(starterRate);
      }
    });

    it("pro pack has a badge", () => {
      expect(CREDIT_PACKS.pack_100).toHaveProperty("badge", "Best value");
    });
  });

  describe("SINGLE_VIDEO_PACKS", () => {
    it("standard single video uses CREDITS_PER_SINGLE", () => {
      expect(SINGLE_VIDEO_PACKS.single_standard.credits).toBe(CREDITS_PER_SINGLE);
      expect(SINGLE_VIDEO_PACKS.single_standard.price).toBe(CREDITS_PER_SINGLE);
      expect(SINGLE_VIDEO_PACKS.single_standard.quality).toBe("standard");
    });

    it("HD single video uses CREDITS_PER_SINGLE_HD", () => {
      expect(SINGLE_VIDEO_PACKS.single_hd.credits).toBe(CREDITS_PER_SINGLE_HD);
      expect(SINGLE_VIDEO_PACKS.single_hd.price).toBe(CREDITS_PER_SINGLE_HD);
      expect(SINGLE_VIDEO_PACKS.single_hd.quality).toBe("hd");
    });

    it("single video price equals credits (1:1 mapping)", () => {
      expect(SINGLE_VIDEO_PACKS.single_standard.price).toBe(
        SINGLE_VIDEO_PACKS.single_standard.credits,
      );
      expect(SINGLE_VIDEO_PACKS.single_hd.price).toBe(
        SINGLE_VIDEO_PACKS.single_hd.credits,
      );
    });
  });
});
