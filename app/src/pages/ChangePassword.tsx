import { useState } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../contexts/AuthContext";
import { KeyRound, Eye, EyeOff, CheckCircle } from "lucide-react";

export const ChangePassword = () => {
  const { user } = useAuth();
  const [newPwd, setNewPwd]       = useState("");
  const [confirmPwd, setConfirm]  = useState("");
  const [showNew, setShowNew]     = useState(false);
  const [showConf, setShowConf]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [done, setDone]           = useState(false);

  const rules = {
    length:  newPwd.length >= 8,
    upper:   /[A-Z]/.test(newPwd),
    lower:   /[a-z]/.test(newPwd),
    number:  /[0-9]/.test(newPwd),
  };
  const valid = Object.values(rules).every(Boolean) && newPwd === confirmPwd;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      const { error: pwdErr } = await supabase.auth.updateUser({ password: newPwd });
      if (pwdErr) {
        const msg = pwdErr.message.toLowerCase();
        if (msg.includes("same password") || msg.includes("different from the old")) {
          throw new Error("A nova senha não pode ser igual à senha atual.");
        }
        if (msg.includes("weak") || msg.includes("short")) {
          throw new Error("Senha muito fraca. Use ao menos 8 caracteres com letras e números.");
        }
        throw new Error("Erro ao alterar senha. Tente novamente.");
      }

      await supabase.auth.updateUser({
        data: { must_change_password: false },
      });

      setDone(true);
      setTimeout(() => { window.location.href = "/"; }, 1500);
    } catch (e: unknown) {
      setError((e as Error).message ?? "Erro ao alterar senha.");
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <CheckCircle size={48} className="text-green-400 mx-auto mb-4" />
          <p className="text-white text-lg font-medium">Senha alterada com sucesso!</p>
          <p className="text-slate-400 text-sm mt-1">Redirecionando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-amber-500 px-6 py-5 flex items-center gap-3">
          <KeyRound size={24} className="text-white" />
          <div>
            <h1 className="text-white font-bold text-lg">Troca de senha obrigatória</h1>
            <p className="text-amber-100 text-sm">Você deve definir uma nova senha antes de continuar.</p>
          </div>
        </div>

        <form onSubmit={(e) => { void handleSubmit(e); }} className="p-6 space-y-4">
          <p className="text-slate-500 text-sm">
            Logado como <strong className="text-slate-800">{user?.email}</strong>.<br />
            Defina uma nova senha para continuar acessando o sistema.
          </p>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>
          )}

          {/* Nova senha */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nova senha</label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                className="w-full border border-slate-300 rounded-xl px-4 py-3 pr-10 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="button" onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirmação */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar nova senha</label>
            <div className="relative">
              <input
                type={showConf ? "text" : "password"}
                value={confirmPwd}
                onChange={e => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Repita a senha"
                className="w-full border border-slate-300 rounded-xl px-4 py-3 pr-10 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="button" onClick={() => setShowConf(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showConf ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Regras */}
          <ul className="text-xs space-y-1">
            {[
              { ok: rules.length,  label: "Mínimo 8 caracteres" },
              { ok: rules.upper,   label: "Letra maiúscula" },
              { ok: rules.lower,   label: "Letra minúscula" },
              { ok: rules.number,  label: "Número" },
              { ok: newPwd === confirmPwd && newPwd.length > 0, label: "Senhas coincidem" },
            ].map(r => (
              <li key={r.label} className={`flex items-center gap-1.5 ${r.ok ? "text-green-600" : "text-slate-400"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${r.ok ? "bg-green-500" : "bg-slate-300"}`} />
                {r.label}
              </li>
            ))}
          </ul>

          <button
            type="submit"
            disabled={!valid || saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white py-3 rounded-xl text-sm font-medium transition-colors"
          >
            {saving ? "Salvando..." : "Definir nova senha"}
          </button>
        </form>
      </div>
    </div>
  );
};
