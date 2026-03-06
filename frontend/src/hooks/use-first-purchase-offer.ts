"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// Stripe coupon IDs (server-side validated - safe to reference client-side)
// Stripe coupon ID for the new-user 30% discount offer.
// To rotate: create a new coupon in Stripe Dashboard → copy the coupon ID → update this value.
// Current coupon: 30% off, applies to first subscription purchase only.
export const COUPON_30_OFF = "t9QmsQTe"; // 30% off any plan, once - NewUsers
// Stripe coupon ID for 50% off first single-video purchase. Coupon ID: VIDEO50
export const COUPON_50_OFF_FIRST_VIDEO = "VIDEO50";

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
  /** Discounted price given a full price (30% off) */
  discountedPrice: (original: number) => number;
  /** Discounted price for first video (50% off) */
  discountedVideoPrice: (original: number) => number;
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

  const discountedVideoPrice = useCallback(
    (original: number) => Math.floor(original * 0.5),
    [],
  );

  return { isActive, secondsLeft, timeDisplay, discountedPrice, discountedVideoPrice, startOffer, markUsed };
}
