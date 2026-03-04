import { describe, it, expect, beforeEach } from "vitest";
import { useGenerationWizardStore } from "@/stores/generation-wizard";

describe("generation-wizard store", () => {
  beforeEach(() => {
    // Reset the store to its initial state before each test
    useGenerationWizardStore.getState().reset();
  });

  describe("initial state", () => {
    it("starts at step 1", () => {
      expect(useGenerationWizardStore.getState().step).toBe(1);
    });

    it("has null product and persona", () => {
      const state = useGenerationWizardStore.getState();
      expect(state.productId).toBeNull();
      expect(state.personaId).toBeNull();
    });

    it("defaults to single mode, standard quality", () => {
      const state = useGenerationWizardStore.getState();
      expect(state.mode).toBe("single");
      expect(state.quality).toBe("standard");
    });

    it("defaults to auto CTA style", () => {
      expect(useGenerationWizardStore.getState().ctaStyle).toBe("auto");
    });

    it("defaults to English language", () => {
      expect(useGenerationWizardStore.getState().language).toBe("en");
    });

    it("has no pending script or generation", () => {
      const state = useGenerationWizardStore.getState();
      expect(state.pendingGenerationId).toBeNull();
      expect(state.pendingScript).toBeNull();
      expect(state.creditsToCharge).toBeNull();
    });

    it("has advanced mode disabled", () => {
      const state = useGenerationWizardStore.getState();
      expect(state.advancedMode).toBe(false);
      expect(state.advancedSegments).toBeNull();
    });

    it("defaults to kling video provider", () => {
      expect(useGenerationWizardStore.getState().videoProvider).toBe("kling");
    });
  });

  describe("setProductId", () => {
    it("updates productId", () => {
      useGenerationWizardStore.getState().setProductId("prod_123");
      expect(useGenerationWizardStore.getState().productId).toBe("prod_123");
    });
  });

  describe("setPersonaId", () => {
    it("updates personaId", () => {
      useGenerationWizardStore.getState().setPersonaId("persona_abc");
      expect(useGenerationWizardStore.getState().personaId).toBe("persona_abc");
    });
  });

  describe("setStep", () => {
    it("updates step", () => {
      useGenerationWizardStore.getState().setStep(3);
      expect(useGenerationWizardStore.getState().step).toBe(3);
    });
  });

  describe("setMode", () => {
    it("updates mode to triple", () => {
      useGenerationWizardStore.getState().setMode("triple");
      expect(useGenerationWizardStore.getState().mode).toBe("triple");
    });

    it("disables advanced mode when mode changes", () => {
      const store = useGenerationWizardStore.getState();
      store.setAdvancedMode(true);
      expect(useGenerationWizardStore.getState().advancedMode).toBe(true);

      useGenerationWizardStore.getState().setMode("triple");
      const state = useGenerationWizardStore.getState();
      expect(state.advancedMode).toBe(false);
      expect(state.advancedSegments).toBeNull();
    });
  });

  describe("setQuality", () => {
    it("updates quality to hd", () => {
      useGenerationWizardStore.getState().setQuality("hd");
      expect(useGenerationWizardStore.getState().quality).toBe("hd");
    });
  });

  describe("setFormat", () => {
    it("updates format", () => {
      useGenerationWizardStore.getState().setFormat("16:9");
      expect(useGenerationWizardStore.getState().format).toBe("16:9");
    });

    it("can set format to null", () => {
      useGenerationWizardStore.getState().setFormat("9:16");
      useGenerationWizardStore.getState().setFormat(null);
      expect(useGenerationWizardStore.getState().format).toBeNull();
    });
  });

  describe("setCtaStyle", () => {
    it("updates CTA style", () => {
      useGenerationWizardStore.getState().setCtaStyle("link_in_bio");
      expect(useGenerationWizardStore.getState().ctaStyle).toBe("link_in_bio");
    });
  });

  describe("setLanguage", () => {
    it("updates language", () => {
      useGenerationWizardStore.getState().setLanguage("es");
      expect(useGenerationWizardStore.getState().language).toBe("es");
    });
  });

  describe("setPendingScript", () => {
    it("sets generation id, script, and credits", () => {
      const script = {
        hooks: [{ text: "Hook text", duration_seconds: 3, variant_label: "A" }],
        bodies: [{ text: "Body text", duration_seconds: 5, variant_label: "A" }],
        ctas: [{ text: "CTA text", duration_seconds: 2, variant_label: "A" }],
      };
      useGenerationWizardStore.getState().setPendingScript("gen_123", script, 5);

      const state = useGenerationWizardStore.getState();
      expect(state.pendingGenerationId).toBe("gen_123");
      expect(state.pendingScript).toEqual(script);
      expect(state.creditsToCharge).toBe(5);
    });
  });

  describe("updateScriptSection", () => {
    it("updates text of a specific script segment", () => {
      const script = {
        hooks: [{ text: "Original hook", duration_seconds: 3, variant_label: "A" }],
        bodies: [{ text: "Original body", duration_seconds: 5, variant_label: "A" }],
        ctas: [{ text: "Original CTA", duration_seconds: 2, variant_label: "A" }],
      };
      useGenerationWizardStore.getState().setPendingScript("gen_1", script, 5);

      useGenerationWizardStore.getState().updateScriptSection("hooks", 0, "Updated hook");
      expect(useGenerationWizardStore.getState().pendingScript!.hooks[0].text).toBe("Updated hook");
    });

    it("does nothing if no pending script", () => {
      // Should not throw
      useGenerationWizardStore.getState().updateScriptSection("hooks", 0, "no-op");
      expect(useGenerationWizardStore.getState().pendingScript).toBeNull();
    });
  });

  describe("clearPendingScript", () => {
    it("clears generation id, script, and credits", () => {
      const script = {
        hooks: [{ text: "Hook", duration_seconds: 3, variant_label: "A" }],
        bodies: [],
        ctas: [],
      };
      useGenerationWizardStore.getState().setPendingScript("gen_1", script, 10);
      useGenerationWizardStore.getState().clearPendingScript();

      const state = useGenerationWizardStore.getState();
      expect(state.pendingGenerationId).toBeNull();
      expect(state.pendingScript).toBeNull();
      expect(state.creditsToCharge).toBeNull();
    });
  });

  describe("setAdvancedMode", () => {
    it("enables advanced mode", () => {
      useGenerationWizardStore.getState().setAdvancedMode(true);
      expect(useGenerationWizardStore.getState().advancedMode).toBe(true);
    });

    it("clears advancedSegments when disabling", () => {
      const store = useGenerationWizardStore.getState();
      store.setAdvancedMode(true);
      store.setAdvancedSegments({
        hooks: [],
        bodies: [],
        ctas: [],
      });
      useGenerationWizardStore.getState().setAdvancedMode(false);

      const state = useGenerationWizardStore.getState();
      expect(state.advancedMode).toBe(false);
      expect(state.advancedSegments).toBeNull();
    });
  });

  describe("setVideoProvider", () => {
    it("switches to sora", () => {
      useGenerationWizardStore.getState().setVideoProvider("sora");
      expect(useGenerationWizardStore.getState().videoProvider).toBe("sora");
    });
  });

  describe("resumeFromGeneration", () => {
    it("hydrates the wizard state and jumps to step 5", () => {
      const script = {
        hooks: [{ text: "H", duration_seconds: 3, variant_label: "A" }],
        bodies: [{ text: "B", duration_seconds: 5, variant_label: "A" }],
        ctas: [{ text: "C", duration_seconds: 2, variant_label: "A" }],
      };
      useGenerationWizardStore.getState().resumeFromGeneration({
        generationId: "gen_resume",
        script,
        creditsToCharge: 15,
        productId: "prod_x",
        personaId: "persona_y",
        mode: "triple",
        quality: "hd",
      });

      const state = useGenerationWizardStore.getState();
      expect(state.step).toBe(5);
      expect(state.pendingGenerationId).toBe("gen_resume");
      expect(state.pendingScript).toEqual(script);
      expect(state.creditsToCharge).toBe(15);
      expect(state.productId).toBe("prod_x");
      expect(state.personaId).toBe("persona_y");
      expect(state.mode).toBe("triple");
      expect(state.quality).toBe("hd");
    });
  });

  describe("reset", () => {
    it("resets all state to defaults", () => {
      const store = useGenerationWizardStore.getState();
      store.setStep(4);
      store.setProductId("prod_1");
      store.setPersonaId("persona_1");
      store.setMode("triple");
      store.setQuality("hd");
      store.setFormat("16:9");
      store.setCtaStyle("link_in_bio");
      store.setLanguage("fr");
      store.setVideoProvider("sora");

      useGenerationWizardStore.getState().reset();

      const state = useGenerationWizardStore.getState();
      expect(state.step).toBe(1);
      expect(state.productId).toBeNull();
      expect(state.personaId).toBeNull();
      expect(state.mode).toBe("single");
      expect(state.quality).toBe("standard");
      expect(state.format).toBeNull();
      expect(state.ctaStyle).toBe("auto");
      expect(state.ctaCommentKeyword).toBe("");
      expect(state.language).toBe("en");
      expect(state.compositeImagePath).toBeNull();
      expect(state.pendingGenerationId).toBeNull();
      expect(state.pendingScript).toBeNull();
      expect(state.creditsToCharge).toBeNull();
      expect(state.advancedMode).toBe(false);
      expect(state.advancedSegments).toBeNull();
      expect(state.videoProvider).toBe("kling");
    });
  });
});
