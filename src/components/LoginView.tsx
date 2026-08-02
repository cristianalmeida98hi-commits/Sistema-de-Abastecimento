import React, { useState } from 'react';
import { 
  Shield, Fuel, Lock, Mail, CheckCircle2, AlertCircle, Tablet, 
  Key, User as UserIcon, ArrowRight, Sparkles, Building2, Smartphone
} from 'lucide-react';
import { User } from '../types';
import { loginUser } from '../utils/storage';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
  darkMode?: boolean;
  successMessage?: string | null;
}

export const LoginViewComponent: React.FC<LoginViewProps> = ({ onLoginSuccess, successMessage }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showTabletHelp, setShowTabletHelp] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    setTimeout(() => {
      const res = loginUser(email, password, rememberMe);
      setIsLoading(false);

      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMessage(res.error || 'Credenciais inválidas.');
      }
    }, 300);
  };

  const handleQuickSelect = (quickEmail: string, quickPass: string = '123456') => {
    setEmail(quickEmail);
    setPassword(quickPass);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#021812] text-slate-100">
      
      {/* Background Decorative Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-[#064E3B]/30 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-[#FACC15]/10 blur-3xl" />
      </div>

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-0 rounded-3xl overflow-hidden shadow-2xl border border-emerald-900/50 relative z-10 bg-[#042d23]">
        
        {/* Left Side: Brand Banner & Tablet Instructions (5 cols) */}
        <div className="md:col-span-5 bg-[#064E3B] text-white p-8 lg:p-10 flex flex-col justify-between relative overflow-hidden border-r border-emerald-800/60">
          
          {/* Subtle Graphic Accents */}
          <div className="absolute -right-10 -bottom-10 w-48 h-48 rounded-full bg-white/5 blur-xl pointer-events-none" />

          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#FACC15] text-[#064E3B] flex items-center justify-center shadow-lg font-black text-xl">
                <Fuel className="w-7 h-7 fill-[#064E3B]" />
              </div>
              <div>
                <h1 className="font-black text-2xl tracking-tight text-white">AndradeAgro</h1>
                <p className="text-[11px] font-bold text-[#FACC15] uppercase tracking-widest">
                  Gestão Agrícola & Frotas
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <h2 className="text-xl font-extrabold leading-snug">
                Controle Inteligente de Abastecimentos e Campo
              </h2>
              <p className="text-xs text-emerald-100/90 leading-relaxed">
                Plataforma integrada com permissões por perfil. Lançamento rápido de combustível no campo para operadores e controle financeiro completo para gestores.
              </p>
            </div>

            <div className="space-y-2 pt-2 text-xs font-semibold text-emerald-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#FACC15] shrink-0" />
                <span>Perfil Operador: Módulo exclusivo de registros</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#FACC15] shrink-0" />
                <span>Perfil Gestor: Custos, gráficos e frota</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#FACC15] shrink-0" />
                <span>Tecnologia de Leitura QR Code em campo</span>
              </div>
            </div>
          </div>

          {/* Tablet & Mobile Shortcut Prompt */}
          <div className="pt-8 border-t border-emerald-700/60 mt-6">
            <button
              onClick={() => setShowTabletHelp(!showTabletHelp)}
              className="w-full text-left p-3 rounded-2xl bg-emerald-900/60 border border-emerald-700 hover:bg-emerald-800/80 transition-all flex items-center justify-between text-xs font-bold text-emerald-100"
            >
              <div className="flex items-center gap-2">
                <Tablet className="w-4 h-4 text-[#FACC15]" />
                <span>Usar como Atalho no Tablet</span>
              </div>
              <Smartphone className="w-3.5 h-3.5 opacity-80" />
            </button>

            {showTabletHelp && (
              <div className="mt-2 p-3 rounded-xl bg-emerald-950/90 text-[11px] text-emerald-200 space-y-1.5 border border-emerald-800 animate-in fade-in">
                <p className="font-bold text-[#FACC15]">📲 Dica para criar atalho no iPad/Android:</p>
                <p>1. No navegador do tablet, toque no menu de opções (três pontos) ou Compartilhar no Safari.</p>
                <p>2. Selecione <strong>"Adicionar à Tela Inicial"</strong>.</p>
                <p>3. O sistema funcionará como aplicativo de tela cheia no campo!</p>
              </div>
            )}
          </div>

        </div>

        {/* Right Side: Login Form (7 cols) */}
        <div className="md:col-span-7 p-8 lg:p-12 flex flex-col justify-between bg-[#042d23]">
          
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-slate-100">
                Acesse sua Conta
              </h2>
              <p className="text-xs text-emerald-300/90 mt-1">
                Informe suas credenciais para entrar no sistema de acordo com sua permissão.
              </p>
            </div>

            {successMessage && (
              <div className="p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-700 text-emerald-100 text-xs font-bold flex items-center gap-2.5 shadow-sm">
                <CheckCircle2 className="w-5 h-5 text-[#FACC15] shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="p-3.5 rounded-2xl bg-red-950/60 border border-red-800 text-red-200 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-200">
                  E-mail do Usuário
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400" />
                  <input
                    type="email"
                    required
                    placeholder="seu.email@andradeagro.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-2xl text-xs font-semibold border outline-none transition-all bg-emerald-950/80 border-emerald-800 text-slate-100 placeholder-emerald-500/70 focus:border-[#FACC15]"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-200">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-2xl text-xs font-semibold border outline-none transition-all bg-emerald-950/80 border-emerald-800 text-slate-100 placeholder-emerald-500/70 focus:border-[#FACC15]"
                  />
                </div>
              </div>

              {/* Remember Me Option */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-emerald-800 bg-emerald-950 text-[#064E3B] focus:ring-[#064E3B]"
                  />
                  <span className="text-xs font-semibold text-emerald-300">
                    Lembrar meu acesso neste dispositivo
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 rounded-2xl bg-[#064E3B] hover:bg-[#043d2e] text-[#FACC15] font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-[0.99] min-h-[48px]"
              >
                {isLoading ? (
                  <span>Entrando no sistema...</span>
                ) : (
                  <>
                    <span>ENTRAR NO SISTEMA</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Quick Select Demo Cards - Todos os Usuários (ADMs e Funcionários) */}
          <div className="pt-6 border-t border-emerald-900/60 mt-6 space-y-3">
            <p className="text-[11px] font-extrabold uppercase text-emerald-300 tracking-wider">
              Atalhos de Acesso Rápido (ADMs e Funcionários):
            </p>

            {/* Seção Administradores */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                Administradores (Acesso Total)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {/* Admin Carlos */}
                <button
                  type="button"
                  onClick={() => handleQuickSelect('admin@andradeagro.com.br', '123456')}
                  className="p-2.5 rounded-2xl border text-left transition-all hover:border-[#FACC15] bg-emerald-950/60 border-emerald-900"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[#FACC15]">
                      Carlos Andrade
                    </span>
                    <span className="text-[9px] font-bold bg-[#FACC15]/20 text-[#FACC15] px-1.5 py-0.5 rounded">
                      ADMIN
                    </span>
                  </div>
                  <p className="text-[10px] text-emerald-300/80 truncate mt-0.5">
                    admin@andradeagro.com.br
                  </p>
                </button>

                {/* Admin Patrícia */}
                <button
                  type="button"
                  onClick={() => handleQuickSelect('patricia.gestao@andradeagro.com.br', '123456')}
                  className="p-2.5 rounded-2xl border text-left transition-all hover:border-[#FACC15] bg-emerald-950/60 border-emerald-900"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[#FACC15]">
                      Patrícia Lima
                    </span>
                    <span className="text-[9px] font-bold bg-[#FACC15]/20 text-[#FACC15] px-1.5 py-0.5 rounded">
                      ADMIN
                    </span>
                  </div>
                  <p className="text-[10px] text-emerald-300/80 truncate mt-0.5">
                    patricia.gestao@andradeagro.com.br
                  </p>
                </button>
              </div>
            </div>

            {/* Seção Funcionários */}
            <div className="space-y-1 pt-1">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                Funcionários (Campo & Operação)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                {/* João Silva */}
                <button
                  type="button"
                  onClick={() => handleQuickSelect('joao.silva@andradeagro.com.br', '123456')}
                  className="p-2 rounded-2xl border text-left transition-all hover:border-[#FACC15] bg-emerald-950/60 border-emerald-900"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[#FACC15] truncate">
                      João Silva
                    </span>
                    <span className="text-[8px] font-bold bg-amber-500/10 text-amber-400 px-1 py-0.5 rounded shrink-0">
                      OPERADOR
                    </span>
                  </div>
                  <p className="text-[9px] text-emerald-300/80 truncate mt-0.5">
                    joao.silva@andradeagro...
                  </p>
                </button>

                {/* Marcos Oliveira */}
                <button
                  type="button"
                  onClick={() => handleQuickSelect('marcos.operador@andradeagro.com.br', '123456')}
                  className="p-2 rounded-2xl border text-left transition-all hover:border-[#FACC15] bg-emerald-950/60 border-emerald-900"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[#FACC15] truncate">
                      Marcos Oliveira
                    </span>
                    <span className="text-[8px] font-bold bg-amber-500/10 text-amber-400 px-1 py-0.5 rounded shrink-0">
                      COLHEITA
                    </span>
                  </div>
                  <p className="text-[9px] text-emerald-300/80 truncate mt-0.5">
                    marcos.operador@andrade...
                  </p>
                </button>

                {/* Roberto Santos */}
                <button
                  type="button"
                  onClick={() => handleQuickSelect('roberto.frentista@andradeagro.com.br', '123456')}
                  className="p-2 rounded-2xl border text-left transition-all hover:border-[#FACC15] bg-emerald-950/60 border-emerald-900"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[#FACC15] truncate">
                      Roberto Santos
                    </span>
                    <span className="text-[8px] font-bold bg-amber-500/10 text-amber-400 px-1 py-0.5 rounded shrink-0">
                      FRENTISTA
                    </span>
                  </div>
                  <p className="text-[9px] text-emerald-300/80 truncate mt-0.5">
                    roberto.frentista@andrade...
                  </p>
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

export const LoginView = React.memo(LoginViewComponent);
