import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPending,definitiveFailure,lineCents} from '../src/app/operation.mjs';
test('conserva UUID y contenido financiero al persistir y reintentar',()=>{
 const original={sessionId:1,items:[{variantId:2,quantity:3}],paymentMethod:'cash'};
 const pending=createPending('sales',original,false,'c9101efa-7c35-4b00-97c1-e96d1a6d055a');
 const recovered=JSON.parse(JSON.stringify(pending));assert.deepEqual(recovered,pending);
 assert.equal(original.requestId,undefined);assert.equal(recovered.data.requestId,pending.data.requestId);
});
test('fallos de red y servidor conservan la solicitud pendiente',()=>{
 for(const code of [0,500,502,503,504])assert.equal(definitiveFailure(code),false);
 for(const code of [400,401,403,409,422])assert.equal(definitiveFailure(code),true);
});
test('calcula cada linea y descuento en centimos',()=>{
 assert.equal(lineCents(3,19.90,0.10),5940);assert.equal(lineCents(2,49.9,0),9980);assert.equal(lineCents(1,0.3,0.1),20);
});
