import { Component,inject,signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api,UI,Row,PageTitle,sol,message } from './core';

@Component({standalone:true,imports:[...UI,PageTitle,RouterLink],styles:[`
 .steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-bottom:24px}
 .steps h2{font-size:18px;margin:10px 0}.steps p{font-size:14px;line-height:1.6}
 .step{display:inline-flex;border-radius:50%;width:30px;height:30px;align-items:center;justify-content:center;background:#f3e8e8;color:#7a444e;font-weight:700}
 .file-box{border:1px dashed #b99a9e;border-radius:12px;padding:20px;background:#fffafa;margin:16px 0}.file-box input{max-width:100%}
 .summary{display:flex;flex-wrap:wrap;gap:22px;margin:20px 0}.summary strong{display:block;font-size:24px}.summary span{font-size:13px;color:#74676a}
 .review-actions{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:20px}
 .issues{max-height:280px;overflow:auto;padding-left:22px}.issues li{margin:8px 0}.error-row{background:#fff1ee}
 .code{font-family:monospace;white-space:nowrap}td{vertical-align:top}.table-wrap{max-width:100%}
 @media(max-width:850px){.steps{grid-template-columns:1fr}.steps .panel{margin:0}}
`],template:`
<page-title title="Importar productos" subtitle="Trae tu lista de Excel y comienza con tu inventario al día."><a routerLink="/catalog">← Volver a productos</a></page-title>
<div class="steps">
 <section class="panel"><span class="step">1</span><h2>Prepara tu lista</h2><p>Descarga la plantilla y copia los datos de tu Excel debajo de los encabezados. Borra las filas de ejemplo.</p><a href="/plantilla-productos.csv" download="plantilla-productos.csv">Descargar plantilla CSV ↓</a></section>
 <section class="panel"><span class="step">2</span><h2>Guarda como CSV</h2><p>En Excel, elige <strong>Archivo → Guardar como → CSV UTF-8</strong>. Se aceptan archivos separados por coma o punto y coma.</p></section>
 <section class="panel"><span class="step">3</span><h2>Revisa y confirma</h2><p>Selecciona el archivo, revisa precios y cantidades, y confirma la carga. Si hay errores, corrígelos en Excel y vuelve a subirlo.</p></section>
</div>
<section class="panel">
 <h2>Tu archivo de productos</h2><p>Hasta 500 filas y 256 KB por archivo. Cada talla y color ocupa una fila con su propio SKU.</p>
 <label class="file-box">Seleccionar CSV<input type="file" accept=".csv,text/csv" (click)="$any($event.target).value=''" (change)="selectFile($event)" [disabled]="checking()||api.locked"></label>
 @if(fileName()){<p><strong>{{fileName()}}</strong></p>}
 <details><summary>Cómo completar las columnas</summary><p><strong>Obligatorias:</strong> sku, producto, categoria, costo, precio y stock.</p><p><strong>Opcionales:</strong> talla, color, unidad (unidad o par), stock_minimo y codigo_barras. Si no usas talla o color, déjalos vacíos.</p><p>Los precios se expresan en soles, sin S/ ni separadores de miles. El stock debe ser un número entero; para aretes vendidos por par, cuenta pares.</p><p>Usa el mismo nombre y categoría para las variantes del mismo producto. Las categorías nuevas se crean automáticamente. Los SKU y códigos de barras deben ser únicos; en Excel usa formato Texto para conservar ceros iniciales.</p><p>Esta opción agrega códigos nuevos con stock inicial. Para reponer un código existente, usa Compras o Inventario.</p></details>
 @if(checking()){<p role="status">Revisando archivo y códigos del catálogo…</p>}
 @if(localError()){<p class="alert error" role="alert">{{localError()}}</p>}
</section>
@if(result();as done){<section class="panel" role="status"><span class="eyebrow">IMPORTACIÓN COMPLETADA</span><h2>{{done.variantsCreated}} variantes agregadas</h2><p>Se crearon {{done.productsCreated}} productos y {{done.categoriesCreated}} categorías. Se registraron {{done.unitsAdded}} existencias de stock inicial.</p><div class="inline"><a routerLink="/catalog">Ver productos →</a><a routerLink="/inventory">Revisar inventario →</a></div></section>}
@if(preview();as p){<section class="panel">
 <h2>{{p.valid?'Revisa antes de importar':'Hay datos que corregir'}}</h2>
 @if(p.errors.length){<div class="alert error" role="alert"><strong>No se ha guardado ninguna fila.</strong><ul class="issues">@for(e of p.errors;track $index){<li>Fila {{e.row}}: {{e.message}}</li>}</ul></div>}
 @if(p.valid){<div class="summary"><div><strong>{{p.summary.variants}}</strong><span>Variantes nuevas</span></div><div><strong>{{p.summary.productsCreated}}</strong><span>Productos nuevos</span></div><div><strong>{{p.summary.categoriesCreated}}</strong><span>Categorías nuevas</span></div><div><strong>{{p.summary.unitsAdded}}</strong><span>Existencias iniciales</span></div></div>}
 @if(p.rows.length){<div class="table-wrap"><table><thead><tr><th>Fila / SKU</th><th>Producto / categoría</th><th>Talla / color</th><th>Unidad</th><th>Costo</th><th>Precio</th><th>Stock / mínimo</th><th>Código de barras</th></tr></thead><tbody>
 @for(r of p.rows.slice(page*25,(page+1)*25);track r.row){<tr [class.error-row]="hasError(r.row)"><td><small>{{r.row}}</small><span class="code">{{r.sku}}</span></td><td>{{r.name}}<small>{{r.category}}</small></td><td>{{r.size||'—'}} / {{r.color||'—'}}</td><td>{{r.unit==='pair'?'Par':'Unidad'}}</td><td>{{sol(r.cost)}}</td><td>{{sol(r.price)}}</td><td>{{r.stock}} / {{r.minStock}}</td><td class="code">{{r.barcode||'—'}}</td></tr>}
 </tbody></table></div><div class="pagination"><button (click)="page=page-1" [disabled]="page===0">← Anterior</button><span>Página {{page+1}} de {{pages()}}</span><button (click)="page=page+1" [disabled]="(page+1)*25>=p.rows.length">Siguiente →</button></div>}
 @if(p.valid){<div class="review-actions"><label class="check"><input type="checkbox" [(ngModel)]="confirmed" [disabled]="api.locked"> Revisé los precios y el stock inicial.</label><button class="primary" (click)="commit()" [disabled]="!confirmed||api.locked||checking()">{{api.busy()?'Importando…':'Confirmar importación'}}</button></div><p class="hint">Se guardará el archivo completo. La carga no registra compras ni movimientos de caja.</p>}
</section>}
`})
export class ProductImport{
 api=inject(Api);sol=sol;checking=signal(false);fileName=signal('');localError=signal('');preview=signal<Row|null>(null);result=signal<Row|null>(null);
 confirmed=false;page=0;private csv='';
 pages(){return Math.ceil((this.preview()?.rows.length||0)/25);}
 hasError(row:number){return this.preview()?.errors.some((e:Row)=>e.row===row);}
 async selectFile(event:Event){
   const input=event.target as HTMLInputElement,file=input.files?.[0];
   if(!file||this.checking()||this.api.locked)return;
   this.preview.set(null);this.result.set(null);this.localError.set('');this.confirmed=false;this.page=0;this.csv='';this.fileName.set(file.name);
   if(!file.name.toLowerCase().endsWith('.csv')){this.localError.set('Guarda tu Excel como CSV UTF-8 y selecciona el archivo .csv.');return;}
   if(file.size>256*1024){this.localError.set('El archivo supera 256 KB. Divídelo en archivos más pequeños.');return;}
   this.checking.set(true);
   try{
     try{this.csv=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());}catch{throw new Error('No se pudo leer el archivo. Vuelve a guardarlo desde Excel como CSV UTF-8.');}
     this.preview.set(await this.api.post('imports/products/preview',{csv:this.csv}));
   }catch(e){this.localError.set(message(e));}finally{this.checking.set(false);}
 }
 async commit(){
   if(!this.confirmed||!this.preview()?.valid||this.api.locked||this.checking())return;
   this.localError.set('');
   try{this.result.set(await this.api.save('imports/products/commit',{csv:this.csv},false,true));this.preview.set(null);this.csv='';this.confirmed=false;}
   catch(e:any){this.localError.set(message(e));if(e?.error?.errors)this.preview.set({...this.preview(),valid:false,errors:e.error.errors});}
 }
}
