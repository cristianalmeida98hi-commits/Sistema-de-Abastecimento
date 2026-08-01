import React, { useState } from 'react';
import { 
  Settings, Info, Shield, Clock, AlertTriangle, Building, 
  RotateCcw, CheckCircle2, Fuel, Sparkles, User as UserIcon 
} from 'lucide-react';
import { SystemSettings, User } from '../types';
import { resetSystemData } from '../utils/storage';

interface SettingsAndAboutViewProps {
  settings: SystemSettings;
  currentUser: User;
  onUpdateSettings: (newSettings: Partial<SystemSettings>) => void;
  darkMode: boolean;
}

export const SettingsAndAboutView: React.FC<SettingsAndAboutViewProps> = ({
  settings,
  currentUser,
  onUpdateSettings,
  darkMode
}) => {
  const [employeeEditTimeLimitHours, setEmployeeEditTimeLimitHours] = useState(settings.employeeEditTimeLimitHours);
  const [suspiciousFuelMarginPercentage, setSuspiciousFuelMarginPercentage] = useState(settings.suspiciousFuelMarginPercentage);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      employeeEditTimeLimitHours,
      suspiciousFuelMarginPercentage
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleReset = () => {
    if (confirm('Tem certeza que deseja restaurar o banco de dados inicial do AndradeAgro?')) {
      resetSystemData();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-emerald-100 flex items-center gap-2">
          <Settings className="w-6 h-6 text-amber-500" />
          Configurações do Sistema & Sobre
        </h1>
        <p className="text-xs text-gray-500 dark:text-emerald-400">
          Ajustes de regras operacionais, parâmetros de segurança e apresentação da empresa AndradeAgro.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Settings Form */}
        <div className={`lg:col-span-7 p-6 rounded-2xl border space-y-4 ${
          darkMode ? 'bg-emerald-950/40 border-emerald-900' : 'bg-white border-emerald-100 shadow-sm'
        }`}>
          <div className="flex items-center gap-2 font-bold text-sm text-gray-900 dark:text-emerald-100 border-b pb-3 border-emerald-800/20">
            <Shield className="w-4 h-4 text-amber-500" />
            <span>Regras Operacionais & Segurança (Admin)</span>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold mb-1 text-gray-700 dark:text-emerald-200">
                Janela de Edição Recente para Funcionários (Horas)
              </label>
              <input
                type="number"
                min="1"
                max="72"
                value={employeeEditTimeLimitHours}
                onChange={(e) => setEmployeeEditTimeLimitHours(parseInt(e.target.value) || 24)}
                className={`w-full p-2.5 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
              />
              <p className="text-[11px] text-gray-500 dark:text-emerald-400 mt-1">
                Funcionários só poderão editar registros criados por eles dentro deste número de horas.
              </p>
            </div>

            <div>
              <label className="block font-bold mb-1 text-gray-700 dark:text-emerald-200">
                Margem para Disparo de Alerta de Consumo Suspeito (%)
              </label>
              <input
                type="number"
                min="5"
                max="100"
                value={suspiciousFuelMarginPercentage}
                onChange={(e) => setSuspiciousFuelMarginPercentage(parseInt(e.target.value) || 25)}
                className={`w-full p-2.5 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
              />
              <p className="text-[11px] text-gray-500 dark:text-emerald-400 mt-1">
                Gera alerta automático se a média de consumo for X% pior que o histórico do equipamento.
              </p>
            </div>

            {savedSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Configurações atualizadas com sucesso!</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-xs flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Resetar Dados
              </button>

              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold text-xs shadow-md"
              >
                Salvar Configurações
              </button>
            </div>
          </form>
        </div>

        {/* Brand Presentation Card */}
        <div className={`lg:col-span-5 p-6 rounded-2xl border space-y-4 ${
          darkMode ? 'bg-gradient-to-br from-emerald-950 to-emerald-900 border-emerald-800 text-emerald-100' : 'bg-gradient-to-br from-emerald-900 to-emerald-950 text-white border-emerald-900 shadow-md'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-gray-950 flex items-center justify-center font-bold">
              <Fuel className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">AndradeAgro</h2>
              <p className="text-xs text-amber-400 font-semibold">{settings.slogan}</p>
            </div>
          </div>

          <div className="space-y-2 text-xs opacity-90 leading-relaxed border-t border-emerald-800/40 pt-3">
            <p>
              O <strong>AndradeAgro</strong> é a solução completa para gestão inteligente de abastecimentos, frotas, tratores e máquinas agrícolas do agronegócio moderno.
            </p>
            <p>
              Desenvolvido com tecnologia de alta performance para garantir previsibilidade de custos, eficiência energética na lavoura e rastreabilidade total de combustível.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-emerald-900/60 border border-emerald-700/40 text-[11px] space-y-1">
            <p><strong>CNPJ:</strong> {settings.cnpj}</p>
            <p><strong>Endereço:</strong> {settings.address}</p>
            <p><strong>Contato:</strong> {settings.contactEmail} • {settings.phone}</p>
            <p><strong>Versão:</strong> 2.4.0 (Agro-Engine Enterprise)</p>
          </div>
        </div>

      </div>

    </div>
  );
};
