import React from 'react';
import { ShieldCheck, Clock, User as UserIcon, FileText } from 'lucide-react';
import { AuditLog } from '../types';
import { formatDateTimeBR } from '../utils/calculations';

interface AuditLogsViewProps {
  auditLogs: AuditLog[];
  darkMode?: boolean;
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({
  auditLogs
}) => {
  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-emerald-100 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-emerald-400" />
          Logs de Auditoria & Segurança
        </h1>
        <p className="text-xs text-emerald-400">
          Registro completo de todas as ações de criação, edição, exclusão e login no AndradeAgro.
        </p>
      </div>

      <div className="rounded-2xl border overflow-hidden bg-emerald-950/40 border-emerald-900">
        <div className="p-4 border-b border-emerald-800/40 font-bold text-xs text-emerald-200">
          Histórico Sequencial do Sistema
        </div>

        <div className="divide-y divide-emerald-900/30">
          {auditLogs.map(log => (
            <div key={log.id} className="p-3.5 flex items-start gap-3 text-xs hover:bg-emerald-500/5 transition-colors">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold shrink-0">
                {log.action}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-gray-900 dark:text-emerald-100">{log.userName}</span>
                  <span className="text-[10px] text-gray-500 dark:text-emerald-400 font-medium">{formatDateTimeBR(log.dateTime)}</span>
                </div>
                <p className="text-gray-600 dark:text-emerald-300/90 mt-0.5">{log.details}</p>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold block mt-1">
                  Módulo: {log.entity}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
