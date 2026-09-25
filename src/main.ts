import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { inject } from '@vercel/analytics';
// import { injectSpeedInsights } from '@vercel/speed-insights';

// Cleanup any lingering service workers and caches from previous PWA installations
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
  if ('caches' in window) {
    caches.keys().then((keys) => {
      keys.forEach((key) => caches.delete(key));
    });
  }
}

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch((err) => console.error(err));

inject();
// Speed Insights are currently disabled as they triggered quota limits pausing the deployment.
// injectSpeedInsights();
