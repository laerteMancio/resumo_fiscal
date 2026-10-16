import test from 'node:test'
import assert from 'node:assert/strict'
import {DOMParser} from '@xmldom/xmldom'
import {extractFuelItems,summarizeFuels,formatLitres} from '../src/fuels.js'
const element=(text)=>new DOMParser().parseFromString(text,'text/xml').documentElement
function items({anp='320102001',name='GASOLINA COMUM',u='L',q='10.1234',ut='L',qt='10.1234',cfop='5656'}={}){return extractFuelItems(element(`<infNFe xmlns="http://www.portalfiscal.inf.br/nfe"><det nItem="1"><prod><xProd>${name}</xProd><CFOP>${cfop}</CFOP><uCom>${u}</uCom><qCom>${q}</qCom><uTrib>${ut}</uTrib><qTrib>${qt}</qTrib>${anp?`<comb><cProdANP>${anp}</cProdANP></comb>`:''}</prod></det></infNFe>`))}
function note(overrides={}){return {key:'1',date:new Date(2026,8,1),fileName:'teste.xml',number:'1',direction:'1',purpose:'1',status:'100',references:[],fuelItems:items(),...overrides}}
test('usa litros comerciais sem somar qCom e qTrib duas vezes',()=>{assert.equal(summarizeFuels([note()]).scaledTotal,101234n)})
test('aceita siglas L e LT e preserva quatro casas',()=>{for(const u of ['L','LT','lt',' LITROS '])assert.equal(items({u})[0].scaledLitres,101234n);assert.equal(formatLitres(3287858855n),'328.785,8855')})
test('usa qTrib somente quando uCom não está em litros',()=>{assert.equal(items({u:'UN',q:'2',qt:'20.1250'})[0].scaledLitres,201250n)})
test('não usa qTrib como atalho se qCom em litros está inválido',()=>{assert.equal(items({q:'inválido'})[0].scaledLitres,null)})
test('não converte massa ou volume gasoso em litros por estimativa',()=>{const result=summarizeFuels([note({fuelItems:items({u:'KG',ut:'M3'})})]);assert.equal(result.scaledTotal,0n);assert.equal(result.issues.length,1)})
test('produtos comuns e galões sem ANP não entram na litragem',()=>{assert.deepEqual(items({anp:'',name:'GALAO EMERGENCIA 5 LITROS',u:'UN',ut:'UN'}),[]);assert.deepEqual(items({anp:'',name:'HELIX HX3 1 LITRO'}),[])})
test('lubrificante com código ANP não é combustível só por usar litros',()=>{const result=summarizeFuels([note({fuelItems:items({anp:'620501001'})})]);assert.equal(result.scaledTotal,0n);assert.equal(result.issues.length,1)})
test('combustível sem ANP fica para conferência, sem estimativa',()=>{const result=summarizeFuels([note({fuelItems:items({anp:''})})]);assert.equal(result.scaledTotal,0n);assert.equal(result.issues.length,1)})
test('não soma duplicatas, canceladas ou sem autorização',()=>{assert.equal(summarizeFuels([note(),note(),note({key:'2',status:'Cancelada'}),note({key:'3',status:'Sem protocolo'})]).scaledTotal,101234n)})
test('não soma entrada, devolução, complementar ou CFOP de outra operação',()=>{for(const n of [note({direction:'0'}),note({purpose:'4'}),note({purpose:'2'}),note({fuelItems:items({cfop:'5929'})})])assert.equal(summarizeFuels([n]).scaledTotal,0n)})
test('nota referenciando venda já importada não duplica o volume',()=>{const n=note({key:'2',references:['1']});assert.equal(summarizeFuels([note(),n]).scaledTotal,101234n);assert.equal(summarizeFuels([n],[note(),n]).issues.length,1)})
test('agrupa pelo ANP, preserva nomes do XML e separa dias',()=>{const a=note(),b=note({key:'2',date:new Date(2026,8,2),fuelItems:items({name:'GASOLINA C COMUM'})}),c=note({key:'3',fuelItems:items({anp:'810101001',name:'ETANOL'})});const s=summarizeFuels([a,b,c]);assert.equal(s.groups.length,2);assert.equal(s.daily.get('2026-09-01'),202468n);assert.equal(s.daily.get('2026-09-02'),101234n);assert.match(s.groups.find(g=>g.anp==='320102001').name,/GASOLINA C COMUM/)})
test('soma fracionária é exata; valores negativos, vírgula e precisão excedida são recusados',()=>{const s=summarizeFuels(Array.from({length:10},(_,i)=>note({key:String(i),fuelItems:items({q:'0.1000',qt:'0.1000'})})));assert.equal(s.scaledTotal,10000n);for(const q of ['-1','1,20','0.12345','NaN'])assert.equal(items({q})[0].scaledLitres,null)})
