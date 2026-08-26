import React, { useState, useMemo } from 'react';
import { FuelLog, User, Vehicle, GasStation, OperationType, ActivityType } from '../types';
import { Fuel, CheckCircle2, Clock, Truck, Plus, Sparkles, Send, Shield, History, MapPin, AlertTriangle, ChevronRight } from 'lucide-react';
import { getTankStatus } from '../utils/storage';
import { 
  getActivitiesForOperation, 
  OPERATION_OPTIONS, 
  getOperationTypeName, 
  getActivityTypeName 
} from '../utils/operations';
import { VehicleSelector } from './VehicleSelector';

interface OperatorFuelingViewProps {
  currentUser: User;
  vehicles: Vehicle[];
  gasStations: GasStation[];
  onAddFuelLog: (log: Omit<FuelLog, 'id' | 'createdAt'>) => void;
  userLogs: FuelLog[];
  darkMode: boolean;
}

export const OperatorFuelingView: React.FC<OperatorFuelingViewProps> = ({
  currentUser,
  vehicles,
  gasStations,
  onAddFuelLog,
  userLogs = [],
  darkMode
}) => {
  const tankStatus = useMemo(() => getTankStatus(), []);
  const isTankLow = tankStatus.currentStock <= 2000;

  const fuelableVehicles = React.useMemo(
    () => vehicles.filter(v => v.fuelType !== 'NENHUM'),
    [vehicles]
  );
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(fuelableVehicles[0]?.id || '');
  const [operationType, setOperationType] = useState<OperationType>('GRAMA');
  const [activityType, setActivityType] = useState<ActivityType>('CORTE');

  const availableActivities = useMemo(() => {
    return getActivitiesForOperation(operationType);
  }, [operationType]);

  const handleSelectOperation = (opId: OperationType) => {
    setOperationType(opId);
    const acts = getActivitiesForOperation(opId);
    setActivityType((acts[0]?.id || 'OUTRAS') as ActivityType);
  };

  const [liters, setLiters] = useState<string>('80');
  const [hourmeter, setHourmeter] = useState<string>('');
  const [odometer, setOdometer] = useState<string>('');
  const [observations, setObservations] = useState<string>('');
  const [selectedGasStationId, setSelectedGasStationId] = useState<string>(
    gasStations.find(s => s.type === 'INTERNO')?.id || gasStations[0]?.id || ''
  );
  
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [lastSavedLog, setLastSavedLog] = useState<Partial<FuelLog> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeVehicle = vehicles.find(v => v.id === selectedVehicleId);
  const isVehicleKm = activeVehicle?.category === 'VEICULO';

  // Auto set default hourmeter / km when vehicle changes
  React.useEffect(() => {
    if (activeVehicle) {
      if (activeVehicle.currentHourmeter) {
        setHourmeter(String(activeVehicle.currentHourmeter));
      } else {
        setHourmeter('');
      }
      if (activeVehicle.currentKm) {
        setOdometer(String(activeVehicle.currentKm));
      } else {
        setOdometer('');
      }
    }
  }, [selectedVehicleId, activeVehicle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedVehicleId || !liters || Number(liters) <= 0) {
      alert('Por favor, selecione o veículo e informe uma quantidade de litros válida.');
      return;
    }

    if (!activeVehicle) {
      alert('Por favor, selecione uma máquina/veículo válida.');
      return;
    }

    if (!operationType) {
      alert('Por favor, selecione o Tipo de Operação.');
      return;
    }

    if (operationType && !activityType) {
      alert('Por favor, selecione a Atividade correspondente.');
      return;
    }

    setIsSubmitting(true);

    try {
      const station = gasStations.find(g => g.id === selectedGasStationId) || gasStations[0];
      const litersNum = Number(liters);
      const fuelType = activeVehicle?.fuelType || 'DIESEL_S10';
      const pricePerLiter = station?.pricePerLiter?.[fuelType] || 5.80;
      const totalValue = litersNum * pricePerLiter;
      const nowIso = new Date().toISOString();

      const newLogData: Omit<FuelLog, 'id' | 'createdAt'> = {
        dateTime: nowIso,
        equipmentId: activeVehicle.id,
        equipmentName: activeVehicle.model || 'Equipamento Agrícola',
        equipmentCategory: activeVehicle.category || 'TRATOR',
        equipmentPlateOrCode: activeVehicle.licensePlate || activeVehicle.patrimonyCode || 'AGRO-000',
        driverOrOperatorId: currentUser.id,
        driverOrOperatorName: currentUser.name,
        attendantId: currentUser.id,
        attendantName: currentUser.name,
        gasStationId: station?.id || 'stn-001',
        gasStationName: station?.name || 'Posto Interno Fazenda Andrade',
        fuelType,
        liters: litersNum,
        pricePerLiter,
        totalValue,
        operationType,
        activityType,
        hourmeterAtFueling: isVehicleKm ? undefined : (Number(hourmeter) || undefined),
        kmAtFueling: isVehicleKm ? (Number(odometer) || undefined) : undefined,
        observations: observations.trim() || undefined,
        createdById: currentUser.id,
        createdByName: currentUser.name,
      };

      await onAddFuelLog(newLogData);

      setLastSavedLog({
        equipmentName: activeVehicle?.model,
        liters: litersNum,
        operationType,
        activityType,
        dateTime: nowIso
      });

      setShowSuccessToast(true);

      // Reset fields for next quick entry
      setObservations('');
      setTimeout(() => {
        setShowSuccessToast(false);
      }, 5000);
    } catch (err: any) {
      console.error('Erro ao salvar abastecimento:', err);
      alert(`Erro ao salvar abastecimento: ${err?.message || 'Ocorreu uma falha na conexão com o Firestore.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const myLogs = userLogs.filter(
    l => l.driverOrOperatorId === currentUser.id || l.createdById === currentUser.id
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      
      {/* Mobile Top Welcome & Profile Card */}
      <div className={`p-5 rounded-3xl border shadow-sm ${
        darkMode ? 'bg-[#042d23] border-emerald-900/80 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#064E3B] rounded-2xl flex items-center justify-center text-[#FACC15] font-extrabold text-lg shadow-sm">
              {currentUser.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#064E3B] text-[#FACC15] border border-[#FACC15]/30">
                  Operador de Campo
                </span>
                <span className="text-xs text-slate-500 dark:text-emerald-300 font-medium">AndradeAgro</span>
              </div>
              <h1 className="text-lg font-black text-slate-900 dark:text-slate-100 mt-0.5">
                {currentUser.name}
              </h1>
            </div>
          </div>

          <div className="text-right hidden sm:block">
            <p className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 dark:text-emerald-300">
              Sessão Ativa
            </p>
            <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1 justify-end">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Conectado
            </p>
          </div>
        </div>
      </div>

      {/* Success Notification Toast */}
      {showSuccessToast && lastSavedLog && (
        <div className="p-4 rounded-2xl bg-emerald-700 text-white shadow-xl border-2 border-[#FACC15] flex items-center justify-between animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6 text-[#FACC15]" />
            </div>
            <div>
              <p className="font-extrabold text-sm text-white">Abastecimento Registrado!</p>
              <p className="text-xs text-emerald-100">
                {lastSavedLog.liters}L no {lastSavedLog.equipmentName} ({lastSavedLog.operationType})
              </p>
            </div>
          </div>
          <button 
            onClick={() => setShowSuccessToast(false)}
            className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-xl font-bold"
          >
            OK
          </button>
        </div>
      )}

      {/* Main Field Form Card */}
      <form onSubmit={handleSubmit} className={`p-6 rounded-3xl border shadow-lg space-y-5 ${
        darkMode ? 'bg-[#042d23] border-emerald-900/80 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Low Fuel Warning Banner (Sede Fazenda <= 2000L) */}
        {isTankLow && (
          <div className="p-4 rounded-2xl bg-amber-500/20 border-2 border-[#FACC15] text-white flex items-center gap-3 text-xs shadow-md">
            <div className="w-9 h-9 rounded-xl bg-[#FACC15] text-[#064E3B] flex items-center justify-center font-black shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-0.5">
              <span className="font-extrabold uppercase text-[#FACC15] block text-xs">
                ⚠️ Combustível baixo
              </span>
              <p className="text-xs text-slate-100 font-medium leading-snug">
                O tanque da Sede Fazenda está com <strong>{Math.round(tankStatus.currentStock).toLocaleString('pt-BR')} L</strong>. O nível está abaixo do limite de 2.000 L.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-b border-slate-100 dark:border-emerald-900/60 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#064E3B] flex items-center justify-center text-[#FACC15]">
              <Fuel className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-slate-100">Lançamento de Abastecimento</h2>
              <p className="text-xs text-slate-600 dark:text-emerald-300 font-medium">Preencha os dados do abastecimento de campo</p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-700 dark:text-emerald-200 bg-slate-100 dark:bg-emerald-950 px-2.5 py-1 rounded-full border border-slate-200 dark:border-emerald-900">
              {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* 1. Funcionário (Auto Filled) */}
        <div>
          <label className="block text-xs font-extrabold text-slate-700 dark:text-emerald-200 uppercase tracking-wider mb-1">
            Funcionário Operador
          </label>
          <input
            type="text"
            readOnly
            value={`${currentUser.name} (${currentUser.department || 'Operações'})`}
            className={`w-full px-4 py-3 text-xs font-bold rounded-2xl border outline-none cursor-not-allowed ${
              darkMode ? 'bg-emerald-950/80 border-emerald-900 text-emerald-200' : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}
          />
        </div>

        {/* 2. Máquina ou Veículo Selecionado */}
        <div>
          <VehicleSelector
            vehicles={fuelableVehicles}
            selectedVehicleId={selectedVehicleId}
            onSelect={(id) => setSelectedVehicleId(id)}
            darkMode={darkMode}
            label="Máquina ou Veículo Utilizado *"
          />
        </div>

        {/* 3. Tipo de Operação (Etapa 1) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-extrabold text-slate-800 dark:text-emerald-200 uppercase tracking-wider">
              Tipo de Operação *
            </label>
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
              Etapa 1 de 2
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {OPERATION_OPTIONS.map((op) => (
              <button
                key={op.id}
                type="button"
                onClick={() => handleSelectOperation(op.id)}
                className={`py-3 px-3 rounded-2xl text-xs font-extrabold border transition-all text-center flex items-center justify-center gap-1.5 ${
                  operationType === op.id
                    ? 'bg-[#064E3B] text-white border-[#064E3B] shadow-sm ring-2 ring-[#FACC15]'
                    : darkMode
                    ? 'bg-emerald-950/60 text-slate-200 border-emerald-900 hover:bg-emerald-900/60'
                    : 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200/80'
                }`}
              >
                <span>{op.emoji}</span>
                <span>{op.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 4. Atividade (Etapa 2 - Dinâmica baseada na Operação) */}
        {operationType && (
          <div className="animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-extrabold text-slate-800 dark:text-emerald-200 uppercase tracking-wider">
                Atividade *
              </label>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-emerald-300">
                Opções para {getOperationTypeName(operationType)}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {availableActivities.map((act) => (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => setActivityType(act.id as ActivityType)}
                  className={`py-2.5 px-3 rounded-2xl text-xs font-extrabold border transition-all text-center truncate ${
                    activityType === act.id
                      ? 'bg-[#064E3B] text-white border-[#064E3B] ring-2 ring-[#FACC15]'
                      : darkMode
                      ? 'bg-emerald-950/60 text-slate-200 border-emerald-900 hover:bg-emerald-900/60'
                      : 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200/80'
                  }`}
                  title={act.label}
                >
                  {act.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 5. Quantidade de Litros & Horímetro/KM */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          
          <div>
            <label className="block text-xs font-extrabold text-slate-800 dark:text-emerald-200 uppercase tracking-wider mb-1">
              Quantidade de Litros *
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="1"
                value={liters}
                onChange={(e) => setLiters(e.target.value)}
                required
                placeholder="Ex: 80"
                className={`w-full pl-4 pr-12 py-3.5 text-base font-black rounded-2xl border outline-none ${
                  darkMode 
                    ? 'bg-emerald-950 border-emerald-800 text-slate-100 focus:ring-2 focus:ring-[#FACC15]' 
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#064E3B]'
                }`}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 dark:text-emerald-300">
                LITROS
              </span>
            </div>

            {/* Quick Liters Add Buttons */}
            <div className="flex gap-1.5 mt-2">
              {[20, 50, 80, 150, 300].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setLiters(String(val))}
                  className="flex-1 py-1 text-[10px] font-bold bg-slate-100 dark:bg-emerald-950 hover:bg-slate-200 text-slate-800 dark:text-emerald-200 rounded-lg border border-slate-200 dark:border-emerald-800 transition-colors"
                >
                  +{val}L
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold text-slate-800 dark:text-emerald-200 uppercase tracking-wider mb-1">
              {isVehicleKm ? 'Quilometragem (KM) *' : 'Horímetro Atual (Horas) *'}
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                value={isVehicleKm ? odometer : hourmeter}
                onChange={(e) => isVehicleKm ? setOdometer(e.target.value) : setHourmeter(e.target.value)}
                placeholder={isVehicleKm ? 'Ex: 68100' : 'Ex: 1520'}
                className={`w-full pl-4 pr-12 py-3.5 text-base font-black rounded-2xl border outline-none ${
                  darkMode 
                    ? 'bg-emerald-950 border-emerald-800 text-slate-100 focus:ring-2 focus:ring-[#FACC15]' 
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#064E3B]'
                }`}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 dark:text-emerald-300">
                {isVehicleKm ? 'KM' : 'HORAS'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-emerald-300/80 mt-1 font-medium">
              {isVehicleKm ? 'Marcador no painel do veículo' : 'Horímetro registrado na máquina'}
            </p>
          </div>

        </div>

        {/* 6. Posto de Abastecimento (Default Interno) */}
        <div>
          <label className="block text-xs font-extrabold text-slate-800 dark:text-emerald-200 uppercase tracking-wider mb-1">
            Posto / Ponto de Abastecimento
          </label>
          <select
            value={selectedGasStationId}
            onChange={(e) => setSelectedGasStationId(e.target.value)}
            className={`w-full px-4 py-3 text-xs font-bold rounded-2xl border outline-none ${
              darkMode 
                ? 'bg-emerald-950 border-emerald-800 text-slate-100' 
                : 'bg-slate-50 border-slate-300 text-slate-900'
            }`}
          >
            {gasStations.map((stn) => (
              <option key={stn.id} value={stn.id}>
                {stn.name} ({stn.type})
              </option>
            ))}
          </select>
        </div>

        {/* 7. Observações / Atividade Personalizada */}
        <div>
          <label className="block text-xs font-extrabold text-slate-800 dark:text-emerald-200 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>
              {activityType === 'OUTRAS' || operationType === 'OUTROS'
                ? '⭐ Atividade Personalizada / Observação'
                : 'Observação (Opcional)'}
            </span>
            {(activityType === 'OUTRAS' || operationType === 'OUTROS') && (
              <span className="text-[10px] text-amber-600 dark:text-[#FACC15] font-bold">
                Aparecerá nos gráficos de consumo por atividade
              </span>
            )}
          </label>
          <textarea
            rows={2}
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder={
              activityType === 'OUTRAS' || operationType === 'OUTROS'
                ? 'Descreva a atividade específica (Ex: Poda especial de cerca, Manutenção de drenos, etc.)'
                : 'Ex: Abastecimento em talhão 04, troca de óleo verificada...'
            }
            className={`w-full px-4 py-3 text-xs font-medium rounded-2xl border outline-none ${
              darkMode 
                ? 'bg-emerald-950 border-emerald-800 text-slate-100 placeholder-emerald-400/60' 
                : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
            }`}
          />
        </div>

        {/* Auto Data e Hora Notice */}
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 rounded-2xl border border-emerald-200/80 dark:border-emerald-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#064E3B] dark:text-[#FACC15]" />
            <span className="text-xs font-bold text-slate-800 dark:text-emerald-200">
              Data e Hora do Registro:
            </span>
          </div>
          <span className="text-xs font-extrabold text-[#064E3B] dark:text-[#FACC15]">
            {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Main Big Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-4 bg-[#064E3B] hover:bg-[#043327] text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-900/20 flex items-center justify-center gap-2 transition-all active:scale-98 border-2 border-[#FACC15] ${
            isSubmitting ? 'opacity-70 cursor-wait' : ''
          }`}
        >
          {isSubmitting ? (
            <>
              <Clock className="w-5 h-5 text-[#FACC15] animate-spin" />
              <span>Salvando no Firestore...</span>
            </>
          ) : (
            <>
              <Send className="w-5 h-5 text-[#FACC15]" />
              <span>Salvar Abastecimento</span>
            </>
          )}
        </button>

      </form>

      {/* Operator Recent Logs History */}
      <div className={`p-6 rounded-3xl border shadow-sm ${
        darkMode ? 'bg-[#042d23] border-emerald-900/80 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#064E3B] dark:text-[#FACC15]" />
            <h3 className="font-black text-sm text-slate-900 dark:text-slate-100">
              Meus Lançamentos Recentes ({myLogs.length})
            </h3>
          </div>
        </div>

        <div className="space-y-3">
          {myLogs.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-emerald-300 italic text-center py-4">
              Nenhum abastecimento registrado por você até o momento.
            </p>
          ) : (
            myLogs.slice(0, 5).map((log) => (
              <div
                key={log.id}
                className="p-3.5 bg-slate-100 dark:bg-emerald-950/60 rounded-2xl border border-slate-200 dark:border-emerald-900/40 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-[#064E3B] text-[#FACC15] rounded-xl flex items-center justify-center shrink-0 font-extrabold text-sm">
                    {log.liters}L
                  </div>
                  <div className="min-w-0">
                    <p className="font-extrabold text-xs text-slate-900 dark:text-slate-100 truncate">
                      {log.equipmentName}
                    </p>
                    <p className="text-[11px] text-slate-700 dark:text-emerald-200 font-bold mt-0.5">
                      Operação: <span className="text-[#064E3B] dark:text-[#FACC15]">{log.operationType || 'Grama'}</span> ({log.activityType || 'Corte'})
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] font-bold text-slate-600 dark:text-emerald-300 block">
                    {new Date(log.dateTime).toLocaleDateString('pt-BR')}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-emerald-300/80 block">
                    {new Date(log.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};
