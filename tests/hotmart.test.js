import test from 'node:test'
import assert from 'node:assert/strict'
import {normalize,validToken} from '../server/hotmart.js'
const config={product:'123',monthly:'1',annual:'2'}
function fixture(type='PURCHASE_APPROVED'){return {id:'evt-1',version:'2.0.0',creation_date:1791586800000,event:type,data:{product:{id:123},buyer:{email:' CLIENTE@example.com '},purchase:{transaction:'HP1',approved_date:1791586800000,date_next_charge:1794265200000},subscription:{plan:{id:1},subscriber:{code:'SUB1'}}}}}
test('token ausente, incorreto ou de tamanho diferente não autentica',()=>{assert.equal(validToken(undefined,'secret'),false);assert.equal(validToken('secret',undefined),false);assert.equal(validToken('x','secret'),false);assert.equal(validToken('Secret','secret'),false);assert.equal(validToken('secret','secret'),true)})
test('aprovação usa o vencimento enviado pela Hotmart e normaliza o e-mail',()=>{const e=normalize(fixture(),config);assert.equal(e.p_email,'cliente@example.com');assert.equal(e.p_valid_until,'2026-11-09T23:00:00.000Z');assert.equal(e.p_plan,'monthly')})
test('plano anual é identificado pelo ID configurado',()=>{const f=fixture();f.data.subscription.plan.id=2;assert.equal(normalize(f,config).p_plan,'annual')})
test('produto ou plano desconhecido nunca concede acesso',()=>{const f=fixture();f.data.product.id=456;assert.throws(()=>normalize(f,config));f.data.product.id=123;f.data.subscription.plan.id=99;assert.throws(()=>normalize(f,config))})
test('não inventa vencimento quando a cobrança não informa data',()=>{const f=fixture();delete f.data.purchase.date_next_charge;assert.throws(()=>normalize(f,config))})
test('cancelamento usa subscriber e não exige transação de compra',()=>{const f=fixture('SUBSCRIPTION_CANCELLATION');f.data.subscriber={email:'cliente@example.com',code:'SUB1'};delete f.data.buyer;delete f.data.purchase;delete f.data.subscription.subscriber;const e=normalize(f,config);assert.equal(e.p_subscriber,'SUB1');assert.equal(e.p_transaction,null);assert.equal(e.p_valid_until,null)})
test('reembolso e chargeback identificam a transação revogada',()=>{for(const type of ['PURCHASE_REFUNDED','PURCHASE_CHARGEBACK']){const e=normalize(fixture(type),config);assert.equal(e.p_transaction,'HP1');assert.equal(e.p_valid_until,null)}})
test('atraso de renovação não cria novo período pago',()=>{assert.equal(normalize(fixture('PURCHASE_DELAYED'),config).p_valid_until,null)})
test('eventos fora do escopo são ignorados',()=>{assert.equal(normalize(fixture('PURCHASE_BILLET_PRINTED'),config),null)})
test('versão antiga e payload incompleto são recusados',()=>{const f=fixture();f.version='1.0.0';assert.throws(()=>normalize(f,config));assert.throws(()=>normalize({event:'PURCHASE_APPROVED'},config))})
