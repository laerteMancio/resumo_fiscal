import {createClient} from '@supabase/supabase-js'
export const supabase = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY ? createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY) : null
export async function request(path, method='GET') {
  const {data:{session}}=await supabase.auth.getSession()
  if(!session)throw new Error('Entre na sua conta.')
  const response=await fetch(path,{method,headers:{Authorization:`Bearer ${session.access_token}`}})
  const body=await response.json()
  if(!response.ok)throw new Error(body.error||'Não foi possível concluir a solicitação.')
  return body
}
