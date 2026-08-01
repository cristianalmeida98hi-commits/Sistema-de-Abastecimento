import React from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert, Clock, Fuel, FileText, Wrench } from 'lucide-react';
import { SmartAlert, User } from '../types';
import { formatDateBR } from '../utils/calculations';

interface AlertsViewProps {
  alerts: SmartAlert[];
  currentUser: User;
  onResolveAlert: (id: string) => void;
  darkMode: boolean;
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  alerts,
  currentUser,
  onResolveAlert,
  darkMode
}) => {
  const unresolvedAlerts = alerts.filter(a => !a.resolved);
  const resolvedAlerts = alerts.filter(a => a.resolved);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-emerald-100 flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-amber-500" />
          Central de Alertas Inteligentes
        </h1>
        <p className="text-xs text-gray-500 dark:text-emerald-400">
          Identificação automática de consumo suspeito, revisões preventivas pendentes e vencimento de documentações.
        </p>
      </div>

      {/* Unresolved Alerts List */}
      <div className="space-y-3">
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
          Alertas Pendentes ({unresolvedAlerts.length})
        </h2>

        {unresolvedAlerts.length === 0 ? (
          <div className={`p-8 text-center rounded-2xl border ${
            darkMode ? 'bg-emerald-950/40 border-emerald-900' : 'bg-white border-emerald-100'
          }`}>
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="font-bold text-sm text-gray-800 dark:text-emerald-200">Nenhum alerta pendente!</p>
            <p className="text-xs text-gray-500 dark:text-emerald-400 mt-0.5">Tudo operando dentro das margens de segurança na fazenda.</p>
          </div>
        ) : (
          unresolvedAlerts.map(alert => (
            <div
              key={alert.id}
              className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                alert.severity === 'ALTA'
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-200'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-500 text-gray-950 font-bold shrink-0 mt-0.5">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-xs uppercase">{alert.title}</span>
                    <span className="text-[10px] px-2 py-0.2 rounded-full font-bold bg-amber-500/20">
                      Gravidade {alert.severity}
                    </span>
                  </div>
                  <p className="text-xs mt-1 leading-relaxed">{alert.description}</p>
                  <p className="text-[10px] opacity-75 mt-1">Data do Alerta: {formatDateBR(alert.date)}</p>
                </div>
              </div>

              <button
                onClick={() => onResolveAlert(alert.id)}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold text-xs shrink-0 flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Resolver Alerta</span>
              </button>
            </div>
          ))
        )}
      </div>

      {/* Resolved Alerts History */}
      {resolvedAlerts.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-emerald-800/20">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-emerald-400">
            Histórico de Alertas Resolvidos ({resolvedAlerts.length})
          </h2>

          <div className="space-y-2 opacity-75">
            {resolvedAlerts.map(alert => (
              <div
                key={alert.id}
                className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                  darkMode ? 'bg-emerald-950/30 border-emerald-900' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div>
                  <span className="font-bold">{alert.title}</span>
                  <p className="text-[11px] opacity-80">{alert.description}</p>
                </div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                  Resolvido por: {alert.resolvedBy || 'Sistema'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
