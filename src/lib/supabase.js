// ============================================================
// src/lib/supabase.js
// Point d'entrée unique pour toutes les requêtes Supabase.
// Importez { supabase } dans n'importe quel composant.
// ============================================================

import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('❌ Variables VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY manquantes dans .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseKey)