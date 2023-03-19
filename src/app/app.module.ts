import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NgxDropzoneModule } from 'ngx-dropzone';
import { HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';
import { TitleComponent } from './title/title.component';
import { DescriptionComponent } from './description/description.component';
import { VersionSelectorComponent } from './version-selector/version-selector.component';
import { FileDropzoneComponent } from './file-dropzone/file-dropzone.component';
import { StartButtonComponent } from './start-button/start-button.component';
import { FooterComponent } from './footer/footer.component';
import { ModPanelComponent } from './mod-panel/mod-panel.component';
import { ModCardComponent } from './mod-card/mod-card.component';
import {FormsModule} from "@angular/forms";
import {OrderModule} from "ngx-order-pipe";
import { DateAgoPipe } from './pipes/date-ago/date-ago.component';
import { ShortNumberPipe } from './pipes/short-number/short-number.component';
import { LoaderSelectorComponent } from './loader-selector/loader-selector.component';

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
    LoaderSelectorComponent
  ],
    imports: [
        BrowserModule,
        BrowserAnimationsModule,
        NgxDropzoneModule,
        HttpClientModule,
        FormsModule,
        OrderModule
    ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
