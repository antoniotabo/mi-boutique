import { Router } from 'express';
import { z } from 'zod';
import { admin,requestId,transaction,stockMove } from './core.js';
import { parseCsv,CsvError,key,MAX_BYTES } from './product-csv.js';

async function preview(db,csv){
  let parsed;
  try{parsed=parseCsv(csv);}catch(e){if(e instanceof CsvError)return {valid:false,rows:[],errors:[{row:e.row,message:e.message}]};throw e;}
  const {rows,errors}=parsed;
  if(!errors.length)for(const r of rows){
    const issue=message=>errors.push({row:r.row,message});
    const [codes]=await db.execute('SELECT sku,barcode FROM b_variants WHERE sku=? OR (barcode IS NOT NULL AND barcode=?)',[r.sku,r.barcode]);
    if(codes.length)issue('El SKU o código de barras ya existe. Para reponer existencias usa Compras o un ajuste de inventario.');
    const [[category]]=await db.execute('SELECT id,active FROM b_categories WHERE name=?',[r.category]);
    r.categoryId=category?.id||null;
    if(category&&!category.active)issue('La categoría está retirada. Actívala antes de importar.');
    if(category){
      const [products]=await db.execute('SELECT id,unit,active FROM b_products WHERE category_id=? AND name=?',[category.id,r.name]);
      if(products.length>1)issue('Hay varios productos con ese nombre en la categoría. Diferencia sus nombres antes de importar.');
      if(products.length===1){
        const p=products[0];r.productId=p.id;
        if(!p.active)issue('El producto está retirado. Actívalo antes de importar.');
        if(p.unit!==r.unit)issue('La unidad no coincide con la del producto existente.');
        const [[v]]=await db.execute('SELECT id FROM b_variants WHERE product_id=? AND size=? AND color=?',[p.id,r.size,r.color]);
        if(v)issue('Ya existe esa talla y color en el producto. Usa Compras o un ajuste para cambiar su stock.');
      }
    }
  }
  const categories=new Set(rows.filter(r=>!r.categoryId).map(r=>key(r.category)));
  const products=new Set(rows.filter(r=>!r.productId).map(r=>JSON.stringify([key(r.category),key(r.name)])));
  return {valid:!errors.length,rows,errors,summary:{variants:rows.length,categoriesCreated:categories.size,productsCreated:products.size,
    unitsAdded:rows.reduce((n,r)=>n+r.stock,0)}};
}

class InvalidImport extends Error{constructor(result){super('Corrige las filas indicadas. No se guardó ningún producto.');this.result=result;}}
export function productImportRoutes(db){
  const router=Router();router.use(admin);
  const input=z.object({csv:z.string().min(1).max(MAX_BYTES)});
  router.post('/preview',async(req,res)=>res.json(await preview(db,input.parse(req.body).csv)));
  router.post('/commit',async(req,res)=>{
    const data=input.extend({requestId}).parse(req.body);
    const result=await transaction(db,req.user,'products.import.csv',data,async(conn,user)=>{
      const checked=await preview(conn,data.csv);
      if(!checked.valid)throw new InvalidImport(checked);
      const result={categoriesCreated:0,productsCreated:0,variantsCreated:0,unitsAdded:0};
      for(const r of checked.rows){
        // Query again to reuse categories/products inserted by earlier CSV rows,
        // using MySQL's collation rather than approximating its equality in JS.
        let [[category]]=await conn.execute('SELECT id FROM b_categories WHERE name=?',[r.category]);
        if(!category){const [insert]=await conn.execute('INSERT INTO b_categories(name) VALUES(?)',[r.category]);category={id:insert.insertId};result.categoriesCreated++;}
        let [[product]]=await conn.execute('SELECT id,unit FROM b_products WHERE category_id=? AND name=?',[category.id,r.name]);
        if(!product){const [insert]=await conn.execute('INSERT INTO b_products(category_id,name,unit) VALUES(?,?,?)',[category.id,r.name,r.unit]);product={id:insert.insertId,unit:r.unit};result.productsCreated++;}
        if(product.unit!==r.unit)throw new InvalidImport({errors:[{row:r.row,message:'La unidad de venta no coincide con la de otra fila del mismo producto.'}]});
        const [variant]=await conn.execute('INSERT INTO b_variants(product_id,sku,barcode,size,color,cost,price,min_stock) VALUES(?,?,?,?,?,?,?,?)',
          [product.id,r.sku,r.barcode,r.size,r.color,r.cost,r.price,r.minStock]);
        if(r.stock)await stockMove(conn,variant.insertId,r.stock,'initial',null,'Importación CSV '+data.requestId,user.id);
        result.variantsCreated++;result.unitsAdded+=r.stock;
      }
      return result;
    },true);
    res.status(201).json(result);
  });
  router.use((err,req,res,next)=>{
    if(err instanceof InvalidImport)return res.status(422).json({message:err.message,errors:err.result.errors});
    if(err.code==='ER_DUP_ENTRY')return res.status(409).json({message:'Hay códigos o combinaciones de talla/color repetidos. No se guardó ninguna fila. Revisa el CSV y vuelve a validarlo.'});
    next(err);
  });
  return router;
}
