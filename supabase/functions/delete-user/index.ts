import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getServiceSupabase(req: Request): Promise<SupabaseClient> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    throw new Error("Missing Authorization header");
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )

  const userResponse = await supabase.auth.getUser();
  if (userResponse.error) throw userResponse.error;
  if (!userResponse.data.user) throw new Error("User not found");
  const user = userResponse.data.user;

  const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profileError) throw profileError;
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