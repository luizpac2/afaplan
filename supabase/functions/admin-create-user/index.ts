import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generatePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "@#!";
  const all = upper + lower + digits + special;

  const rand = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
  const extra = Array.from({ length: 5 }, () => rand(all)).join("");

  // Garante ao menos um de cada categoria
  const pwd = rand(upper) + rand(lower) + rand(digits) + rand(special) + extra;
  // Embaralha
  return pwd.split("").sort(() => Math.random() - 0.5).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Valida token do chamador
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Sem autorização" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Cliente com token do chamador (para verificar se é admin)
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verifica se o chamador é admin
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: callerRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .single();

    const adminRoles = ["super_admin", "gestor"];
    const callerEmail = caller.email ?? "";
    const isSuperAdmin = callerEmail === "pelicano307@gmail.com";

    if (!isSuperAdmin && !adminRoles.includes(callerRole?.role ?? "")) {
      return new Response(JSON.stringify({ error: "Permissão insuficiente" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lê o body
    const { email, name, role } = await req.json() as {
      email: string;
      name: string;
      role: string;
    };

    if (!email || !name || !role) {
      return new Response(JSON.stringify({ error: "email, name e role são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const password = generatePassword();

    // Cria o usuário no Auth
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome: name },
    });

    if (createErr || !created.user) {
      const msg = createErr?.message ?? "Erro ao criar usuário";
      return new Response(JSON.stringify({ error: msg }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insere na tabela user_roles
    const { error: roleErr } = await adminClient
      .from("user_roles")
      .insert({ user_id: created.user.id, role: role.toLowerCase() });

    if (roleErr) {
      // Tenta reverter criação do usuário
      await adminClient.auth.admin.deleteUser(created.user.id);
      return new Response(JSON.stringify({ error: "Erro ao definir permissão: " + roleErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ userId: created.user.id, email, name, password }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
