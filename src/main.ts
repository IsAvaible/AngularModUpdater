import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { inject } from '@vercel/analytics';
// import { injectSpeedInsights } from '@vercel/speed-insights';

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch((err) => console.error(err));

inject();
// Speed Insights are currently disabled as they triggered quota limits pausing the deployment.
// injectSpeedInsights();
