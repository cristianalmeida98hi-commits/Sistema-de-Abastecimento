import React, { useState, useEffect } from 'react';
import { 
  Fuel, Lock, Mail, CheckCircle2, AlertCircle, 
  ArrowRight, UserCheck, X, Settings2, RotateCcw, Shield, Users
} from 'lucide-react';
import { User } from '../types';
import { 
  loginUser, getRememberedEmail, clearRememberedEmail, getUsers, 
  getQuickAccessUserIds, setQuickAccessUserIds, toggleQuickAccessUser 
} from '../utils/storage';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
  darkMode?: boolean;
  successMessage?: string | null;
}

export const LoginViewComponent: React.FC<LoginViewProps> = ({ onLoginSuccess, successMessage }) => {
  const [email, setEmail] = useState(() => getRememberedEmail());
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => !!getRememberedEmail());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loggingInUserId, setLoggingInUserId] = useState<string | null>(null);
  
  // Quick Access Management
  const [allUsers, setAllUsers] = useState<User[]>(() => getUsers());
  const [quickAccessIds, setQuickAccessIds] = useState<string[]>(() => getQuickAccessUserIds());
  const [showManageModal, setShowManageModal] = useState(false);

  // Sync state if data updates
  useEffect(() => {
    const handleUpdate = () => {
      setAllUsers(getUsers());
      setQuickAccessIds(getQuickAccessUserIds());
    };
    window.addEventListener('andradeagro_data_updated', handleUpdate);

    return () => {
      window.removeEventListener('andradeagro_data_updated', handleUpdate);
    };
  }, []);

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
    }, 250);
  };

  // Direct 1-Click Login for Quick Access Shortcuts
  const handleQuickLogin = (user: User) => {
    if (isLoading || loggingInUserId) return;
    setErrorMessage(null);
    setLoggingInUserId(user.id);

    setTimeout(() => {
      const res = loginUser(user.email, user.password || '123456', rememberMe);
      setLoggingInUserId(null);

      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMessage(res.error || 'Não foi possível autenticar o usuário.');
      }
    }, 200);
  };

  const handleRemoveShortcut = async (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = quickAccessIds.filter(id => id !== userId);
    setQuickAccessIds(updated);
    await setQuickAccessUserIds(updated);
  };

  const handleToggleShortcut = async (userId: string) => {
    await toggleQuickAccessUser(userId);
    setQuickAccessIds(getQuickAccessUserIds());
  };

  const handleRestoreAllShortcuts = async () => {
    const allActiveIds = allUsers.filter(u => u.active !== false).map(u => u.id);
    setQuickAccessIds(allActiveIds);
    await setQuickAccessUserIds(allActiveIds);
  };

  const activeUsers = allUsers.filter(u => u.active !== false);
  const visibleShortcuts = activeUsers.filter(u => quickAccessIds.includes(u.id));
  const adminShortcuts = visibleShortcuts.filter(u => u.role === 'ADMIN');
  const employeeShortcuts = visibleShortcuts.filter(u => u.role !== 'ADMIN');

  return (
    <div className="min-h-screen flex items-center justify-center p-3 sm:p-6 bg-gradient-to-br from-emerald-950 via-[#064E3B] to-emerald-950">
      <div className="w-full max-w-xl mx-auto space-y-6">
        
        {/* Card Principal */}
        <div className="bg-emerald-950/90 backdrop-blur-xl border border-emerald-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-emerald-950/80 text-emerald-100">
          
          {/* Logo & Header */}
          <div className="text-center space-y-2 mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#064E3B] text-[#FACC15] border border-emerald-700 shadow-md">
              <Fuel className="w-7 h-7" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              AndradeAgro
            </h1>
            <p className="text-xs text-emerald-300/80 font-medium">
              Gestão Inteligente de Abastecimentos & Frotas Agrícolas
            </p>
          </div>

          {/* Messages */}
          {successMessage && (
            <div className="mb-4 p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="mb-4 p-3 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form de Login */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-emerald-200 mb-1">
                E-mail do Usuário
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@andradeagro.com.br"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-emerald-900/40 border border-emerald-800 text-white text-xs placeholder:text-emerald-400/50 outline-none focus:border-[#FACC15]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-emerald-200 mb-1">
                Senha de Acesso
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-emerald-900/40 border border-emerald-800 text-white text-xs placeholder:text-emerald-400/50 outline-none focus:border-[#FACC15]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => {
                    setRememberMe(e.target.checked);
                    if (!e.target.checked) {
                      clearRememberedEmail();
                    }
                  }}
                  className="w-4 h-4 rounded border-emerald-800 bg-emerald-950 text-[#064E3B] focus:ring-[#064E3B]"
                />
                <span className="text-xs font-semibold text-emerald-300">
                  Lembrar e-mail neste navegador
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

          {/* Quick Select Cards - Atalhos de Seleção Rápida */}
          <div className="pt-6 border-t border-emerald-900/60 mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-extrabold uppercase text-emerald-300 tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#FACC15]" />
                  Atalhos Rápidos de Acesso ({visibleShortcuts.length}):
                </p>
                <span className="text-[10px] text-emerald-400/80">
                  Clique diretamente no perfil para entrar
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowManageModal(true)}
                className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-900/50 hover:bg-emerald-900 border border-emerald-700/60"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>Gerenciar</span>
              </button>
            </div>

            {visibleShortcuts.length === 0 ? (
              <div className="p-4 rounded-2xl bg-emerald-950/60 border border-dashed border-emerald-800 text-center space-y-2">
                <p className="text-xs text-emerald-300/80">Nenhum atalho rápido configurado.</p>
                <button
                  type="button"
                  onClick={handleRestoreAllShortcuts}
                  className="text-xs font-bold text-amber-400 underline"
                >
                  Restaurar todos os usuários da equipe
                </button>
              </div>
            ) : (
              <>
                {/* Seção Administradores */}
                {adminShortcuts.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                      <Shield className="w-3 h-3 text-[#FACC15]" />
                      Administradores (Painel Completo)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {adminShortcuts.map(user => {
                        const isThisLoggingIn = loggingInUserId === user.id;
                        return (
                          <div
                            key={user.id}
                            onClick={() => handleQuickLogin(user)}
                            title={`Clique para entrar imediatamente como ${user.name}`}
                            className={`p-2.5 rounded-2xl border text-left transition-all hover:border-[#FACC15] hover:bg-emerald-900/70 bg-emerald-950/60 border-emerald-900 cursor-pointer relative group ${
                              isThisLoggingIn ? 'ring-2 ring-[#FACC15] bg-emerald-900/90' : ''
                            } ${loggingInUserId && !isThisLoggingIn ? 'opacity-50 pointer-events-none' : ''}`}
                          >
                            <button
                              type="button"
                              onClick={(e) => handleRemoveShortcut(user.id, e)}
                              title="Remover este atalho"
                              className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-emerald-900/80 hover:bg-red-500/80 text-emerald-400 hover:text-white flex items-center justify-center opacity-70 group-hover:opacity-100 transition-all z-10"
                            >
                              <X className="w-3 h-3" />
                            </button>
                            <div className="flex items-center justify-between pr-5">
                              <span className="font-extrabold text-[#FACC15] truncate flex items-center gap-1.5">
                                {isThisLoggingIn && (
                                  <div className="w-3 h-3 border-2 border-[#FACC15] border-t-transparent rounded-full animate-spin shrink-0"></div>
                                )}
                                <span className="truncate">{user.name}</span>
                              </span>
                              <span className="text-[9px] font-bold bg-[#FACC15]/20 text-[#FACC15] px-1.5 py-0.5 rounded shrink-0">
                                ADMIN
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <p className="text-[10px] text-emerald-300/80 truncate">
                                {user.email}
                              </p>
                              {isThisLoggingIn && (
                                <span className="text-[9px] font-bold text-[#FACC15] animate-pulse">
                                  Entrando...
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Seção Funcionários */}
                {employeeShortcuts.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-amber-400" />
                      Operadores & Funcionários (Campo)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      {employeeShortcuts.map(user => {
                        const isThisLoggingIn = loggingInUserId === user.id;
                        return (
                          <div
                            key={user.id}
                            onClick={() => handleQuickLogin(user)}
                            title={`Clique para entrar imediatamente como ${user.name}`}
                            className={`p-2 rounded-2xl border text-left transition-all hover:border-[#FACC15] hover:bg-emerald-900/70 bg-emerald-950/60 border-emerald-900 cursor-pointer relative group ${
                              isThisLoggingIn ? 'ring-2 ring-[#FACC15] bg-emerald-900/90' : ''
                            } ${loggingInUserId && !isThisLoggingIn ? 'opacity-50 pointer-events-none' : ''}`}
                          >
                            <button
                              type="button"
                              onClick={(e) => handleRemoveShortcut(user.id, e)}
                              title="Remover este atalho"
                              className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-900/80 hover:bg-red-500/80 text-emerald-400 hover:text-white flex items-center justify-center opacity-70 group-hover:opacity-100 transition-all z-10"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                            <div className="flex items-center justify-between pr-4">
                              <span className="font-extrabold text-[#FACC15] truncate flex items-center gap-1">
                                {isThisLoggingIn && (
                                  <div className="w-2.5 h-2.5 border-2 border-[#FACC15] border-t-transparent rounded-full animate-spin shrink-0"></div>
                                )}
                                <span className="truncate">
                                  {user.name.split(' ')[0]} {user.name.split(' ')[1] ? user.name.split(' ')[1][0] + '.' : ''}
                                </span>
                              </span>
                              <span className="text-[8px] font-bold bg-amber-500/10 text-amber-400 px-1 py-0.5 rounded shrink-0 uppercase">
                                {user.department || user.role}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <p className="text-[9px] text-emerald-300/80 truncate">
                                {user.email}
                              </p>
                              {isThisLoggingIn && (
                                <span className="text-[8px] font-bold text-[#FACC15] animate-pulse">
                                  Entrando...
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

        </div>

      </div>

      {/* Modal para Gerenciar Atalhos de Acesso Rápido */}
      {showManageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-emerald-950 border border-emerald-800 rounded-3xl p-6 shadow-2xl space-y-4 text-emerald-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-emerald-800/60 pb-3">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-[#FACC15]" />
                <h3 className="font-extrabold text-sm text-white">
                  Gerenciar Atalhos de Acesso Rápido
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowManageModal(false)}
                className="p-1.5 rounded-xl hover:bg-emerald-900 text-emerald-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-emerald-300/80">
              Marque os administradores e funcionários que deseja exibir nos cartões de acesso rápido da tela inicial:
            </p>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {activeUsers.map(user => {
                const isSelected = quickAccessIds.includes(user.id);
                return (
                  <label
                    key={user.id}
                    className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-emerald-900/60 border-amber-400/60 text-white'
                        : 'bg-emerald-950/40 border-emerald-900/60 text-emerald-300/60 hover:bg-emerald-900/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleShortcut(user.id)}
                        className="w-4 h-4 rounded border-emerald-800 bg-emerald-950 text-[#064E3B] focus:ring-[#064E3B]"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <strong className="text-xs text-white">{user.name}</strong>
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                            user.role === 'ADMIN' ? 'bg-[#FACC15]/20 text-[#FACC15]' : 'bg-emerald-500/20 text-emerald-300'
                          }`}>
                            {user.role}
                          </span>
                        </div>
                        <p className="text-[10px] text-emerald-300/70">{user.email}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-400">
                      {user.department}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="pt-3 border-t border-emerald-800/60 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleRestoreAllShortcuts}
                className="px-3 py-2 rounded-xl text-xs font-bold text-amber-400 hover:bg-emerald-900 flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Exibir Todos</span>
              </button>

              <button
                type="button"
                onClick={() => setShowManageModal(false)}
                className="px-5 py-2.5 rounded-xl bg-amber-400 text-gray-950 font-bold text-xs shadow-md hover:bg-amber-300"
              >
                Pronto
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export const LoginView = React.memo(LoginViewComponent);
