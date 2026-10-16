import test from 'node:test'
import assert from 'node:assert/strict'
import {DOMParser} from '@xmldom/xmldom'
import {parseXml} from '../src/xml.js'
import {summarizeFuels} from '../src/fuels.js'
import {buildMonthlyPdf} from '../src/reportPdf.js'
const xml=`<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${'1'.repeat(44)}"><ide><mod>65</mod><nNF>1</nNF><serie>1</serie><dhEmi>2026-09-01T12:00:00-03:00</dhEmi><tpNF>1</tpNF><finNFe>1</finNFe></ide><emit><CNPJ>00000000000000</CNPJ><xNome>EMPRESA EXEMPLO</xNome></emit><det nItem="1"><prod><xProd>ETANOL COMUM</xProd><CFOP>5656</CFOP><uCom>LT</uCom><qCom>15.1234</qCom><uTrib>L</uTrib><qTrib>15.1234</qTrib><comb><cProdANP>810101001</cProdANP></comb></prod></det><total><ICMSTot><vNF>50.00</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><cStat>100</cStat></infProt></protNFe></nfeProc>`
test('parser real da aplicação extrai combustíveis de NFC-e com namespace',()=>{globalThis.DOMParser=DOMParser;const n=parseXml(xml,'exemplo.xml');assert.equal(n.model,'NFC-e');assert.equal(n.purpose,'1');assert.equal(n.fuelItems[0].scaledLitres,151234n);assert.equal(summarizeFuels([n]).scaledTotal,151234n)})
test('os dois formatos de PDF incluem a litragem e permitem múltiplas páginas',()=>{
 globalThis.DOMParser=DOMParser
 const n=parseXml(xml,'exemplo.xml'),filtered=Array.from({length:180},(_,i)=>({...n,key:String(i),number:String(i+1)})),fuels=summarizeFuels(filtered)
 const daily=[{date:n.date,quantity:180,nfe:0,nfce:180,value:9000,scaledLitres:fuels.scaledTotal}]
 for(const reportType of ['summary','complete']){
  const doc=buildMonthlyPdf({filtered,daily,fuels,issuerName:'EMPRESA EXEMPLO',issuer:n.cnpj,month:'09',year:'2026',reportType})
  const output=doc.output()
  assert.match(output,/TOTAL APURADO/);assert.match(output,/810101001/);assert.match(output,/2\.722,2120/)
  if(reportType==='complete')assert.ok(doc.getNumberOfPages()>1)
 }
})
test('PDF de relatório com item excluído traz aviso de conferência',()=>{
 globalThis.DOMParser=DOMParser
 const n=parseXml(xml.replace('<uCom>LT</uCom>','<uCom>KG</uCom>').replace('<uTrib>L</uTrib>','<uTrib>KG</uTrib>'),'exemplo.xml'),fuels=summarizeFuels([n])
 const doc=buildMonthlyPdf({filtered:[n],daily:[{date:n.date,quantity:1,nfe:0,nfce:1,value:50,scaledLitres:0n}],fuels,issuerName:'EXEMPLO',issuer:n.cnpj,month:'09',year:'2026',reportType:'summary'})
 assert.match(doc.output(),/fora da apura/);assert.match(doc.output(),/Nenhum item/)
})
