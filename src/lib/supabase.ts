import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const createClient = () =>
    createSupabaseClient(
        'https://lendflow.jiobase.com',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
