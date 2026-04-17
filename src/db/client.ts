import { createClient } from "@supabase/supabase-js"

const supabaseUrl = Bun.env.SUPABASE_URL
const supabaseKey = Bun.env.SUPABASE_SERVICE_ROLE_KEY

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null
