import test from 'node:test'
import assert from 'node:assert/strict'
import {DOMParser} from '@xmldom/xmldom'
import {extractProductItems,summarizeProducts,formatProductValue} from '../src/products.js'
const extract=(items)=>extractProductItems(new DOMParser().parseFromString(`<infNFe>${items}</infNFe>`,'application/xml').documentElement)
const item=(code,name,unit,q,v)=>`<det><prod><cProd>${code}</cProd><xProd>${name}</xProd><uCom>${unit}</uCom><qCom>${q}</qCom><vProd>${v}</vProd></prod></det>`
const note=(key,items,status='100')=>({key,cnpj:'123',productItems:extract(items),status})
test('todos os itens, inclusive não combustíveis, com soma decimal exata',()=>{
 const n=note('1',item('A','ÁGUA','UN','0.1000','1.10')+item('A','ÁGUA','UN','0.2000','2.20'))
 const [g]=summarizeProducts([n]);assert.equal(g.quantity,3000n);assert.equal(g.value,330n);assert.equal(formatProductValue(g.value),'R$ 3,30')
})
test('separa unidades, códigos, descrições e empresas; ignora duplicatas e cancelados',()=>{
 const n=note('1',item('A','ÁGUA','UN','1','2'))
 const rows=summarizeProducts([n,n,note('2',item('A','ÁGUA','CX','1','2')),note('3',item('B','ÁGUA','UN','1','2')),note('4',item('A','ÁGUA MINERAL','UN','1','2')),{...n,key:'5',cnpj:'456'},note('6',item('C','CANCELADO','UN','1','2'),'Cancelada')]);assert.equal(rows.length,5);assert.ok(rows.every(g=>g.quantity===10000n))
})
test('dados inválidos não viram quantidades estimadas',()=>{
 const [g]=summarizeProducts([note('1',item('A','ITEM','KG','inválido','1.234'))]);assert.equal(g.missingQuantity,1);assert.equal(g.missingValue,1)
})
