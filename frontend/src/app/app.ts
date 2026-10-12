import { Component,inject,signal } from '@angular/core';
import { NavigationEnd,Router,RouterOutlet,RouterLink,RouterLinkActive,Routes,CanActivateFn } from '@angular/router';
import { Api,UI,message } from './core';
import { Dashboard } from './dashboard';
import { Catalog } from './catalog';
import { ProductImport } from './product-import';
import { Checkout } from './checkout';
import { Inventory } from './inventory';
import { Cash } from './cash';
import { History } from './history';
import { Contacts } from './contacts';
import { Reports } from './reports';
import { Settings,Users,Backups,Account } from './management';
const auth:CanActivateFn=async()=>{const api=inject(Api),router=inject(Router);if(!api.user()&&!await api.restore())return router.parseUrl('/login');if(api.user()?.['mustChangePassword'])return router.parseUrl('/account');return true;};
const admin:CanActivateFn=async()=>{const api=inject(Api),router=inject(Router);return api.admin?true:router.parseUrl('/sell');};
@Component({selector:'login-page',standalone:true,imports:UI,template:`<main class="login"><section class="login-art"><span class="brand-mark">b.</span><p class="eyebrow">TU NEGOCIO, EN ORDEN</p><h1>Más tiempo para<br>hacer crecer<br>tu boutique.</h1><p>Ventas, prendas y pequeños detalles.<br>Todo en un solo lugar.</p><div class="art-circle"></div></section><section class="login-form"><span class="eyebrow">BIENVENIDA DE NUEVO</span><h1>Ingresa a tu tienda</h1><p>Usa tu cuenta para comenzar el día.</p><form (ngSubmit)="login()"><label>Usuario<input name="username" [(ngModel)]="username" autocomplete="username" required></label><label>Contraseña<input name="password" type="password" [(ngModel)]="password" autocomplete="current-password" required></label>@if(error()){<p class="alert error" role="alert">{{error()}}</p>}<button class="primary full" [disabled]="busy()">{{busy()?'Ingresando…':'Ingresar a mi boutique →'}}</button></form><small>¿No tienes una cuenta? Pídele acceso al administrador.</small></section></main>`})
export class Login{api=inject(Api);router=inject(Router);username='';password='';busy=signal(false);error=signal('');async login(){this.busy.set(true);try{await this.api.login(this.username,this.password);await this.router.navigateByUrl(this.api.user()?.['mustChangePassword']?'/account':'/');}catch(e){this.error.set(message(e));}finally{this.busy.set(false);}}}
@Component({selector:'app-root',standalone:true,imports:[...UI,RouterOutlet,RouterLink,RouterLinkActive],template:`
@if(api.user()){
 <div class="workspace"><aside [class.open]="mobile()"><a class="brand" routerLink="/"><span class="brand-mark">b.</span><span>{{api.settings()['business_name']}}<small>GESTIÓN DE BOUTIQUE</small></span></a>
 <nav aria-label="Menú principal">@for(link of links;track link.path){@if(!link.admin||api.admin){<a [routerLink]="link.path" routerLinkActive="selected" [routerLinkActiveOptions]="{exact:true}" (click)="mobile.set(false)"><span>{{link.icon}}</span>{{link.label}}</a>}}</nav>
 <div class="sidebar-bottom"><a routerLink="/account">{{api.user()?.['username']}}<small>{{api.admin?'Administración':'Ventas'}}</small></a><button class="text" (click)="logout()" [disabled]="api.busy()">Cerrar sesión ↗</button></div></aside>
 <div class="main"><header><button class="menu-toggle" (click)="mobile.set(!mobile())" aria-label="Abrir menú">☰</button><span>Tu tienda, al día.</span><div><span class="status-dot"></span> {{date}}</div></header>
 <main class="content">@if(api.pending()){<div class="alert warning" role="alert"><strong>Hay una operación sin confirmar.</strong> No la registres otra vez. Reintenta la misma solicitud para comprobarla.<button (click)="api.retry()" [disabled]="api.busy()">Reintentar operación</button></div>}
 @if(api.error()){<div class="alert error" role="alert">{{api.error()}}<button class="text" (click)="api.error.set('')">Cerrar</button></div>}
 @if(api.notice()){<div class="alert success" role="status">{{api.notice()}}<button class="text" (click)="api.notice.set('')">Cerrar</button></div>}
 <router-outlet /></main><footer>Boutique · Hecho para tu día a día</footer></div></div>
} @else {<router-outlet />}`})
export class App{
 api=inject(Api);router=inject(Router);mobile=signal(false);date=new Intl.DateTimeFormat('es-PE',{dateStyle:'long',timeZone:'America/Lima'}).format(new Date());
 links=[{path:'/',label:'Inicio',icon:'◈',admin:false},{path:'/sell',label:'Nueva venta',icon:'＋',admin:false},{path:'/catalog',label:'Productos',icon:'▦',admin:false},{path:'/inventory',label:'Inventario',icon:'▤',admin:false},{path:'/sales',label:'Ventas y devoluciones',icon:'↗',admin:false},{path:'/purchases',label:'Compras',icon:'↙',admin:true},{path:'/cash',label:'Caja',icon:'▣',admin:false},{path:'/customers',label:'Clientes',icon:'○',admin:false},{path:'/suppliers',label:'Proveedores',icon:'□',admin:true},{path:'/reports',label:'Reportes',icon:'▥',admin:true},{path:'/users',label:'Usuarios',icon:'◉',admin:true},{path:'/settings',label:'Configuración',icon:'⚙',admin:true},{path:'/backups',label:'Respaldos',icon:'↧',admin:true}];
 constructor(){this.router.events.subscribe(event=>{if(event instanceof NavigationEnd&&this.api.user()&&!this.api.user()?.['mustChangePassword'])void this.api.loadSettings();});}
 async logout(){await this.api.read(async()=>{await this.api.logout();await this.router.navigateByUrl('/login');});}
}
export const routes:Routes=[{path:'login',component:Login},{path:'account',component:Account,canActivate:[async()=>{const a=inject(Api),r=inject(Router);return a.user()||await a.restore()?true:r.parseUrl('/login');}]},
 {path:'',canActivate:[auth],children:[{path:'',component:Dashboard},{path:'sell',component:Checkout},{path:'catalog/import',component:ProductImport,canActivate:[admin]},{path:'catalog',component:Catalog},{path:'inventory',component:Inventory},{path:'sales',component:History},{path:'purchases',component:History,canActivate:[admin],data:{purchase:true}},{path:'purchase/new',component:Checkout,canActivate:[admin],data:{purchase:true}},{path:'cash',component:Cash},{path:'customers',component:Contacts},{path:'suppliers',component:Contacts,canActivate:[admin],data:{supplier:true}},{path:'reports',component:Reports,canActivate:[admin]},{path:'users',component:Users,canActivate:[admin]},{path:'settings',component:Settings,canActivate:[admin]},{path:'backups',component:Backups,canActivate:[admin]}]}, {path:'**',redirectTo:''}];

