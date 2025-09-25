import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getServiceSupabase(req: Request): Promise<SupabaseClient> {
    const authHeader = req.headers.get('Authorization')!
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("User not found");

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || profile.role !== 'admin') {
        throw new Error("Unauthorized: Not an admin");
    }

    return createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = await getServiceSupabase(req);
    const { userId } = await req.json()
    if (!userId) {
      throw new Error("User ID is required.")
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (error) throw error;

    return new Response(JSON.stringify({ message: 'User deleted successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Error in delete-user function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})