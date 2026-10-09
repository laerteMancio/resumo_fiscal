import { createClient } from '@supabase/supabase-js'
export function database() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Servidor não configurado')
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false,autoRefreshToken:false}})
}
export function reply(res, status, body) { res.setHeader('Cache-Control','no-store'); return res.status(status).json(body) }
export async function identity(req, db) {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1]
  if (!token) return null
  const {data,error} = await db.auth.getUser(token)
  return !error && data.user?.email_confirmed_at ? data.user : null
}
export async function access(db, user) {
  const {data:role,error:r} = await db.from('administrators').select('user_id').eq('user_id',user.id).maybeSingle()
  if(r) throw r
  const {data:payments,error:p} = await db.from('payments').select('plan,valid_until,status').eq('email',user.email.toLowerCase()).eq('status','paid').gt('valid_until',new Date().toISOString()).order('valid_until',{ascending:false})
  if(p) throw p
  return {allowed:!!role || !!payments.length,administrator:!!role,plan:role?'admin':payments[0]?.plan,validUntil:payments[0]?.valid_until || null}
}
