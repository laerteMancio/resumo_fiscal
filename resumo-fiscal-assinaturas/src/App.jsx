'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, CheckCircle2, FileText, FolderOpen, TriangleAlert, WalletCards } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {analyticsConfigured,enableAnalytics,disableAnalytics,trackUsage} from './analytics.js'


const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dateLabel = new Intl.DateTimeFormat('pt-BR')
const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })

function first(node, name) {
  const list = node?.getElementsByTagNameNS('*', name)
  return list?.[0]?.textContent?.trim() || ''
}

function parseDate(value) {
  if (!value) return null
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null
}

function parseXml(text, fileName) {
  const xml = new DOMParser().parseFromString(text, 'application/xml')
  if (xml.querySelector('parsererror')) throw new Error('XML malformado')
  const inf = xml.getElementsByTagNameNS('*', 'infNFe')[0]
  if (!inf) throw new Error('Não é uma NF-e/NFC-e reconhecida')

  const ide = inf.getElementsByTagNameNS('*', 'ide')[0]
  const emit = inf.getElementsByTagNameNS('*', 'emit')[0]
  const dest = inf.getElementsByTagNameNS('*', 'dest')[0]
  const total = inf.getElementsByTagNameNS('*', 'ICMSTot')[0]
  const prot = xml.getElementsByTagNameNS('*', 'infProt')[0]
  const date = parseDate(first(ide, 'dhEmi') || first(ide, 'dEmi'))
  if (!['55', '65'].includes(first(ide, 'mod'))) throw new Error('Modelo não suportado')
  if (!date) throw new Error('Data de emissão não encontrada')

  return {
    fileName,
    cnpj: first(emit, 'CNPJ'),
    date,
    model: first(ide, 'mod') === '65' ? 'NFC-e' : 'NF-e',
    number: first(ide, 'nNF') || '-',
    series: first(ide, 'serie') || '-',
    issuer: first(emit, 'xNome') || first(emit, 'xFant') || 'Não informado',
    recipient: first(dest, 'xNome') || 'Consumidor não identificado',
    value: Number(first(total, 'vNF').replace(',', '.')) || 0,
    key: (inf.getAttribute('Id') || '').replace(/^NFe/, ''),
    status: first(prot, 'cStat') || (prot ? 'Processada' : 'Sem protocolo')
  }
}

export default function App({ authorizeReport }) {
  const [analyticsChoice, setAnalyticsChoice] = useState('pending')
  useEffect(() => {
    const choice = localStorage.getItem('resumo-fiscal-analytics') || 'pending'
    setAnalyticsChoice(choice)
    if (choice === 'accepted') enableAnalytics()
  }, [])
  function chooseAnalytics(choice) {
    localStorage.setItem('resumo-fiscal-analytics',choice)
    setAnalyticsChoice(choice)
    if (choice === 'accepted') enableAnalytics(); else disableAnalytics()
  }
  async function shareTool() {
    const url = 'https://resumo-fiscal.vercel.app/'
    try {
      if (navigator.share) await navigator.share({title:'Resumo Fiscal',text:'Relatório mensal de XMLs NF-e e NFC-e, com processamento local.',url})
      else {await navigator.clipboard.writeText(url);setShareMessage('Link copiado!')}
      trackUsage('share_clicked')
    } catch {setShareMessage('Compartilhe: '+url)}
  }
  const [shareMessage,setShareMessage] = useState('')
  const inputRef = useRef(null)
  const filesRef = useRef(null)
  const [issuer, setIssuer] = useState('')
  const [progress, setProgress] = useState(0)
  const [duplicates, setDuplicates] = useState(0)

  const now = new Date()
  const [notes, setNotes] = useState([])
  const [errors, setErrors] = useState([])
  const [folderName, setFolderName] = useState('')
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'))
  const [year, setYear] = useState(String(now.getFullYear()))
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [reportType, setReportType] = useState('summary')

  const issuers = [...new Map(notes.map(n => [n.cnpj, {cnpj:n.cnpj, name:n.issuer}])).values()]
  const filtered = useMemo(() => notes.filter(n =>
    n.cnpj === issuer && ['100','150'].includes(n.status) && n.date.getMonth() + 1 === Number(month) && n.date.getFullYear() === Number(year)
  ).sort((a, b) => a.date - b.date || Number(a.number) - Number(b.number)), [notes, month, year, issuer])

  const daily = useMemo(() => {
    const map = new Map()
    filtered.forEach(n => {
      const key = n.date.toISOString().slice(0, 10)
      const item = map.get(key) || { date: n.date, quantity: 0, nfe: 0, nfce: 0, value: 0 }
      item.quantity++
      n.model === 'NFC-e' ? item.nfce++ : item.nfe++
      item.value += n.value
      map.set(key, item)
    })
    return [...map.values()].sort((a, b) => a.date - b.date)
  }, [filtered])

  async function selectFolder(event) {
    const files = [...event.target.files].filter(f => f.name.toLowerCase().endsWith('.xml'))
    if (!files.length) { setErrors([{file:'Seleção', reason:'Nenhum arquivo XML encontrado.'}]); return }
    setLoading(true)
    setFolderName(files[0].webkitRelativePath?.split('/')[0] || 'Pasta selecionada')
    const valid = []
    const seen = new Set()
    const cancelled = new Set()
    let repeated = 0
    let processed = 0
    const invalid = []
    for (const file of files) {
      try {
        const source = await file.text()
        const eventXml = new DOMParser().parseFromString(source, 'application/xml')
        if (!eventXml.getElementsByTagNameNS('*','infNFe').length) {
          const returns = [...eventXml.getElementsByTagNameNS('*','retEvento')]
          let recognized = false
          for (const result of returns) {
            if (first(result,'tpEvento') === '110111' && ['135','155'].includes(first(result,'cStat'))) {
              cancelled.add(first(result,'chNFe')); recognized = true
            }
          }
          if (!recognized) throw new Error('Não é uma nota ou evento de cancelamento autorizado')
          processed++; setProgress(Math.round(processed / files.length * 100)); continue
        }
        const note = parseXml(source, file.name)
        if (!/^\d{44}$/.test(note.key)) throw new Error('Chave de acesso inválida')
        if (seen.has(note.key)) repeated++
        else { seen.add(note.key); valid.push(note) }
      }
      catch (error) { invalid.push({ file: file.name, reason: error.message }) }
      processed++; setProgress(Math.round(processed / files.length * 100))
      if (processed % 50 === 0) await new Promise(resolve => setTimeout(resolve, 0))
    }
    valid.forEach(note => { if (cancelled.has(note.key) || ['101','151'].includes(note.status)) note.status = 'Cancelada' })
    setNotes(valid)
    if (valid.length) trackUsage('xml_import_completed')
    setDuplicates(repeated)
    setIssuer(valid[0]?.cnpj || '')
    setErrors(invalid)
    if (valid.length) {
      const latest = valid.reduce((a, b) => a.date > b.date ? a : b).date
      setMonth(String(latest.getMonth() + 1).padStart(2, '0'))
      setYear(String(latest.getFullYear()))
    }
    setLoading(false)
    event.target.value = ''
  }

  async function generatePdf() {
    if (!filtered.length || generating) return
    setGenerating(true)
    try {
    await authorizeReport()
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const period = new Date(Number(year), Number(month) - 1, 1)
    const totalValue = filtered.reduce((sum, n) => sum + n.value, 0)
    const generated = new Date().toLocaleString('pt-BR')

    doc.setFillColor(17, 24, 39)
    doc.rect(0, 0, 210, 38, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(19)
    doc.text('Relatório fiscal mensal', 14, 14)
    doc.setFontSize(9)
    doc.text((issuers.find(i => i.cnpj === issuer)?.name || '').slice(0,85), 14, 21)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(monthLabel.format(period).replace(/^./, c => c.toUpperCase()), 14, 27)
    doc.text(`Gerado em ${generated}`, 196, 33, { align: 'right' })
    doc.text(`CNPJ: ${issuer}`, 14, 33)

    autoTable(doc, {
      startY: 45,
      head: [['Documentos', 'Dias com movimento', 'Valor total']],
      body: [[String(filtered.length), String(daily.length), money.format(totalValue)]],
      theme: 'grid',
      headStyles: { fillColor: [245, 158, 11], textColor: [17, 24, 39], fontStyle: 'bold' },
      styles: { fontSize: 11, cellPadding: 4 }
    })

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [['Data', 'Total', 'NF-e', 'NFC-e', 'Valor do dia']],
      body: daily.map(d => [dateLabel.format(d.date), d.quantity, d.nfe, d.nfce, money.format(d.value)]),
      theme: 'striped',
      styles: {fontSize:9, cellPadding:1.4},
      headStyles: { fillColor: [31, 41, 55] },
      columnStyles: { 4: { halign: 'right' } },
      didDrawPage: data => addFooter(doc, data.pageNumber)
    })

    if (reportType === 'complete') autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Data', 'Modelo', 'Número/Série', 'Destinatário', 'Valor']],
      body: filtered.map(n => [dateLabel.format(n.date), n.model, `${n.number}/${n.series}`, n.recipient, money.format(n.value)]),
      theme: 'grid',
      headStyles: { fillColor: [31, 41, 55] },
      styles: { fontSize: 8, cellPadding: 2.2, overflow: 'linebreak' },
      columnStyles: { 0: { cellWidth: 23 }, 1: { cellWidth: 18 }, 2: { cellWidth: 27 }, 4: { cellWidth: 28, halign: 'right' } },
      didDrawPage: data => addFooter(doc, data.pageNumber)
    })

    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(100)
      doc.text(`Página ${i} de ${totalPages}`, 196, 290, { align: 'right' })
    }
    trackUsage('pdf_generated',reportType)
    doc.save(`relatorio-fiscal-${reportType === 'summary' ? 'resumo' : 'completo'}-${issuer}-${year}-${month}.pdf`)
    } catch (error) { setErrors([{file: 'Geração do relatório', reason: error.message}]) }
    finally { setGenerating(false) }
  }

  function addFooter(doc) {
    doc.setDrawColor(220)
    doc.line(14, 285, 196, 285)
    doc.setFontSize(8)
    doc.setTextColor(100)
    
  }

  const summaryRef = useRef(null)
  summaryRef.current = {documents: filtered.length, days:daily.length, total:filtered.reduce((sum,n)=>sum+n.value,0), month, year}
  useEffect(() => {
    const context = document.modelContext
    if (!context?.registerTool) return
    const lifecycle = new AbortController()
    try { Promise.resolve(context.registerTool({name:'read_monthly_summary',description:'Ler os totais do período e empresa selecionados na tela.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(input){if (!input || typeof input !== 'object' || Object.keys(input).length) throw new Error('Entrada inválida');return summaryRef.current}}, {signal:lifecycle.signal})).catch(() => {}) } catch {}
    return () => lifecycle.abort()
  }, [])
  const total = filtered.reduce((sum, n) => sum + n.value, 0)

  return <main>
    <header className="hero">
      <div className="eyebrow"><FileText size={16}/> RESUMO FISCAL <span className="beta">Área do assinante</span></div>
      <h1>Relatório mensal de XMLs NF-e e NFC-e.</h1>
      <p>Importe seus XMLs, confira o movimento mensal e gere seu relatório em PDF. Acesso por assinatura e processamento local.</p>
    </header>

    <div className="privacy"><CheckCircle2 size={20}/><div><b>Seus documentos fiscais permanecem com você.</b><p>Os XMLs e os dados extraídos são processados no navegador, sem envio ao servidor. Ao fechar ou limpar esta página, a sessão é descartada.</p></div></div>
    <section className="panel controls">
      <div>
        <label>Pasta de arquivos XML</label>
        <button className="folder" onClick={() => inputRef.current.click()} disabled={loading}>
          <FolderOpen size={20}/>{loading ? `Processando… ${progress}%` : folderName || 'Selecionar pasta'}
        </button>
        <button className="text-button" disabled={loading} onClick={() => filesRef.current.click()}>Ou selecionar arquivos XML</button>
        <input ref={filesRef} type="file" accept=".xml,text/xml,application/xml" multiple hidden onChange={selectFolder}/>
        <input ref={inputRef} type="file" webkitdirectory="" directory="" multiple hidden onChange={selectFolder}/>
      </div>
      <div>
        <label>Mês</label>
        <select value={month} onChange={e => setMonth(e.target.value)}>
          {Array.from({length: 12}, (_, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{new Intl.DateTimeFormat('pt-BR', {month:'long'}).format(new Date(2024, i, 1))}</option>)}
        </select>
      </div>
      <div>
        <label>Ano</label>
        <input className="year" type="number" min="2000" max="2100" value={year} onChange={e => setYear(e.target.value)}/>
      </div>
      <div><label htmlFor="report-type">Formato do PDF</label><select id="report-type" value={reportType} onChange={e => setReportType(e.target.value)}><option value="summary">Resumo mensal</option><option value="complete">Completo com todas as notas</option></select><button style={{marginTop:10,width:"100%"}} className="primary" disabled={!filtered.length || loading || generating} onClick={generatePdf}><FileText size={19}/>Gerar PDF</button></div>
    </section>

    <div className="session panel"><label>Empresa / CNPJ<select value={issuer} disabled={!notes.length || loading} onChange={e => setIssuer(e.target.value)}><option value="">Selecione uma empresa</option>{issuers.map(i => <option key={i.cnpj} value={i.cnpj}>{i.name} — {i.cnpj}</option>)}</select></label><button className="text-button" disabled={loading || !notes.length} onClick={() => {setNotes([]);setErrors([]);setIssuer('');setFolderName('');setDuplicates(0)}}>Limpar sessão</button></div>
    {!!notes.length && <p className="import-summary" role="status">{notes.length} documentos únicos importados • {duplicates} duplicados ignorados • {notes.filter(n => !['100','150'].includes(n.status)).length} cancelados ou sem autorização excluídos dos totais.</p>}
    <section className="stats">
      <article><span><FileText/></span><div><small>Documentos no período</small><strong>{filtered.length}</strong></div></article>
      <article><span><CalendarDays/></span><div><small>Dias com movimento</small><strong>{daily.length}</strong></div></article>
      <article><span><WalletCards/></span><div><small>Valor total</small><strong>{money.format(total)}</strong></div></article>
      <article><span className={errors.length ? 'warn' : ''}>{errors.length ? <TriangleAlert/> : <CheckCircle2/>}</span><div><small>XMLs não processados</small><strong>{errors.length}</strong></div></article>
    </section>

    <section className="panel table-panel">
      <div className="section-title"><div><h2>Resumo dia a dia</h2><p>{folderName ? `Pasta: ${folderName}` : 'Selecione uma pasta para começar.'}</p></div></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Data</th><th>Documentos</th><th>NF-e</th><th>NFC-e</th><th>Valor do dia</th></tr></thead>
        <tbody>{daily.length ? daily.map(d => <tr key={d.date.toISOString()}><td>{dateLabel.format(d.date)}</td><td>{d.quantity}</td><td>{d.nfe}</td><td>{d.nfce}</td><td>{money.format(d.value)}</td></tr>) : <tr><td colSpan="5" className="empty">Nenhum documento encontrado para o período selecionado.</td></tr>}</tbody>
      </table></div>
    </section>

    {!!errors.length && <details className="panel errors"><summary>Ver {errors.length} arquivo(s) não processado(s)</summary>{errors.map(e => <p key={e.file}><b>{e.file}</b>: {e.reason}</p>)}</details>}
    <section className="benefits" aria-label="Vantagens"><article><h2>Conferência por dia</h2><p>Quantidade e valor dos documentos autorizados, agrupados no período escolhido.</p></article><article><h2>PDF para compartilhar</h2><p>Escolha o resumo mensal ou o detalhamento de todas as notas.</p></article><article><h2>Documentos com você</h2><p>XMLs ficam na memória do navegador e não são enviados ao servidor.</p></article></section>
    <section className="panel faq"><h2>Perguntas sobre o Resumo Fiscal</h2><details><summary>Como gerar um relatório mensal dos XMLs?</summary><p>Selecione a pasta ou os arquivos XML, escolha a empresa, mês e ano. Confira os totais e clique em Gerar PDF. Extraia arquivos ZIP ou RAR antes de importar.</p></details><details><summary>Quais documentos são aceitos?</summary><p>NF-e modelo 55 e NFC-e modelo 65. Os totais consideram protocolos de autorização 100 e 150. Importar XMLs repetidos não soma a mesma chave duas vezes.</p></details><details><summary>Como tratar notas canceladas?</summary><p>Inclua os XMLs dos eventos de cancelamento autorizados na mesma importação. Sem esses arquivos, uma nota cujo XML original consta como autorizado pode continuar nos totais. Não consultamos a SEFAZ.</p></details><details><summary>Quem pode usar a ferramenta?</summary><p>Empresas, postos de combustíveis e profissionais que precisam organizar documentos fiscais e entregar um resumo mensal. Confira os documentos antes de usar o relatório na sua rotina contábil.</p></details><details><summary>É preciso pagar ou criar uma conta?</summary><p>É necessário criar uma conta e ter assinatura ativa. Os planos mensal e anual permitem gerar PDFs resumidos ou completos.</p></details></section>
    <section className="share"><div><h2>Facilite a conferência de XMLs de quem trabalha com você.</h2><p>Compartilhe a ferramenta com sua equipe ou escritório contábil.</p></div><button className="primary" onClick={shareTool}>Compartilhar ferramenta</button><p role="status">{shareMessage}</p></section>
    <details className="panel privacy-details"><summary>Como funciona a privacidade?</summary><p>A aplicação lê os arquivos selecionados e mantém os resultados apenas na memória desta página. Não salvamos XMLs nem dados extraídos em banco de dados, cookies ou armazenamento do navegador. O PDF é criado no seu dispositivo.</p><p>A hospedagem pode tratar informações técnicas de acesso, como endereço IP, para funcionamento e segurança. Por isso, nossa promessa se refere aos documentos fiscais e aos dados extraídos, e não à ausência de todo tipo de dado técnico.</p><p>Quando a medição estiver configurada e você permitir, o Google Analytics registra visitas e ações de uso (importação concluída e geração de PDF), sem nomes de arquivo, CNPJ, valores ou conteúdo dos documentos. Essa medição usa cookies e informações técnicas de navegação. Guardamos apenas sua preferência de medição neste navegador.</p><p>O servidor guarda dados da conta, da assinatura e solicitações de geração, sem receber o conteúdo fiscal. Os resultados dependem dos documentos importados, sem consulta à SEFAZ.</p></details>
    {analyticsConfigured && analyticsChoice === 'pending' && <aside className="consent" aria-label="Preferências de medição"><p>Podemos medir visitas e uso para melhorar a ferramenta? Os dados fiscais não entram nessa medição.</p><button onClick={() => chooseAnalytics('accepted')}>Permitir medição</button><button onClick={() => chooseAnalytics('rejected')}>Continuar sem medição</button></aside>}
    {analyticsConfigured && analyticsChoice !== 'pending' && <button className="text-button" onClick={() => {disableAnalytics();localStorage.removeItem('resumo-fiscal-analytics');setAnalyticsChoice('pending')}}>Preferências de medição</button>}
    <footer>Resumo de documentos autorizados (status 100/150). Inclua os XMLs dos eventos de cancelamento na importação para conciliar as notas. Confira os documentos de origem antes de entregar o relatório. Esta ferramenta não consulta a SEFAZ.</footer>
  </main>
}


