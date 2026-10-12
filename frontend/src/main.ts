import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { App, routes } from './app/app';
bootstrapApplication(App,{providers:[provideHttpClient(),provideRouter(routes)]}).catch(console.error);
