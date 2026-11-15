import React from 'react';
import { Clock, UserRound, BriefcaseBusiness, Truck } from 'lucide-react';
import { FuelLog } from '../types';
import { formatCurrency, getEffectiveActivityName, getOperationTypeLabelOnly } from '../utils/calculations';

interface DailyFuelingDetailsProps {
  date: string;
  logs: FuelLog[];
  canViewFinancial: boolean;
}

export const DailyFuelingDetails: React.FC<DailyFuelingDetailsProps> = ({ date, logs, canViewFinancial }) => {
  const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
  const totalLiters = logs.reduce((total, log) => total + (Number(log.liters) || 0), 0);
  const totalSpent = canViewFinancial
    ? logs.reduce((total, log) => total + (Number(log.totalValue) || 0), 0)
    : null;

  return (
    <section className="mt-4 rounded-2xl border border-emerald-700/60 bg-[#031a14]/80 p-4 sm:p-5" aria-labelledby="daily-details-title">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FACC15]">Análise diária</p>
          <h3 id="daily-details-title" className="mt-1 text-base font-bold text-white">{dateLabel}</h3>
          <p className="mt-1 text-xs text-emerald-200/80">Indicadores abaixo representam somente este dia e respeitam os filtros ativos.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-lg border border-emerald-800 bg-emerald-950/80 px-3 py-2 font-semibold text-emerald-100">{logs.length} abastecimento(s)</span>
          <span className="rounded-lg border border-emerald-800 bg-emerald-950/80 px-3 py-2 font-semibold text-emerald-100">{totalLiters.toLocaleString('pt-BR')} L</span>
          {totalSpent !== null && <span className="rounded-lg border border-yellow-700/50 bg-yellow-950/30 px-3 py-2 font-bold text-[#FACC15]">{formatCurrency(totalSpent)}</span>}
        </div>
      </div>

      {logs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-emerald-800 p-4 text-sm text-emerald-200">Nenhum abastecimento encontrado para este dia com os filtros atuais.</p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Abastecimentos do dia">
          {logs.map(log => (
            <li key={log.id} className="grid grid-cols-1 gap-3 rounded-xl border border-emerald-900/70 bg-emerald-950/45 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-4">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <Truck className="size-4 shrink-0 text-[#FACC15]" aria-hidden="true" />
                  <p className="truncate text-sm font-bold text-white">{log.equipmentName}</p>
                  <span className="shrink-0 text-[11px] text-emerald-300">{log.equipmentPlateOrCode}</span>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs text-emerald-100/85 sm:grid-cols-2">
                  <span className="flex items-center gap-1.5"><UserRound className="size-3.5 shrink-0 text-emerald-300" aria-hidden="true" />{log.driverOrOperatorName || 'Operador não informado'}</span>
                  <span className="flex items-center gap-1.5"><Clock className="size-3.5 shrink-0 text-emerald-300" aria-hidden="true" />{new Date(log.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="flex items-center gap-1.5 sm:col-span-2"><BriefcaseBusiness className="size-3.5 shrink-0 text-emerald-300" aria-hidden="true" />{getEffectiveActivityName(log) && getEffectiveActivityName(log) !== '-' ? getEffectiveActivityName(log) : getOperationTypeLabelOnly(log.operationType || 'GRAMA')}</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-emerald-900/70 pt-2 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                <span className="text-sm font-extrabold text-[#FACC15]">{Number(log.liters || 0).toLocaleString('pt-BR')} L</span>
                {canViewFinancial && <span className="text-xs font-semibold text-emerald-100">{formatCurrency(Number(log.totalValue) || 0)}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
