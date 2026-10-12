import { Router } from 'express';
import { z } from 'zod';
import { id, money, requestId, transaction, fail, page, stockMove } from './core.js';

const categorySchema = z.object({ name: z.string().trim().min(2).max(80), active: z.boolean().default(true) }).strict();
const imageUrl = z.string().max(1000).default('').refine(s => !s || /^https?:\/\//i.test(s), 'Usa una URL http(s) o deja la foto vacia.');
const productSchema = z.object({ categoryId: id, name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).default(''), imageUrl, unit: z.enum(['unit','pair']).default('unit'), active: z.boolean().default(true) }).strict();
const variantSchema = z.object({ sku: z.string().trim().min(1).max(60), barcode: z.string().trim().min(1).max(80).nullable().default(null),
  size: z.string().trim().max(40).default(''), color: z.string().trim().max(60).default(''),
  cost: money, price: money.refine(n=>n>0), minStock: z.number().int().min(0).max(1000000).default(0), active: z.boolean().default(true) }).strict();
const partySchema = z.object({ name:z.string().trim().min(2).max(120), document:z.string().trim().min(1).max(30).nullable().default(null),
  phone:z.string().trim().max(30).default(''), address:z.string().trim().max(250).default(''), active:z.boolean().default(true) }).strict();

async function categoryExists(conn, categoryId) {
  const [[row]] = await conn.execute('SELECT id FROM b_categories WHERE id=? AND active=1',[categoryId]);
  if (!row) fail('Categoria inexistente o desactivada.',400);
}
export function catalogRoutes(db) {
  const router = Router();
  router.get('/categories', async (req,res) => {
    const [rows] = await db.query('SELECT * FROM b_categories ORDER BY name'); res.json(rows);
  });
  router.post('/categories', async(req,res)=>{
    const data=categorySchema.parse(req.body);
    res.status(201).json(await transaction(db,req.user,'category.create',data,async c=>{
      const [r]=await c.execute('INSERT INTO b_categories(name,active) VALUES(?,?)',[data.name,data.active]); return {id:r.insertId,...data};
    },true));
  });
  router.put('/categories/:id',async(req,res)=>{
    const categoryId=id.parse(req.params.id), data=categorySchema.parse(req.body);
    res.json(await transaction(db,req.user,'category.update',data,async c=>{
      if (!data.active) {
        const [[used]]=await c.execute('SELECT COUNT(*) AS n FROM b_products WHERE category_id=? AND active=1',[categoryId]);
        if(Number(used.n)) fail('Desactiva o cambia de categoria los productos activos primero.');
      }
      const [r]=await c.execute('UPDATE b_categories SET name=?,active=? WHERE id=?',[data.name,data.active,categoryId]);
      if(!r.affectedRows) fail('Categoria no encontrada.',404); return {id:categoryId,...data};
    },true));
  });
  router.get('/products',async(req,res)=>{
    const {limit,offset}=page(req.query); const search=z.string().max(120).default('').parse(req.query.search);
    const categoryId=req.query.categoryId ? id.parse(req.query.categoryId) : null;
    const [rows]=await db.execute(`SELECT p.*,c.name AS category_name,
      COALESCE((SELECT SUM(v.stock) FROM b_variants v WHERE v.product_id=p.id),0) AS stock
      FROM b_products p JOIN b_categories c ON c.id=p.category_id
      WHERE (?=1 OR p.active=1) AND (? IS NULL OR p.category_id=?) AND p.name LIKE ? ORDER BY p.name LIMIT ${limit} OFFSET ${offset}`,
      [req.query.includeInactive==='1',categoryId,categoryId,`%${search}%`]); res.json(rows);
  });
  router.get('/products/:id',async(req,res)=>{
    const productId=id.parse(req.params.id); const [[product]]=await db.execute('SELECT * FROM b_products WHERE id=?',[productId]);
    if(!product) fail('Producto no encontrado.',404);
    const [variants]=await db.execute('SELECT * FROM b_variants WHERE product_id=? ORDER BY id',[productId]); res.json({...product,variants});
  });
  router.post('/products',async(req,res)=>{
    const data=productSchema.parse(req.body);
    res.status(201).json(await transaction(db,req.user,'product.create',data,async c=>{
      await categoryExists(c,data.categoryId);
      const [r]=await c.execute('INSERT INTO b_products(category_id,name,description,image_url,unit,active) VALUES(?,?,?,?,?,?)',
        [data.categoryId,data.name,data.description,data.imageUrl,data.unit,data.active]); return {id:r.insertId,...data};
    },true));
  });
  router.put('/products/:id',async(req,res)=>{
    const productId=id.parse(req.params.id), data=productSchema.parse(req.body);
    res.json(await transaction(db,req.user,'product.update',data,async c=>{
      await categoryExists(c,data.categoryId);
      const [[old]]=await c.execute('SELECT unit FROM b_products WHERE id=?',[productId]); if(!old)fail('Producto no encontrado.',404);
      if(old.unit!==data.unit){
        const [[used]]=await c.execute('SELECT COUNT(*) AS n FROM b_stock_movements m JOIN b_variants v ON v.id=m.variant_id WHERE v.product_id=?',[productId]);
        if(Number(used.n)) fail('No puedes cambiar unidad/par si el producto ya tiene movimientos.');
      }
      await c.execute('UPDATE b_products SET category_id=?,name=?,description=?,image_url=?,unit=?,active=? WHERE id=?',
        [data.categoryId,data.name,data.description,data.imageUrl,data.unit,data.active,productId]); return {id:productId,...data};
    },true));
  });
  router.post('/products/:id/variants',async(req,res)=>{
    const productId=id.parse(req.params.id), data=variantSchema.parse(req.body);
    res.status(201).json(await transaction(db,req.user,'variant.create',data,async c=>{
      const [[p]]=await c.execute('SELECT id FROM b_products WHERE id=? AND active=1',[productId]); if(!p)fail('Producto no disponible.',404);
      const [r]=await c.execute('INSERT INTO b_variants(product_id,sku,barcode,size,color,cost,price,min_stock,active) VALUES(?,?,?,?,?,?,?,?,?)',
        [productId,data.sku,data.barcode,data.size,data.color,data.cost,data.price,data.minStock,data.active]); return {id:r.insertId,...data,stock:0};
    },true));
  });
  router.put('/variants/:id',async(req,res)=>{
    const variantId=id.parse(req.params.id), data=variantSchema.parse(req.body);
    res.json(await transaction(db,req.user,'variant.update',data,async c=>{
      const [[v]]=await c.execute('SELECT * FROM b_variants WHERE id=?',[variantId]); if(!v)fail('Variante no encontrada.',404);
      if(v.size!==data.size || v.color!==data.color){
        const [[m]]=await c.execute('SELECT COUNT(*) AS n FROM b_stock_movements WHERE variant_id=?',[variantId]);
        if(Number(m.n))fail('Con movimientos registrados, crea otra variante para cambiar talla o color.');
      }
      await c.execute('UPDATE b_variants SET sku=?,barcode=?,size=?,color=?,cost=?,price=?,min_stock=?,active=? WHERE id=?',
        [data.sku,data.barcode,data.size,data.color,data.cost,data.price,data.minStock,data.active,variantId]); return {id:variantId,...data};
    },true));
  });
  router.get('/variants',async(req,res)=>{
    const {limit,offset}=page(req.query), search=z.string().max(120).default('').parse(req.query.search);
    const [rows]=await db.execute(`SELECT v.*,p.name,p.unit,p.image_url,c.name AS category_name,p.active AS product_active
      FROM b_variants v JOIN b_products p ON p.id=v.product_id JOIN b_categories c ON c.id=p.category_id
      WHERE (?=1 OR (v.active=1 AND p.active=1 AND c.active=1))
      AND (v.sku LIKE ? OR v.barcode LIKE ? OR p.name LIKE ?) ORDER BY p.name,v.id LIMIT ${limit} OFFSET ${offset}`,
      [req.query.includeInactive==='1',`%${search}%`,`%${search}%`,`%${search}%`]); res.json(rows);
  });
  for(const resource of ['customers','suppliers']) {
    const table=`b_${resource}`;
    router.get('/'+resource,async(req,res)=>{
      const {limit,offset}=page(req.query);
      const [rows]=await db.query(`SELECT * FROM ${table} WHERE ${req.query.includeInactive==='1'?'1=1':'active=1'} ORDER BY name LIMIT ${limit} OFFSET ${offset}`); res.json(rows);
    });
    router.post('/'+resource,async(req,res)=>{
      const data=partySchema.parse(req.body);
      res.status(201).json(await transaction(db,req.user,resource+'.create',data,async c=>{
        const [r]=await c.execute(`INSERT INTO ${table}(name,document,phone,address,active) VALUES(?,?,?,?,?)`,[data.name,data.document,data.phone,data.address,data.active]); return {id:r.insertId,...data};
      },resource==='suppliers'));
    });
    router.put('/'+resource+'/:id',async(req,res)=>{
      const partyId=id.parse(req.params.id),data=partySchema.parse(req.body);
      res.json(await transaction(db,req.user,resource+'.update',data,async c=>{
        const [r]=await c.execute(`UPDATE ${table} SET name=?,document=?,phone=?,address=?,active=? WHERE id=?`,[data.name,data.document,data.phone,data.address,data.active,partyId]);
        if(!r.affectedRows)fail('Registro no encontrado.',404);return {id:partyId,...data};
      },true));
    });
  }
  return router;
}

export function inventoryRoutes(db) {
  const router=Router();
  router.get('/',async(req,res)=>{
    const {limit,offset}=page(req.query);
    const [rows]=await db.query(`SELECT v.*,p.name,p.unit,p.active AS product_active FROM b_variants v
      JOIN b_products p ON p.id=v.product_id ${req.query.lowStock==='1'?'WHERE v.active=1 AND p.active=1 AND v.stock<=v.min_stock':''}
      ORDER BY p.name,v.id LIMIT ${limit} OFFSET ${offset}`); res.json(rows);
  });
  router.get('/movements',async(req,res)=>{
    const {limit,offset}=page(req.query),variantId=req.query.variantId?id.parse(req.query.variantId):null;
    const [rows]=await db.execute(`SELECT m.*,v.sku,p.name,u.username FROM b_stock_movements m
      JOIN b_variants v ON v.id=m.variant_id JOIN b_products p ON p.id=v.product_id JOIN users u ON u.id=m.user_id
      WHERE (? IS NULL OR m.variant_id=?) ORDER BY m.id DESC LIMIT ${limit} OFFSET ${offset}`,[variantId,variantId]);res.json(rows);
  });
  router.post('/adjustments',async(req,res)=>{
    const data=z.object({requestId,variantId:id,kind:z.enum(['initial','adjustment']),
      quantity:z.number().int().min(-1000000).max(1000000).refine(n=>n!==0),reason:z.string().trim().min(5).max(250)}).strict().parse(req.body);
    res.status(201).json(await transaction(db,req.user,'inventory.adjustment',data,async c=>{
      const [[v]]=await c.execute('SELECT v.id FROM b_variants v JOIN b_products p ON p.id=v.product_id WHERE v.id=? AND v.active=1 AND p.active=1',[data.variantId]);
      if(!v)fail('Variante no disponible.',404);
      if(data.kind==='initial'){
        const [[previous]]=await c.execute('SELECT COUNT(*) AS n FROM b_stock_movements WHERE variant_id=?',[data.variantId]);
        if(Number(previous.n) || data.quantity<0)fail('El stock inicial debe ser positivo y solo se registra antes de otros movimientos.');
      }
      const stock=await stockMove(c,data.variantId,data.quantity,data.kind,null,data.reason,req.user.id);
      return {variantId:data.variantId,stock};
    },true));
  });
  return router;
}
