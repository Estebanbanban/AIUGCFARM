"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// Stripe coupon IDs (server-side validated - safe to reference client-side)
// Stripe coupon ID for the new-user 30% discount offer.
// To rotate: create a new coupon in Stripe Dashboard → copy the coupon ID → update this value.
// Current coupon: 30% off, applies to Growth/Scale subscription first purchase.
export const COUPON_30_OFF = "promo_1T5XZZDofGNcXNHKRrssNcdE"; // 30% off Growth/Scale subscriptions
export const COUPON_50_OFF_STARTER = "promo_1T5Xb9DofGNcXNHKgaXOtdxQ"; // 50% off Starter subscription
export const COUPON_50_OFF_FIRST_VIDEO = "promo_1T7tW2DofGNcXNHKHTRW79iU"; // 50% off any single video during promo

const OFFER_KEY_STARTED = "cr_offer_started_at";
const OFFER_KEY_USED = "cr_offer_used";
const OFFER_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export interface FirstPurchaseOffer {
  /** Is the offer currently active (started, not expired, not used) */
  isActive: boolean;
  /** Seconds remaining on the timer */
  secondsLeft: number;
  /** Minutes:seconds formatted string e.g. "23:41" */
  timeDisplay: string;
  /** Discounted price for Growth/Scale plans (30% off) */
  discountedPrice: (original: number) => number;
  /** Discounted price for Starter plan (50% off) */
  discountedStarterPrice: (original: number) => number;
  /** Discounted price for single videos (50% off) */
  discountedVideoPrice: (original: number) => number;
  /** Returns the coupon ID to use for a subscription plan, or undefined if offer is not active */
  getSubscriptionCoupon: (plan: string) => string | undefined;
  /** Start the timer (idempotent - only sets once) */
  startOffer: () => void;
  /** Mark offer as permanently used */
  markUsed: () => void;
}

export function useFirstPurchaseOffer(): FirstPurchaseOffer {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const computeState = useCallback(() => {
    if (typeof window === "undefined") return;

    const used = localStorage.getItem(OFFER_KEY_USED) === "true";
    if (used) {
      setIsActive(false);
      setSecondsLeft(0);
      return;
    }

    const startedAtRaw = localStorage.getItem(OFFER_KEY_STARTED);
    if (!startedAtRaw) {
      setIsActive(false);
      setSecondsLeft(0);
      return;
    }

    const elapsed = Date.now() - parseInt(startedAtRaw, 10);
    const remaining = OFFER_DURATION_MS - elapsed;

    if (remaining <= 0) {
      setIsActive(false);
      setSecondsLeft(0);
    } else {
      setIsActive(true);
      setSecondsLeft(Math.ceil(remaining / 1000));
    }
  }, []);

  useEffect(() => {
    computeState();
    intervalRef.current = setInterval(computeState, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [computeState]);

  const startOffer = useCallback(() => {
    if (typeof window === "undefined") return;
    const used = localStorage.getItem(OFFER_KEY_USED) === "true";
    if (used) return;
    // Only start once - never reset if already started
    if (!localStorage.getItem(OFFER_KEY_STARTED)) {
      localStorage.setItem(OFFER_KEY_STARTED, Date.now().toString());
    }
    computeState();
  }, [computeState]);

  const markUsed = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(OFFER_KEY_USED, "true");
    setIsActive(false);
    setSecondsLeft(0);
  }, []);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeDisplay = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  const discountedPrice = useCallback(
    (original: number) => Math.floor(original * 0.7),
    [],
  );

  const discountedStarterPrice = useCallback(
    (original: number) => Math.floor(original * 0.5),
    [],
  );

  const discountedVideoPrice = useCallback(
    (original: number) => Math.floor(original * 0.5),
    [],
  );

  const getSubscriptionCoupon = useCallback(
    (plan: string): string | undefined => {
      if (!isActive) return undefined;
      return plan === "starter" ? COUPON_50_OFF_STARTER : COUPON_30_OFF;
    },
    [isActive],
  );

  return { isActive, secondsLeft, timeDisplay, discountedPrice, discountedStarterPrice, discountedVideoPrice, getSubscriptionCoupon, startOffer, markUsed };
}
