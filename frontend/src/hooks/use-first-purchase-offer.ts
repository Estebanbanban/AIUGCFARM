"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// Stripe coupon IDs (server-side validated - safe to reference client-side)
export const COUPON_30_OFF = "promo_1T5XZZDofGNcXNHKRrssNcdE"; // 30% off Growth/Scale subscriptions
export const COUPON_50_OFF_STARTER = "promo_1T5Xb9DofGNcXNHKgaXOtdxQ"; // 50% off Starter subscription
export const COUPON_50_OFF_FIRST_VIDEO = "promo_1T7tW2DofGNcXNHKHTRW79iU"; // 50% off any single video during promo

const OFFER_KEY_STARTED = "cr_offer_started_at";
const OFFER_KEY_USED = "cr_offer_used";
const OFFER_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Custom event dispatched whenever the offer state changes in localStorage.
// Allows all hook instances on the same page to update instantly (no 1s delay).
const OFFER_CHANGE_EVENT = "cr-offer-change";

export interface FirstPurchaseOffer {
  isActive: boolean;
  secondsLeft: number;
  timeDisplay: string;
  discountedPrice: (original: number) => number;
  discountedStarterPrice: (original: number) => number;
  discountedVideoPrice: (original: number) => number;
  getSubscriptionCoupon: (plan: string) => string | undefined;
  startOffer: () => void;
  markUsed: () => void;
}

function readOfferFromStorage(): { isActive: boolean; secondsLeft: number } {
  if (typeof window === "undefined") return { isActive: false, secondsLeft: 0 };
  if (localStorage.getItem(OFFER_KEY_USED) === "true") return { isActive: false, secondsLeft: 0 };
  const startedAtRaw = localStorage.getItem(OFFER_KEY_STARTED);
  if (!startedAtRaw) return { isActive: false, secondsLeft: 0 };
  const remaining = OFFER_DURATION_MS - (Date.now() - parseInt(startedAtRaw, 10));
  if (remaining <= 0) return { isActive: false, secondsLeft: 0 };
  return { isActive: true, secondsLeft: Math.ceil(remaining / 1000) };
}

export function useFirstPurchaseOffer(): FirstPurchaseOffer {
  // Start false/0 to match server render (no localStorage on server).
  // The useEffect below syncs the real state after hydration.
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
    // Sync immediately on mount (handles returning users with active offer)
    computeState();
    // Listen for instant cross-instance updates (e.g. startOffer called from another component)
    window.addEventListener(OFFER_CHANGE_EVENT, computeState);
    // Tick every second to update the countdown display
    intervalRef.current = setInterval(computeState, 1000);
    return () => {
      window.removeEventListener(OFFER_CHANGE_EVENT, computeState);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [computeState]);

  const startOffer = useCallback(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(OFFER_KEY_USED) === "true") return;
    if (!localStorage.getItem(OFFER_KEY_STARTED)) {
      localStorage.setItem(OFFER_KEY_STARTED, Date.now().toString());
    }
    // Notify all hook instances immediately (no 1s delay)
    window.dispatchEvent(new Event(OFFER_CHANGE_EVENT));
    computeState();
  }, [computeState]);

  const markUsed = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(OFFER_KEY_USED, "true");
    window.dispatchEvent(new Event(OFFER_CHANGE_EVENT));
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
