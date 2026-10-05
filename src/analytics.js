export const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID || ''
export const analyticsConfigured = /^G-[A-Z0-9]+$/.test(measurementId)
const allowed = new Set(['xml_import_completed','pdf_generated','share_clicked'])
let enabled = false
export function enableAnalytics() {
  if (!analyticsConfigured || enabled) return
  enabled = true
  window[`ga-disable-${measurementId}`] = false
  window.dataLayer = window.dataLayer || []
  window.gtag = function(){window.dataLayer.push(arguments)}
  window.gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'})
  window.gtag('js',new Date())
  window.gtag('config',measurementId,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false})
  window.gtag('event','page_view',{page_location:'https://resumo-fiscal.vercel.app/',page_referrer:'',page_title:'Resumo Fiscal'})
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
  document.head.appendChild(script)
}
export function disableAnalytics() {
  enabled = false
  if (analyticsConfigured) window[`ga-disable-${measurementId}`] = true
  window.gtag?.('consent','update',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'})
}
export function trackUsage(name, format) {
  if (!enabled || !allowed.has(name)) return
  const props = name === 'pdf_generated' ? {report_format:format === 'complete' ? 'complete' : 'summary'} : {}
  window.gtag?.('event',name,props)
}
