import {createPending,definitiveFailure} from './operation.mjs';
import { Injectable, inject, signal, Component, input, output } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
export const UI=[CommonModule,FormsModule];
export type Row=Record<string,any>;
export const sol=(value:unknown)=>new Intl.NumberFormat('es-PE',{style:'currency',currency:'PEN'}).format(Number(value||0));
export const localDate=(value:string)=>value?new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',dateStyle:'short',timeStyle:'short'}).format(new Date(value.includes('T')?value:value.replace(' ','T')+'Z')):'';
export const today=()=>new Date(Date.now()-5*3600000).toISOString().slice(0,10);
export function message(error:any){return error?.error?.message||error?.message||'No se pudo conectar. Comprueba que el backend esté encendido.';}
@Injectable({providedIn:'root'})
export class Api{
 private http=inject(HttpClient);
 user=signal<Row|null>(null);busy=signal(false);notice=signal('');error=signal('');pending=signal<Row|null>(null);settings=signal<Row>({business_name:'Mi Boutique'});
 get admin(){return this.user()?.['role']==='admin';}
 get<T=any>(path:string){return firstValueFrom(this.http.get<T>('/api/'+path));}
 post<T=any>(path:string,data:any){return firstValueFrom(this.http.post<T>('/api/'+path,data));}
 put<T=any>(path:string,data:any){return firstValueFrom(this.http.put<T>('/api/'+path,data));}
 async restore(){try{this.user.set(await this.get('auth/me'));this.restorePending();return true;}catch{this.user.set(null);return false;}}
 private key(){return 'boutique-pending-'+this.user()?.['id'];}
 restorePending(){try{const raw=localStorage.getItem(this.key());this.pending.set(raw?JSON.parse(raw):null);}catch{this.pending.set(null);}}
 async login(username:string,password:string){this.user.set(await this.post('auth/login',{username,password}));this.restorePending();}
 async loadSettings(){try{this.settings.set(await this.get('settings'));}catch{}}
 async logout(){if(this.busy())return;try{await this.post('auth/logout',{});}catch(e){if(!(e instanceof HttpErrorResponse&&e.status===401))throw e;}this.user.set(null);this.pending.set(null);}
 async read(work:()=>Promise<void>){this.error.set('');try{await work();}catch(e){this.error.set(message(e));}}
 async save(path:string,data:any,put=false,financial=false){
   if(this.busy()||this.pending())throw new Error('Resuelve la operación pendiente antes de continuar.');
   const pending=financial?createPending(path,data,put,crypto.randomUUID()):{path,data,put};
   const payload=pending.data;
   if(financial){localStorage.setItem(this.key(),JSON.stringify(pending));this.pending.set(pending);}
   this.busy.set(true);this.error.set('');this.notice.set('');
   try{const result=await (put?this.put(path,payload):this.post(path,payload));if(financial){localStorage.removeItem(this.key());this.pending.set(null);}this.notice.set('Guardado correctamente.');return result;}
   catch(e){if(financial&&e instanceof HttpErrorResponse&&definitiveFailure(e.status)){localStorage.removeItem(this.key());this.pending.set(null);}this.error.set(message(e));throw e;}
   finally{this.busy.set(false);}
 }
 async retry(){const pending=this.pending();if(!pending||this.busy())return;this.busy.set(true);this.error.set('');try{
   await (pending['put']?this.put(pending['path'],pending['data']):this.post(pending['path'],pending['data']));
   localStorage.removeItem(this.key());this.pending.set(null);location.reload();
 }catch(e){if(e instanceof HttpErrorResponse&&definitiveFailure(e.status)){localStorage.removeItem(this.key());this.pending.set(null);}this.error.set(message(e));}finally{this.busy.set(false);}}
 get locked(){return this.busy()||!!this.pending();}
 async all(path:string){const rows:Row[]=[];for(let offset=0;offset<20000;offset+=200){const part=await this.get<Row[]>(path+(path.includes('?')?'&':'?')+'limit=200&offset='+offset);rows.push(...part);if(part.length<200)return rows;}throw new Error('El catálogo supera 20 000 registros. Usa una búsqueda más específica.');}
}
@Component({selector:'page-title',standalone:true,template:`<div class="page-heading"><div><span class="eyebrow">{{eyebrow()}}</span><h1>{{title()}}</h1><p>{{subtitle()}}</p></div><ng-content /></div>`})
export class PageTitle{title=input('');subtitle=input('');eyebrow=input('MI BOUTIQUE');}
@Component({selector:'empty-state',standalone:true,template:`<div class="empty"><span class="empty-icon">◇</span><h3>{{title()}}</h3><p>{{text()}}</p></div>`})
export class EmptyState{title=input('Todavía no hay registros');text=input('Los registros aparecerán aquí cuando empieces.');}

