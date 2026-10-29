"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const cleanupDevelopmentWorkers = async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));

        if ("caches" in window) {
          const cacheNames = await caches.keys();
          await Promise.all(
            cacheNames
              .filter((name) => name.startsWith("yosseling-"))
              .map((name) => caches.delete(name))
          );
        }
      } catch (error) {
        console.error("[Yosseling] Service Worker development cleanup failed:", error);
      }
    };

    if (process.env.NODE_ENV !== "production") {
      void cleanupDevelopmentWorkers();
      return;
    }

    const registerProductionWorker = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
      } catch (error) {
        console.error("[Yosseling] Service Worker registration failed:", error);
      }
    };

    void registerProductionWorker();
  }, []);

  return null;
}
