'use client';

import { useEffect } from 'react';

export default function PWARegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    // Capture whether there was already an active SW controller BEFORE we
    // register. If there was no controller this is a first-time install, NOT
    // an update — we must NOT reload in that case or form inputs get wiped.
    const hadController = Boolean(navigator.serviceWorker.controller);

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[PWA] Service Worker registered, scope:', reg.scope);

        // When a brand-new SW is found, tell it to skip waiting so it
        // activates quickly — but only send the message, don't reload yet.
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (
                newWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                // An update is ready; let it activate (SKIP_WAITING was
                // already called in the SW install handler).
                console.log('[PWA] New version available.');
              }
            });
          }
        });

        // Poll for updates every 5 minutes (not every 60 s to reduce traffic)
        setInterval(() => reg.update(), 5 * 60_000);
      })
      .catch((err) => {
        console.warn(
          '[PWA] Service Worker registration failed (expected with self-signed cert locally):',
          err
        );
      });

    // Only reload when a NEW SW takes over from an OLD one (i.e. an actual
    // update). On a first-ever install hadController is false so we skip the
    // reload entirely — this is what was wiping the register form.
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator &&
        (window.navigator as any).standalone === true);
    console.log('[PWA] Running in standalone mode:', isStandalone);
  }, []);

  return null;
}
