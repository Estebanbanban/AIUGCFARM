import { describe, it, expect } from "vitest";
import {
  BRAND_LIMITS,
  PRODUCTS_PER_BRAND_LIMITS,
  PERSONAS_PER_MONTH_LIMITS,
} from "@/hooks/use-profile";
import {
  PLANS,
  CREDIT_PACKS,
  CREDITS_PER_BATCH,
  CREDITS_PER_BATCH_HD,
} from "@/lib/stripe";

/** 3 hooks × 3 bodies × 3 CTAs = 27 unique ad combos per triple batch */
const COMBOS_PER_BATCH = 27;

describe("plan limits", () => {
  describe("BRAND_LIMITS", () => {
    it("free = 1", () => expect(BRAND_LIMITS.free).toBe(1));
    it("starter = 1", () => expect(BRAND_LIMITS.starter).toBe(1));
    it("growth = 3", () => expect(BRAND_LIMITS.growth).toBe(3));
    it("scale = Infinity", () => expect(BRAND_LIMITS.scale).toBe(Infinity));
  });

  describe("PRODUCTS_PER_BRAND_LIMITS", () => {
    it("free = 3", () => expect(PRODUCTS_PER_BRAND_LIMITS.free).toBe(3));
    it("starter = 5", () => expect(PRODUCTS_PER_BRAND_LIMITS.starter).toBe(5));
    it("growth = 20", () => expect(PRODUCTS_PER_BRAND_LIMITS.growth).toBe(20));
    it("scale = Infinity", () => expect(PRODUCTS_PER_BRAND_LIMITS.scale).toBe(Infinity));
  });

  describe("PERSONAS_PER_MONTH_LIMITS", () => {
    it("free = 1", () => expect(PERSONAS_PER_MONTH_LIMITS.free).toBe(1));
    it("starter = 2", () => expect(PERSONAS_PER_MONTH_LIMITS.starter).toBe(2));
    it("growth = 10", () => expect(PERSONAS_PER_MONTH_LIMITS.growth).toBe(10));
    it("scale = 100 (not Infinity)", () => {
      expect(PERSONAS_PER_MONTH_LIMITS.scale).toBe(100);
      expect(PERSONAS_PER_MONTH_LIMITS.scale).not.toBe(Infinity);
    });
  });

  describe("PERSONA_IMAGE_CHANGE_LIMITS (documented values)", () => {
    // This constant is not yet exported - values documented here as source of truth.
    const PERSONA_IMAGE_CHANGE_LIMITS: Record<string, number> = {
      free: 0,
      starter: 5,
      growth: Infinity,
      scale: Infinity,
    };

    it("free = 0 (no image changes)", () => expect(PERSONA_IMAGE_CHANGE_LIMITS.free).toBe(0));
    it("starter = 5", () => expect(PERSONA_IMAGE_CHANGE_LIMITS.starter).toBe(5));
    it("growth = Infinity", () => expect(PERSONA_IMAGE_CHANGE_LIMITS.growth).toBe(Infinity));
    it("scale = Infinity", () => expect(PERSONA_IMAGE_CHANGE_LIMITS.scale).toBe(Infinity));
  });

  describe("coherence: PLANS vs limit constants", () => {
    it("PLANS.starter.brands === BRAND_LIMITS.starter (1)", () => {
      expect(PLANS.starter.brands).toBe(BRAND_LIMITS.starter);
      expect(PLANS.starter.brands).toBe(1);
    });

    it("PLANS.growth.brands === BRAND_LIMITS.growth (3)", () => {
      expect(PLANS.growth.brands).toBe(BRAND_LIMITS.growth);
      expect(PLANS.growth.brands).toBe(3);
    });

    it("PLANS.starter.personas === PERSONAS_PER_MONTH_LIMITS.starter (2)", () => {
      expect(PLANS.starter.personas).toBe(PERSONAS_PER_MONTH_LIMITS.starter);
      expect(PLANS.starter.personas).toBe(2);
    });

    it("PLANS.growth.personas === PERSONAS_PER_MONTH_LIMITS.growth (10)", () => {
      expect(PLANS.growth.personas).toBe(PERSONAS_PER_MONTH_LIMITS.growth);
      expect(PLANS.growth.personas).toBe(10);
    });

    it("PLANS.scale.personas === PERSONAS_PER_MONTH_LIMITS.scale (100)", () => {
      expect(PLANS.scale.personas).toBe(PERSONAS_PER_MONTH_LIMITS.scale);
      expect(PLANS.scale.personas).toBe(100);
    });
  });

  describe("Triple Mode math - Standard (CREDITS_PER_BATCH = 15)", () => {
    it("starter: 2 batches × 27 combos = 54 unique ad combos", () => {
      const batches = Math.floor(PLANS.starter.credits / CREDITS_PER_BATCH);
      expect(batches * COMBOS_PER_BATCH).toBe(54);
    });

    it("growth: 6 batches × 27 combos = 162 unique ad combos", () => {
      const batches = Math.floor(PLANS.growth.credits / CREDITS_PER_BATCH);
      expect(batches * COMBOS_PER_BATCH).toBe(162);
    });

    it("scale: 16 batches × 27 combos = 432 unique ad combos", () => {
      const batches = Math.floor(PLANS.scale.credits / CREDITS_PER_BATCH);
      expect(batches * COMBOS_PER_BATCH).toBe(432);
    });
  });

  describe("Triple Mode math - HD (CREDITS_PER_BATCH_HD = 30)", () => {
    it("starter: 1 HD batch × 27 combos = 27 unique ad combos", () => {
      const batches = Math.floor(PLANS.starter.credits / CREDITS_PER_BATCH_HD);
      expect(batches * COMBOS_PER_BATCH).toBe(27);
    });

    it("growth: 3 HD batches × 27 combos = 81 unique ad combos", () => {
      const batches = Math.floor(PLANS.growth.credits / CREDITS_PER_BATCH_HD);
      expect(batches * COMBOS_PER_BATCH).toBe(81);
    });

    it("scale: 8 HD batches × 27 combos = 216 unique ad combos", () => {
      const batches = Math.floor(PLANS.scale.credits / CREDITS_PER_BATCH_HD);
      expect(batches * COMBOS_PER_BATCH).toBe(216);
    });
  });

  describe("CREDIT_PACKS specific pricePerCredit", () => {
    it("pack_10 pricePerCredit = 1.2", () => {
      expect(CREDIT_PACKS.pack_10.pricePerCredit).toBe(1.2);
    });

    it("pack_30 pricePerCredit = 1.1", () => {
      expect(CREDIT_PACKS.pack_30.pricePerCredit).toBe(1.1);
    });

    it("pack_100 pricePerCredit = 0.95", () => {
      expect(CREDIT_PACKS.pack_100.pricePerCredit).toBe(0.95);
    });
  });
});
