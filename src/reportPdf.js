import {jsPDF} from 'jspdf'
import {autoTable} from 'jspdf-autotable'
import {summarizeProducts,formatProductValue} from './products.js'
import {formatLitres} from './fuels.js'
const money = new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'})
const dateLabel = new Intl.DateTimeFormat('pt-BR')
const monthLabel = new Intl.DateTimeFormat('pt-BR', {month:'long', year:'numeric'})
export function buildMonthlyPdf({filtered, daily, fuels, products = summarizeProducts(filtered), issuerName, issuer, month, year, reportType, generated = new Date().toLocaleString('pt-BR')}) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const period = new Date(Number(year), Number(month) - 1, 1)
    const totalValue = filtered.reduce((sum, n) => sum + n.value, 0)

    doc.setFillColor(17, 24, 39)
    doc.rect(0, 0, 210, 38, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(19)
    doc.text('Relatório fiscal mensal', 14, 14)
    doc.setFontSize(9)
    doc.text(issuerName.slice(0,85), 14, 21)
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
      head: [['Data', 'Total', 'NF-e', 'NFC-e', 'Valor do dia', 'Combustíveis (L)']],
      body: daily.map(d => [dateLabel.format(d.date), d.quantity, d.nfe, d.nfce, money.format(d.value), formatLitres(d.scaledLitres)]),
      theme: 'striped',
      styles: {fontSize:9, cellPadding:1.2},
      headStyles: { fillColor: [31, 41, 55] },
      margin: {bottom: 24},
      columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' } },
      didDrawPage: data => addFooter(doc, data.pageNumber)
    })

    if (fuels.groups.length || fuels.issues.length) autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [['Litragem de combustíveis — produto no XML / código ANP', 'Quantidade (L)']],
      body: fuels.groups.length ? fuels.groups.map(g => [`${g.name}\nANP ${g.anp}`, formatLitres(g.scaledLitres)]) : [['Nenhum item elegível em litros', '0,0000']],
      foot: [['TOTAL APURADO', formatLitres(fuels.scaledTotal)], ...(fuels.issues.length ? [[`${fuels.issues.length} item(ns) fora da apuração: conferir no aplicativo.`, '']] : [])],
      theme: 'grid', margin: {bottom: 24},
      headStyles: {fillColor: [31,41,55]}, footStyles: {fillColor: [255,244,215], textColor:[17,24,39]},
      styles: {fontSize: 9, cellPadding: 2.2}, columnStyles: {1:{halign:'right',cellWidth:42}},
      didDrawPage: () => addFooter(doc)
    })

    if (products.length) autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [['Código', 'Todos os produtos / descrição no XML', 'Unidade', 'Quantidade', 'Valor bruto']],
      body: products.map(g=>[g.code,g.name,g.unit,g.missingQuantity?'Conferir XML':formatLitres(g.quantity),g.missingValue?'Conferir XML':formatProductValue(g.value)]),
      foot: [[{content:'Quantidades comerciais; todas as operações selecionadas, sem compensação. Valores brutos dos itens, antes de descontos e ajustes.',colSpan:5}]],
      theme:'grid', margin:{bottom:24,left:14,right:14}, styles:{fontSize:8,cellPadding:2}, headStyles:{fillColor:[31,41,55]}, footStyles:{fillColor:[245,245,245],textColor:[70,70,70]}, columnStyles:{0:{cellWidth:32},1:{cellWidth:70},2:{cellWidth:15},3:{cellWidth:30,halign:'right'},4:{cellWidth:35,halign:'right'}}, didDrawPage:()=>addFooter(doc)
    })

    if (reportType === 'complete') autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Data', 'Modelo', 'Número/Série', 'Destinatário', 'Valor']],
      body: filtered.map(n => [dateLabel.format(n.date), n.model, `${n.number}/${n.series}`, n.recipient, money.format(n.value)]),
      theme: 'grid',
      headStyles: { fillColor: [31, 41, 55] },
      margin: {bottom: 24},
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
    return doc
}
  function addFooter(doc) {
    doc.setDrawColor(220)
    doc.line(14, 285, 196, 285)
    doc.setFontSize(8)
    doc.setTextColor(100)
    
  }

