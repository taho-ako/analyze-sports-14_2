import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let supabase = null
if (supabaseUrl && supabaseKey && supabaseUrl !== 'https://placeholder.supabase.co') {
  supabase = createClient(supabaseUrl, supabaseKey)
}

export { supabase }