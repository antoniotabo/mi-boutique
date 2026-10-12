export function createPending(path,data,put,uuid){
  return {path,data:{...data,requestId:uuid},put};
}
export function definitiveFailure(status){
  return Number.isInteger(status)&&status>=400&&status<500;
}
export function lineCents(quantity,price,discount=0){
  return quantity*(Math.round(Number(price)*100)-Math.round(Number(discount)*100));
}
