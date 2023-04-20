import {NgModule, isDevMode, SecurityContext} from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NgxDropzoneModule } from 'ngx-dropzone';
import {HttpClient, HttpClientModule} from '@angular/common/http';

import { AppComponent } from './app.component';
import { TitleComponent } from './components/title/title.component';
import { DescriptionComponent } from './components/description/description.component';
import { VersionSelectorComponent } from './components/version-selector/version-selector.component';
import { FileDropzoneComponent } from './components/file-dropzone/file-dropzone.component';
import { StartButtonComponent } from './components/start-button/start-button.component';
import { FooterComponent } from './components/footer/footer.component';
import { ModPanelComponent } from './components/mod-panel/mod-panel.component';
import { ModCardComponent } from './components/mod-card/mod-card.component';
import {FormsModule} from "@angular/forms";
import {OrderModule} from "ngx-order-pipe";
import { DateAgoPipe } from './pipes/date-ago/date-ago.pipe';
import { ShortNumberPipe } from './pipes/short-number/short-number.pipe';
import { LoaderSelectorComponent } from './components/loader-selector/loader-selector.component';
import { ServiceWorkerModule } from '@angular/service-worker';
import { InfoTriangleComponent } from './components/info-triangle/info-triangle.component';
import { InfoSectionComponent } from './components/info-section/info-section.component';
import {MarkdownModule} from "ngx-markdown";
import { ModStatusLabelComponent } from './components/mod-card/mod-status-label/mod-status-label.component';

@NgModule({
  declarations: [
    AppComponent,
    TitleComponent,
    DescriptionComponent,
    VersionSelectorComponent,
    FileDropzoneComponent,
    StartButtonComponent,
    FooterComponent,
    ModPanelComponent,
    ModCardComponent,
    DateAgoPipe,
    ShortNumberPipe,
    LoaderSelectorComponent,
    InfoTriangleComponent,
    InfoSectionComponent,
    ModStatusLabelComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    NgxDropzoneModule,
    HttpClientModule,
    FormsModule,
    OrderModule,
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: !isDevMode(),
      // Register the ServiceWorker as soon as the application is stable
      // or after 30 seconds (whichever comes first).
      registrationStrategy: 'registerWhenStable:30000'
    }),
    MarkdownModule.forRoot({ loader: HttpClient, sanitize: SecurityContext.NONE })
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
