import React from 'react';
import { 
  LayoutDashboard, Fuel, Truck, Wrench, Fuel as GasPump, Users, 
  FileSpreadsheet, AlertTriangle, ShieldCheck, Settings, ChevronRight,
  Sparkles, Leaf
} from 'lucide-react';
import { User, SmartAlert } from '../types';

interface SidebarProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  currentUser: User;
  alerts: SmartAlert[];
  darkMode: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onNavigate,
  currentUser,
  alerts = [],
  darkMode,
  collapsed,
  onToggleCollapse,
}) => {
  const unresolvedAlertsCount = (alerts || []).filter(a => !a.resolved).length;

  const navItems = currentUser.role === 'FUNCIONARIO' 
    ? [
        { id: 'operator-fueling', label: 'Lançamento de Campo', icon: Fuel, badge: 'Rápido' },
        { id: 'my-fuel-logs', label: 'Meus Lançamentos', icon: GasPump, badge: null }
      ]
    : [
        { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard, badge: null },
        { id: 'fuel-logs', label: 'Abastecimentos', icon: Fuel, badge: null },
        { id: 'fleet', label: 'Veículos & Máquinas', icon: Truck, badge: '160' },
        { id: 'maintenance', label: 'Manutenções', icon: Wrench, badge: null },
        { id: 'stations', label: 'Postos & Preços', icon: GasPump, badge: null },
        { id: 'staff', label: 'Equipe & Motoristas', icon: Users, badge: null },
        { id: 'reports', label: 'Relatórios', icon: FileSpreadsheet, badge: 'PDF' },
        { 
          id: 'alerts', 
          label: 'Alertas', 
          icon: AlertTriangle, 
          badge: unresolvedAlertsCount > 0 ? `${unresolvedAlertsCount}` : null,
          badgeColor: 'bg-[#FACC15] text-[#064E3B] font-bold'
        },
        { id: 'audit', label: 'Auditoria & Logs', icon: ShieldCheck, badge: null },
        { id: 'settings', label: 'Configurações', icon: Settings, badge: null },
      ];

  return (
    <aside className={`transition-all duration-300 ease-in-out flex flex-col shrink-0 shadow-xl z-20 ${
      collapsed ? 'w-20' : 'w-64'
    } ${
      darkMode 
        ? 'bg-[#043327] border-r border-emerald-900/40 text-slate-100' 
        : 'bg-[#064E3B] text-white'
    }`}>
      
      {/* Brand Header */}
      <div className="p-5 flex flex-col items-start gap-1 border-b border-white/10 relative">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('dashboard')}>
            <div className="w-9 h-9 bg-[#FACC15] rounded-xl flex items-center justify-center text-[#064E3B] shadow-md shrink-0">
              <Leaf className="w-5 h-5 fill-[#064E3B]" />
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-white font-bold text-lg tracking-tight truncate">Andrade<span className="text-[#FACC15]">Agro</span></span>
                <span className="text-[10px] text-[#FACC15] uppercase tracking-widest font-bold">Gestão Inteligente</span>
              </div>
            )}
          </div>
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            title={collapsed ? 'Expandir Menu' : 'Recolher Menu'}
          >
            <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${collapsed ? '' : 'rotate-180'}`} />
          </button>
        </div>
      </div>

      {/* Nav Items List */}
      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          if ((item as any).adminOnly && currentUser.role !== 'ADMIN') return null;

          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all font-semibold text-xs ${
                isActive
                  ? 'bg-white/20 text-white font-extrabold border-l-4 border-[#FACC15] shadow-inner'
                  : 'text-emerald-100/90 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-[#FACC15]' : 'text-emerald-100'}`} />
              
              {!collapsed && (
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      item.badgeColor || 'bg-white/20 text-[#FACC15] border border-white/20'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Profile Footer */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#FACC15] rounded-full overflow-hidden border-2 border-white/30 shrink-0 flex items-center justify-center font-bold text-[#064E3B] text-xs">
            {currentUser.avatar ? (
              <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
            ) : (
              currentUser.name.split(' ').map(n => n[0]).slice(0, 2).join('')
            )}
          </div>
          {!collapsed && (
            <div className="overflow-hidden min-w-0">
              <p className="text-white text-xs font-bold truncate">{currentUser.name}</p>
              <p className="text-[#FACC15] text-[10px] uppercase tracking-wider font-extrabold">
                {currentUser.role === 'ADMIN' ? 'Administrador' : 'Operador'}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

