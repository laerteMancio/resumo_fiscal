import test from 'node:test'
import assert from 'node:assert/strict'
import {access,identity} from '../server/backend.js'
function fake({admin=false,paid=[],error=null}={}){return {from(table){const q={select(){return q},eq(){return q},gt(column,date){assert.equal(column,'valid_until');assert.ok(Number.isFinite(Date.parse(date)));return q},maybeSingle(){return Promise.resolve({data:admin?{user_id:'u'}:null,error})},order(){return Promise.resolve({data:paid,error})}};return q}}}
const user={id:'u',email:'USER@example.com'}
test('conta sem pagamento válido não pode gerar relatório',async()=>{assert.equal((await access(fake(),user)).allowed,false)})
test('pagamento ativo libera acesso com vencimento',async()=>{const result=await access(fake({paid:[{plan:'monthly',valid_until:'2027-01-01'}]}),user);assert.equal(result.allowed,true);assert.equal(result.administrator,false);assert.equal(result.plan,'monthly')})
test('administrador tem acesso sem assinatura',async()=>{const result=await access(fake({admin:true}),user);assert.equal(result.allowed,true);assert.equal(result.administrator,true)})
test('falha no banco não libera acesso',async()=>{await assert.rejects(access(fake({error:new Error('database')}),user))})
test('token ausente, inválido ou e-mail não confirmado são bloqueados',async()=>{assert.equal(await identity({headers:{}},{}),null);assert.equal(await identity({headers:{authorization:'Bearer token'}},{auth:{getUser:async()=>({data:{user:{id:'u'}},error:null})}}),null);assert.equal(await identity({headers:{authorization:'Bearer token'}},{auth:{getUser:async()=>({data:{},error:new Error()})}}),null)})
test('token é validado no Supabase antes de confiar no usuário',async()=>{const u={...user,email_confirmed_at:'2026-01-01'};assert.equal(await identity({headers:{authorization:'Bearer token'}},{auth:{getUser:async(token)=>{assert.equal(token,'token');return {data:{user:u},error:null}}}}),u)})
