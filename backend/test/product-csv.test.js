import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv,CsvError,MAX_BYTES} from '../src/product-csv.js';
const header='sku,producto,categoria,costo,precio,stock';
test('CSV Excel UTF8 con comas, BOM y ceros iniciales',()=>{
 const r=parseCsv('\uFEFF'+header+',codigo_barras\r\n001,Aretes,Bisutería,8,19.90,12,0000123\r\n');
 assert.deepEqual(r.errors,[]);assert.equal(r.rows[0].sku,'001');assert.equal(r.rows[0].barcode,'0000123');assert.equal(r.rows[0].price,19.9);
});
test('punto y coma, decimales con coma, comillas y saltos internos',()=>{
 const r=parseCsv('sep=;\r\nsku;producto;categoria;costo;precio;stock\r\nA;"Blusa; lino ""premium""\nblanca";Ropa;10,50;20,90;0\r\n\r\n');
 assert.deepEqual(r.errors,[]);assert.equal(r.rows[0].cost,10.5);assert.equal(r.rows[0].row,3);assert.match(r.rows[0].name,/"premium"\nblanca/);
});
test('rechaza encabezados omitidos, duplicados y desconocidos',()=>{
 for(const csv of ['sku,stock\nA,2',header+',sku\nA,Blusa,Ropa,1,2,3,B',header+',descuento\nA,Blusa,Ropa,1,2,3,0'])assert.throws(()=>parseCsv(csv),CsvError);
});
test('rechaza comillas mal cerradas y columnas desalineadas',()=>{
 assert.throws(()=>parseCsv(header+'\nA,"Blusa,Ropa,1,2,3'),/sin cerrar/);
 assert.throws(()=>parseCsv(header+'\nA,"Blusa" x,Ropa,1,2,3'),/Después/);
 assert.equal(parseCsv(header+'\nA,Blusa,Ropa,1,2,3,4').errors.length,1);
});
test('valida precios, stock, unidad y duplicados por talla/color',()=>{
 const r=parseCsv(header+',unidad\nA,Blusa,Ropa,1,0,-1,caja\na,Blusa,Ropa,S\/10,2,1,unidad');
 assert.ok(r.errors.some(e=>e.message.includes('SKU')));assert.ok(r.errors.some(e=>e.message.includes('misma talla')));
 assert.ok(r.errors.some(e=>e.message.startsWith('precio')));assert.ok(r.errors.some(e=>e.message.startsWith('stock')));
 assert.ok(r.errors.some(e=>e.message.startsWith('unidad')));
});
test('límites de archivo y número de filas',()=>{
 assert.throws(()=>parseCsv('a'.repeat(MAX_BYTES+1)),/256 KB/);
 assert.throws(()=>parseCsv(header+'\n'+Array.from({length:501},(_,i)=>`${i},Blusa ${i},Ropa,1,2,1`).join('\n')),/500 filas/);
 assert.equal(parseCsv(header+'\n'+Array.from({length:500},(_,i)=>`${i},Blusa ${i},Ropa,1,2,1`).join('\n')).rows.length,500);
});
test('no redondea cifras inválidas, no transforma números científicos ni fórmulas',()=>{
 for(const value of ['1.234','1e3','=1+2','S/20','1,000.00','-1',''])assert.ok(parseCsv(header+`\nA,Blusa,Ropa,1,${JSON.stringify(value)},2`).errors.length);
});
