import React, { useState, useEffect } from 'react';
import { 
  Shield, Fuel, Lock, Mail, CheckCircle2, AlertCircle, Tablet, 
  Key, User as UserIcon, ArrowRight, Sparkles, Building2, Smartphone,
  Trash2, UserCheck, X, Plus, Settings2, RotateCcw
} from 'lucide-react';
import { User } from '../types';
import { 
  loginUser, getRememberedUser, clearRememberedUser, getUsers, 
  getQuickAccessUserIds, setQuickAccessUserIds, toggleQuickAccessUser 
} from '../utils/storage';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
  darkMode?: boolean;
  successMessage?: string | null;
}

export const LoginViewComponent: React.FC<LoginViewProps> = ({ onLoginSuccess, successMessage }) => {
  const [savedUser, setSavedUser] = useState<User | null>(() => getRememberedUser());
  const [email, setEmail] = useState(() => {
    const remembered = getRememberedUser();
    return remembered ? (remembered.email || '') : '';
  });
  const [password, setPassword] = useState(() => {
    const remembered = getRememberedUser();
    return remembered?.password || '';
  });
  const [rememberMe, setRememberMe] = useState(() => {
    return !!getRememberedUser();
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [removedNotice, setRemovedNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showTabletHelp, setShowTabletHelp] = useState(false);
  const [showAlternativeForm, setShowAlternativeForm] = useState(false);
  
  // Quick Access Management
  const [allUsers, setAllUsers] = useState<User[]>(() => getUsers());
  const [quickAccessIds, setQuickAccessIds] = useState<string[]>(() => getQuickAccessUserIds());
  const [showManageModal, setShowManageModal] = useState(false);

  // Sync state if savedUser changes or data updates
  useEffect(() => {
    const handleUpdate = () => {
      setAllUsers(getUsers());
      setQuickAccessIds(getQuickAccessUserIds());
    };
    window.addEventListener('andradeagro_data_updated', handleUpdate);

    const u = getRememberedUser();
    setSavedUser(u);
    if (u) {
      setEmail(u.email || '');
      setPassword(u.password || '');
      setRememberMe(true);
    }

    return () => {
      window.removeEventListener('andradeagro_data_updated', handleUpdate);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setRemovedNotice(null);
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

  const handleRemoveSavedLogin = () => {
    clearRememberedUser();
    setSavedUser(null);
    setEmail('');
    setPassword('');
    setRememberMe(false);
    setShowAlternativeForm(true);
    setRemovedNotice('Login salvo desvinculado deste dispositivo com sucesso.');
  };

  const handleQuickSelect = (userEmail: string, userPass?: string) => {
    setEmail(userEmail);
    setPassword(userPass || '123456');
    setErrorMessage(null);
    setShowAlternativeForm(true);
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
        <div className="bg-emerald-950/80 backdrop-blur-xl border border-emerald-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-emerald-950/80 text-emerald-100">
          
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

          {removedNotice && (
            <div className="mb-4 p-3 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{removedNotice}</span>
            </div>
          )}

          {errorMessage && (
            <div className="mb-4 p-3 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Login Mode: Saved Device Profile OR Direct Form */}
          <div>
            {savedUser && !showAlternativeForm ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-900/50 border border-emerald-700/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img 
                      src={savedUser.avatar || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80'} 
                      alt={savedUser.name}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-xl object-cover border border-emerald-600" 
                    />
                    <div>
                      <h3 className="font-bold text-sm text-white">{savedUser.name}</h3>
                      <p className="text-xs text-emerald-300/80">{savedUser.email}</p>
                      <span className="inline-block mt-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-[#FACC15]/20 text-[#FACC15]">
                        {savedUser.role} • {savedUser.department || 'Operacional'}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsLoading(true);
                    setTimeout(() => {
                      const res = loginUser(savedUser.email, savedUser.password || '123456', true);
                      setIsLoading(false);
                      if (res.success && res.user) onLoginSuccess(res.user);
                      else setErrorMessage(res.error || 'Erro ao entrar.');
                    }, 300);
                  }}
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-2xl bg-[#064E3B] hover:bg-[#043d2e] text-[#FACC15] font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-all min-h-[44px]"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>CONTINUAR COMO {savedUser.name.toUpperCase()}</span>
                </button>

                <div className="flex items-center justify-between pt-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowAlternativeForm(true)}
                    className="text-emerald-300 hover:text-white underline font-semibold"
                  >
                    Entrar com outra conta
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveSavedLogin}
                    className="text-red-400 hover:text-red-300 flex items-center gap-1 font-semibold"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Esquecer este perfil
                  </button>
                </div>
              </div>
            ) : (
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
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-emerald-800 bg-emerald-950 text-[#064E3B] focus:ring-[#064E3B]"
                    />
                    <span className="text-xs font-semibold text-emerald-300">
                      Salvar login neste dispositivo
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
            )}
          </div>

          {/* Quick Select Cards - Atalhos de Acesso Rápido com Gestão Completa */}
          <div className="pt-6 border-t border-emerald-900/60 mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-extrabold uppercase text-emerald-300 tracking-wider">
                Atalhos de Acesso Rápido ({visibleShortcuts.length}):
              </p>
              <button
                type="button"
                onClick={() => setShowManageModal(true)}
                className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-900/50 hover:bg-emerald-900 border border-emerald-700/60"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>Gerenciar Atalhos</span>
              </button>
            </div>

            {visibleShortcuts.length === 0 ? (
              <div className="p-4 rounded-2xl bg-emerald-950/60 border border-dashed border-emerald-800 text-center space-y-2">
                <p className="text-xs text-emerald-300/80">Nenhum atalho exibido no momento.</p>
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
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                      Administradores (Acesso Total)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {adminShortcuts.map(user => (
                        <div
                          key={user.id}
                          onClick={() => handleQuickSelect(user.email, user.password || '123456')}
                          className="p-2.5 rounded-2xl border text-left transition-all hover:border-[#FACC15] bg-emerald-950/60 border-emerald-900 cursor-pointer relative group"
                        >
                          <button
                            type="button"
                            onClick={(e) => handleRemoveShortcut(user.id, e)}
                            title="Remover este atalho"
                            className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-emerald-900/80 hover:bg-red-500/80 text-emerald-400 hover:text-white flex items-center justify-center opacity-70 group-hover:opacity-100 transition-all"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <div className="flex items-center justify-between pr-5">
                            <span className="font-extrabold text-[#FACC15] truncate">
                              {user.name}
                            </span>
                            <span className="text-[9px] font-bold bg-[#FACC15]/20 text-[#FACC15] px-1.5 py-0.5 rounded shrink-0">
                              ADMIN
                            </span>
                          </div>
                          <p className="text-[10px] text-emerald-300/80 truncate mt-0.5">
                            {user.email}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Seção Funcionários */}
                {employeeShortcuts.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                      Funcionários (Campo & Operação)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      {employeeShortcuts.map(user => (
                        <div
                          key={user.id}
                          onClick={() => handleQuickSelect(user.email, user.password || '123456')}
                          className="p-2 rounded-2xl border text-left transition-all hover:border-[#FACC15] bg-emerald-950/60 border-emerald-900 cursor-pointer relative group"
                        >
                          <button
                            type="button"
                            onClick={(e) => handleRemoveShortcut(user.id, e)}
                            title="Remover este atalho"
                            className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-900/80 hover:bg-red-500/80 text-emerald-400 hover:text-white flex items-center justify-center opacity-70 group-hover:opacity-100 transition-all"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                          <div className="flex items-center justify-between pr-4">
                            <span className="font-extrabold text-[#FACC15] truncate">
                              {user.name.split(' ')[0]} {user.name.split(' ')[1] ? user.name.split(' ')[1][0] + '.' : ''}
                            </span>
                            <span className="text-[8px] font-bold bg-amber-500/10 text-amber-400 px-1 py-0.5 rounded shrink-0 uppercase">
                              {user.department || user.role}
                            </span>
                          </div>
                          <p className="text-[9px] text-emerald-300/80 truncate mt-0.5">
                            {user.email}
                          </p>
                        </div>
                      ))}
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
