import React, { useState } from 'react';
import { 
  Fuel, Search, Bell, Plus, QrCode, Shield, User as UserIcon, 
  LogOut, CheckCircle2, AlertTriangle, ChevronDown, Sparkles 
} from 'lucide-react';
import { User, SmartAlert } from '../types';
import { getUsers, setCurrentUser } from '../utils/storage';

interface HeaderProps {
  currentUser: User;
  onUserChanged: (user: User) => void;
  onLogout: () => void;
  onOpenFuelingModal: () => void;
  onOpenQRScanner: () => void;
  onNavigate: (tab: string) => void;
  alerts: SmartAlert[];
  darkMode?: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const HeaderComponent: React.FC<HeaderProps> = ({
  currentUser,
  onUserChanged,
  onLogout,
  onOpenFuelingModal,
  onOpenQRScanner,
  onNavigate,
  alerts = [],
  searchQuery,
  onSearchChange,
}) => {
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showAlertsDropdown, setShowAlertsDropdown] = useState(false);
  
  const allUsers = React.useMemo(() => getUsers(), []);
  const unresolvedAlerts = React.useMemo(() => (alerts || []).filter(a => !a.resolved), [alerts]);

  return (
    <header className="sticky top-0 z-30 border-b transition-colors h-16 flex items-center bg-[#04281f]/95 border-emerald-900/60 text-[#f8fafc] backdrop-blur-md">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          
          {/* Section Title */}
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-100">
              {currentUser.role === 'FUNCIONARIO' ? 'Módulo do Operador' : 'Painel Administrativo'}
            </h1>
          </div>

          {/* Quick Search Input */}
          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-emerald-300" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Pesquisar por placa, trator, operador ou posto..."
                className="w-full pl-10 pr-4 py-2 text-xs font-medium rounded-full border border-emerald-800 transition-all outline-none bg-emerald-950/80 text-slate-100 placeholder-emerald-300/80 focus:ring-2 focus:ring-[#FACC15]/40"
              />
            </div>
          </div>

          {/* Actions & User Profile */}
          <div className="flex items-center gap-2 sm:gap-4">
            
            {/* QR Code Scanner Quick Button */}
            <button
              onClick={onOpenQRScanner}
              title="Escanear QR Code de Veículo / Máquina"
              className="p-2 sm:px-3 sm:py-2 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-all bg-emerald-900/40 border-emerald-800 text-emerald-200 hover:bg-emerald-800/60"
            >
              <QrCode className="w-4 h-4 text-[#C5A059]" />
              <span className="hidden lg:inline">Ler QR Code</span>
            </button>

            {/* Quick Fuel Log Button */}
            <button
              onClick={onOpenFuelingModal}
              className="bg-[#064E3B] hover:bg-[#043d2e] text-white font-bold text-xs px-4 py-2 rounded-full shadow-sm flex items-center gap-1.5 transition-all active:scale-95 border border-emerald-700/50"
            >
              <Plus className="w-4 h-4 text-[#C5A059]" />
              <span className="hidden sm:inline">Novo Abastecimento</span>
            </button>

            {/* Notifications Bell (Only for ADMINs) */}
            {currentUser.role === 'ADMIN' && (
              <div className="relative">
                <button
                  onClick={() => setShowAlertsDropdown(!showAlertsDropdown)}
                  className="w-9 h-9 rounded-full border flex items-center justify-center relative transition-colors bg-emerald-900/40 border-emerald-800 text-emerald-200 hover:bg-emerald-800/60"
                  title="Alertas e Notificações"
                >
                  <Bell className="w-4.5 h-4.5" />
                  {unresolvedAlerts.length > 0 && (
                    <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 border-2 border-[#04281f] rounded-full"></span>
                  )}
                </button>

                {/* Alerts Dropdown Popover */}
                {showAlertsDropdown && (
                  <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-3xl shadow-2xl border p-4 z-50 animate-in fade-in slide-in-from-top-2 bg-[#042d23] border-emerald-800 text-emerald-100">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-emerald-900/50">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <span className="font-bold text-xs">Alertas Críticos ({unresolvedAlerts.length})</span>
                      </div>
                      <button 
                        onClick={() => { setShowAlertsDropdown(false); onNavigate('alerts'); }}
                        className="text-[11px] text-[#C5A059] font-bold hover:underline"
                      >
                        Ver Todos
                      </button>
                    </div>

                    {unresolvedAlerts.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1.5 opacity-80" />
                        Nenhum alerta pendente.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {unresolvedAlerts.slice(0, 4).map(alert => (
                          <div 
                            key={alert.id}
                            onClick={() => { setShowAlertsDropdown(false); onNavigate('alerts'); }}
                            className={`p-3 rounded-2xl border text-xs cursor-pointer transition-all ${
                              alert.severity === 'ALTA' 
                                ? 'bg-red-50 border-red-100 text-red-900 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-200' 
                                : 'bg-emerald-50 border-emerald-100 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-200'
                            }`}
                          >
                            <div className="font-semibold flex items-center justify-between mb-0.5">
                              <span>{alert.title}</span>
                              <span className="text-[10px] opacity-75">{alert.date}</span>
                            </div>
                            <p className="text-[11px] opacity-90 line-clamp-2">{alert.description}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* User Profile / Role Switcher Button */}
            <div className="relative">
              <button
                onClick={() => setShowRoleModal(!showRoleModal)}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full border bg-emerald-900/40 border-emerald-800 hover:border-[#C5A059]/50 transition-all"
              >
                <img
                  src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                  alt={currentUser.name}
                  className="w-7 h-7 rounded-full object-cover ring-2 ring-[#C5A059]/60"
                />
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-bold leading-none text-slate-100">{currentUser.name}</p>
                  <p className="text-[9px] font-bold text-[#C5A059] flex items-center gap-1 mt-0.5 uppercase tracking-wider">
                    {currentUser.role === 'ADMIN' ? 'Administrador' : 'Operador'}
                    <ChevronDown className="w-3 h-3 opacity-70" />
                  </p>
                </div>
              </button>

              {/* Role / User Switcher Popover */}
              {showRoleModal && (
                <div className="absolute right-0 mt-3 w-72 rounded-3xl shadow-2xl border p-4 z-50 bg-[#042d23] border-emerald-800 text-emerald-100">
                  <div className="pb-2 mb-2 border-b border-emerald-900/40">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
                      Alternar Perfil Ativo
                    </p>
                    <p className="text-[10px] text-emerald-200 font-medium">
                      Escolha o usuário ativo para simular permissões:
                    </p>
                  </div>

                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {allUsers.map(user => (
                      <button
                        key={user.id}
                        onClick={() => {
                          setCurrentUser(user);
                          onUserChanged(user);
                          setShowRoleModal(false);
                        }}
                        className={`w-full flex items-center gap-2.5 p-2 rounded-2xl text-left transition-all ${
                          user.id === currentUser.id 
                            ? 'bg-emerald-900/60 border border-emerald-700 text-[#C5A059] font-bold' 
                            : 'hover:bg-emerald-900/40 text-emerald-200'
                        }`}
                      >
                        <img
                          src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                          alt={user.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{user.name}</p>
                          <p className="text-[10px] opacity-75">{user.department} • <span className="font-semibold text-[#C5A059]">{user.role}</span></p>
                        </div>
                        {user.id === currentUser.id && (
                          <CheckCircle2 className="w-4 h-4 text-[#C5A059] shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 pt-2 border-t border-emerald-900/40 text-center space-y-2">
                    <button
                      onClick={() => { setShowRoleModal(false); onNavigate('settings'); }}
                      className="text-[11px] text-[#C5A059] font-bold hover:underline flex items-center justify-center gap-1 w-full"
                    >
                      <UserIcon className="w-3.5 h-3.5" /> Configurações de Perfil
                    </button>

                    <button
                      onClick={() => { setShowRoleModal(false); onLogout(); }}
                      className="text-[11px] text-red-400 font-bold hover:bg-red-950/40 py-1.5 px-2 rounded-xl flex items-center justify-center gap-1.5 w-full transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Sair da Conta (Logout)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Logout Quick Button */}
            <button
              onClick={onLogout}
              className="p-2 rounded-full border text-red-400 hover:bg-red-950/50 transition-colors border-emerald-900"
              title="Sair da Conta (Logout)"
            >
              <LogOut className="w-4 h-4" />
            </button>

          </div>

        </div>
      </div>
    </header>
  );
};

export const Header = React.memo(HeaderComponent);
