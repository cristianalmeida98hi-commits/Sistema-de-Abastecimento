import React, { useState } from 'react';
import { 
  Fuel, Search, Bell, Sun, Moon, Plus, QrCode, Shield, User as UserIcon, 
  LogOut, CheckCircle2, AlertTriangle, ChevronDown, Sparkles 
} from 'lucide-react';
import { User, SmartAlert } from '../types';
import { getUsers, setCurrentUser } from '../utils/storage';

interface HeaderProps {
  currentUser: User;
  onUserChanged: (user: User) => void;
  onOpenFuelingModal: () => void;
  onOpenQRScanner: () => void;
  onNavigate: (tab: string) => void;
  alerts: SmartAlert[];
  darkMode: boolean;
  onToggleDarkMode: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onUserChanged,
  onOpenFuelingModal,
  onOpenQRScanner,
  onNavigate,
  alerts = [],
  darkMode,
  onToggleDarkMode,
  searchQuery,
  onSearchChange,
}) => {
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showAlertsDropdown, setShowAlertsDropdown] = useState(false);
  const allUsers = getUsers();

  const unresolvedAlerts = (alerts || []).filter(a => !a.resolved);

  return (
    <header className={`sticky top-0 z-30 border-b transition-colors h-16 flex items-center ${
      darkMode ? 'bg-[#04281f]/95 border-emerald-900/60 text-[#f8fafc] backdrop-blur-md' : 'bg-white/95 border-slate-200 text-slate-800 backdrop-blur-md'
    }`}>
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          
          {/* Section Title */}
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Visão Geral</h1>
          </div>

          {/* Quick Search Input */}
          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-emerald-300" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Pesquisar por placa, trator, operador ou posto..."
                className={`w-full pl-10 pr-4 py-2 text-xs font-medium rounded-full border border-transparent transition-all outline-none ${
                  darkMode 
                    ? 'bg-emerald-950/80 border-emerald-800 text-slate-100 placeholder-emerald-300/80 focus:ring-2 focus:ring-[#FACC15]/40' 
                    : 'bg-slate-100 text-slate-900 placeholder-slate-500 focus:bg-white focus:ring-2 focus:ring-[#064E3B]/20 focus:border-slate-300'
                }`}
              />
            </div>
          </div>

          {/* Actions & User Profile */}
          <div className="flex items-center gap-2 sm:gap-4">
            
            {/* QR Code Scanner Quick Button */}
            <button
              onClick={onOpenQRScanner}
              title="Escanear QR Code de Veículo / Máquina"
              className={`p-2 sm:px-3 sm:py-2 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                darkMode
                  ? 'bg-emerald-900/40 border-emerald-800 text-emerald-200 hover:bg-emerald-800/60'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200/80'
              }`}
            >
              <QrCode className="w-4 h-4 text-[#064E3B] dark:text-[#C5A059]" />
              <span className="hidden lg:inline">Ler QR Code</span>
            </button>

            {/* Quick Fuel Log Button */}
            <button
              onClick={onOpenFuelingModal}
              className="bg-[#064E3B] hover:bg-[#043d2e] text-white font-bold text-xs px-4 py-2 rounded-full shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4 text-[#C5A059]" />
              <span className="hidden sm:inline">Novo Abastecimento</span>
            </button>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                onClick={() => setShowAlertsDropdown(!showAlertsDropdown)}
                className={`w-9 h-9 rounded-full border flex items-center justify-center relative transition-colors ${
                  darkMode
                    ? 'bg-emerald-900/40 border-emerald-800 text-emerald-200 hover:bg-emerald-800/60'
                    : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                }`}
                title="Alertas e Notificações"
              >
                <Bell className="w-4.5 h-4.5" />
                {unresolvedAlerts.length > 0 && (
                  <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
                )}
              </button>

              {/* Alerts Dropdown Popover */}
              {showAlertsDropdown && (
                <div className={`absolute right-0 mt-3 w-80 sm:w-96 rounded-3xl shadow-2xl border p-4 z-50 animate-in fade-in slide-in-from-top-2 ${
                  darkMode ? 'bg-[#042d23] border-emerald-800 text-emerald-100' : 'bg-white border-slate-200 text-slate-800'
                }`}>
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-emerald-900/50">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span className="font-bold text-xs">Alertas Críticos ({unresolvedAlerts.length})</span>
                    </div>
                    <button 
                      onClick={() => { setShowAlertsDropdown(false); onNavigate('alerts'); }}
                      className="text-[11px] text-[#064E3B] dark:text-[#C5A059] font-bold hover:underline"
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

            {/* Dark Mode Toggle */}
            <button
              onClick={onToggleDarkMode}
              className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${
                darkMode
                  ? 'bg-emerald-900/40 border-emerald-800 text-amber-400 hover:bg-emerald-800/60'
                  : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
              }`}
              title={darkMode ? 'Modo Claro' : 'Modo Escuro'}
            >
              {darkMode ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            </button>

            {/* User Profile / Role Switcher Button */}
            <div className="relative">
              <button
                onClick={() => setShowRoleModal(!showRoleModal)}
                className={`flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full border transition-all ${
                  darkMode
                    ? 'bg-emerald-900/40 border-emerald-800 hover:border-[#C5A059]/50'
                    : 'bg-slate-100 border-slate-200 hover:bg-slate-200/70'
                }`}
              >
                <img
                  src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                  alt={currentUser.name}
                  className="w-7 h-7 rounded-full object-cover ring-2 ring-[#C5A059]/60"
                />
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-bold leading-none text-slate-800 dark:text-slate-100">{currentUser.name}</p>
                  <p className="text-[9px] font-bold text-[#064E3B] dark:text-[#C5A059] flex items-center gap-1 mt-0.5 uppercase tracking-wider">
                    {currentUser.role === 'ADMIN' ? 'Administrador' : 'Operador'}
                    <ChevronDown className="w-3 h-3 opacity-70" />
                  </p>
                </div>
              </button>

              {/* Role / User Switcher Popover */}
              {showRoleModal && (
                <div className={`absolute right-0 mt-3 w-72 rounded-3xl shadow-2xl border p-4 z-50 ${
                  darkMode ? 'bg-[#042d23] border-emerald-800 text-emerald-100' : 'bg-white border-slate-200 text-slate-800'
                }`}>
                  <div className="pb-2 mb-2 border-b border-slate-100 dark:border-emerald-900/40">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-emerald-300">
                      Alternar Perfil Ativo
                    </p>
                    <p className="text-[10px] text-slate-600 dark:text-emerald-200 font-medium">
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
                            ? 'bg-[#064E3B]/10 border border-[#064E3B]/30 text-[#064E3B] dark:text-[#C5A059] font-bold' 
                            : 'hover:bg-slate-100 dark:hover:bg-emerald-900/40 text-slate-700 dark:text-emerald-200'
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
                          <CheckCircle2 className="w-4 h-4 text-[#064E3B] dark:text-[#C5A059] shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-emerald-900/40 text-center">
                    <button
                      onClick={() => { setShowRoleModal(false); onNavigate('settings'); }}
                      className="text-[11px] text-[#064E3B] dark:text-[#C5A059] font-bold hover:underline flex items-center justify-center gap-1 w-full"
                    >
                      <UserIcon className="w-3.5 h-3.5" /> Configurações de Perfil
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>
      </div>
    </header>
  );
};
