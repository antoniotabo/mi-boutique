// CSV exported by Excel: commas or semicolons, UTF-8, quoted fields and CRLF.
export const MAX_BYTES = 256 * 1024;
export const MAX_ROWS = 500;
export const HEADERS = ['sku','producto','categoria','talla','color','unidad','costo','precio','stock','stock_minimo','codigo_barras'];
export class CsvError extends Error {
  constructor(message, row = 1) { super(message); this.row = row; }
}
export const key = value => value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('es').trim();

export function parseCsv(source) {
  if (typeof source !== 'string' || !source.trim()) throw new CsvError('Selecciona un CSV con productos.');
  if (Buffer.byteLength(source,'utf8') > MAX_BYTES) throw new CsvError('El archivo supera 256 KB. Divídelo en archivos más pequeños.');
  if (/[\u0000\uFFFD]/u.test(source)) throw new CsvError('Guarda el archivo como CSV UTF-8.');
  let text = source.replace(/^\uFEFF/,''), line = 1;
  const directive = /^sep=([;,])\r?\n/i.exec(text);
  if (directive) { text=text.slice(directive[0].length); line++; }
  const headerLine = text.split(/\r?\n/,1)[0];
  const delimiter = directive?.[1] || (headerLine.includes(';') ? ';' : ',');
  const records=[]; let cells=[],field='',quoted=false,closed=false,start=line;
  const fieldEnd=()=>{cells.push(field);field='';closed=false;};
  const recordEnd=()=>{fieldEnd();if(cells.some(c=>c.trim()))records.push({line:start,cells});cells=[];};
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(quoted){
      if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}
      else {field+=c;if(c==='\n')line++;}
      continue;
    }
    if(c===delimiter){fieldEnd();continue;}
    if(c==='\r'||c==='\n'){
      recordEnd();if(c==='\r'&&text[i+1]==='\n')i++;line++;start=line;
      if(records.length>MAX_ROWS+1)throw new CsvError('Máximo 500 filas de productos por archivo.',start);
      continue;
    }
    if(closed)throw new CsvError('Después de cerrar comillas debe haber un separador o un salto de línea.',line);
    if(c==='"'){if(field.length)throw new CsvError('Comillas dentro de un campo sin entrecomillar.',line);quoted=true;}
    else field+=c;
  }
  if(quoted)throw new CsvError('Hay un campo con comillas sin cerrar.',start);
  recordEnd();
  if(records.length<2)throw new CsvError('El CSV debe incluir encabezados y al menos un producto.');
  if(records.length>MAX_ROWS+1)throw new CsvError('Máximo 500 filas de productos por archivo.');
  const headers=records.shift().cells.map(h=>key(h).replace(/\s+/g,'_'));
  if(new Set(headers).size!==headers.length)throw new CsvError('Hay columnas repetidas en los encabezados.');
  for(const h of headers)if(!HEADERS.includes(h))throw new CsvError(`Columna desconocida: ${h||'(vacía)'}. Usa los encabezados de la plantilla.`);
  for(const h of ['sku','producto','categoria','costo','precio','stock'])if(!headers.includes(h))throw new CsvError(`Falta la columna obligatoria ${h}.`);
  const rows=[],errors=[];
  for(const record of records){
    const row=record.line;
    if(record.cells.length!==headers.length){errors.push({row,message:`Se esperaban ${headers.length} columnas y hay ${record.cells.length}.`});continue;}
    const data=Object.fromEntries(headers.map((h,i)=>[h,record.cells[i].trim()]));
    const issue=message=>errors.push({row,message});
    for(const [name,min,max] of [['sku',1,60],['producto',2,120],['categoria',2,80],['talla',0,40],['color',0,60],['codigo_barras',0,80]]){
      const value=data[name]||'';
      if(value.length<min||value.length>max)issue(`${name}: usa entre ${min} y ${max} caracteres.`);
    }
    const unit=key(data.unidad||'unidad');
    if(!['unidad','par'].includes(unit))issue('unidad: escribe unidad o par.');
    const decimal=(name,positive)=>{
      const value=data[name]||'';
      if(!/^\d+(?:[.,]\d{1,2})?$/.test(value)){issue(`${name}: usa un número sin moneda ni separadores de miles, con hasta 2 decimales.`);return 0;}
      const n=Number(value.replace(',','.'));
      if(n>9999999.99||(positive&&n<=0))issue(`${name}: ${positive?'debe ser mayor que cero y ':''}no superar 9999999.99.`);
      return n;
    };
    const integer=name=>{
      const value=data[name]??(name==='stock_minimo'?'0':'');
      if(!/^\d+$/.test(value)||Number(value)>1000000){issue(`${name}: usa un entero entre 0 y 1000000.`);return 0;}
      return Number(value);
    };
    rows.push({row,sku:data.sku,name:data.producto,category:data.categoria,size:data.talla||'',color:data.color||'',
      unit:unit==='par'?'pair':'unit',cost:decimal('costo',false),price:decimal('precio',true),stock:integer('stock'),
      minStock:data.stock_minimo===''?0:integer('stock_minimo'),barcode:data.codigo_barras||null});
  }
  const skus=new Map(),barcodes=new Map(),variants=new Map(),units=new Map();
  for(const r of rows){
    const productKey=JSON.stringify([key(r.category),key(r.name)]);
    const duplicate=(map,value,label)=>{if(!value)return;if(map.has(value))errors.push({row:r.row,message:`${label} repetido; también aparece en la fila ${map.get(value)}.`});else map.set(value,r.row);};
    duplicate(skus,key(r.sku),'SKU');duplicate(barcodes,r.barcode&&key(r.barcode),'Código de barras');
    duplicate(variants,JSON.stringify([productKey,key(r.size),key(r.color)]),'Producto con la misma talla y color');
    if(units.has(productKey)&&units.get(productKey)!==r.unit)errors.push({row:r.row,message:'El mismo producto debe usar una sola unidad de venta.'});
    units.set(productKey,r.unit);
  }
  return {rows,errors};
}
