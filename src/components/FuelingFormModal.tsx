import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Fuel, Calendar, Clock, Truck, User as UserIcon, 
  AlertTriangle, CheckCircle2, Droplet, Sparkles 
} from 'lucide-react';
import { Vehicle, GasStation, User, FuelType, FuelLog, SystemSettings, OperationType, ActivityType } from '../types';
import { 
  calculateFuelLogMetrics, formatCurrency, getFuelTypeName, getSectorName 
} from '../utils/calculations';
import { getTankStatus } from '../utils/storage';

interface FuelingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (log: Omit<FuelLog, 'id' | 'createdAt'>) => void;
  vehicles: Vehicle[];
  gasStations: GasStation[];
  users: User[];
  currentUser: User;
  previousLogs: FuelLog[];
  settings: SystemSettings;
  preSelectedVehicleId?: string;
  darkMode: boolean;
}

export const FuelingFormModalComponent: React.FC<FuelingFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  vehicles,
  gasStations,
  users,
  currentUser,
  previousLogs,
  settings,
  preSelectedVehicleId,
  darkMode
}) => {
  if (!isOpen) return null;

  // Tank Stock Status for Problem 5
  const tankStatus = useMemo(() => getTankStatus(), [isOpen]);
  const isTankLow = tankStatus.currentStock <= 2000;

  // Filter fuelable vehicles
  const fuelableVehicles = useMemo(
    () => vehicles.filter(v => v.fuelType !== 'NENHUM'),
    [vehicles]
  );

  // Form states
  const [dateTime, setDateTime] = useState<string>(
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  );

  const [equipmentId, setEquipmentId] = useState<string>(() => {
    if (preSelectedVehicleId && fuelableVehicles.some(v => v.id === preSelectedVehicleId)) {
      return preSelectedVehicleId;
    }
    return fuelableVehicles[0]?.id || '';
  });

  const selectedEquipment = vehicles.find(v => v.id === equipmentId);

  const [driverOrOperatorId, setDriverOrOperatorId] = useState<string>(
    selectedEquipment?.assignedOperatorId || currentUser?.id || users[0]?.id || ''
  );

  const [gasStationId, setGasStationId] = useState<string>(
    gasStations.find(s => s.type === 'INTERNO')?.id || gasStations[0]?.id || ''
  );

  const selectedStation = gasStations.find(s => s.id === gasStationId) || gasStations[0];

  const [fuelType, setFuelType] = useState<FuelType>(
    selectedEquipment?.fuelType || 'DIESEL_S10'
  );

  const [liters, setLiters] = useState<number | string>(50);

  const pricePerLiter = selectedStation?.pricePerLiter?.[fuelType] || 5.79;

  const isKmBased = selectedEquipment?.category === 'VEICULO';
  const initialCurrentKmOrHour = isKmBased 
    ? (selectedEquipment?.currentKm || 0) + 150 
    : (selectedEquipment?.currentHourmeter || 0) + 10;

  const [currentKmOrHour, setCurrentKmOrHour] = useState<number | string>(initialCurrentKmOrHour);
  const [operationType, setOperationType] = useState<OperationType>('GRAMA');
  const [activityType, setActivityType] = useState<ActivityType>('CORTE');
  const [observations, setObservations] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);
  const [savedLiters, setSavedLiters] = useState<number>(0);

  // Auto-sync when equipment changes
  useEffect(() => {
    if (selectedEquipment) {
      setFuelType(selectedEquipment.fuelType || 'DIESEL_S10');
      if (selectedEquipment.assignedOperatorId) {
        setDriverOrOperatorId(selectedEquipment.assignedOperatorId);
      }
      const nextMeter = isKmBased 
        ? (selectedEquipment.currentKm || 0) + 100 
        : (selectedEquipment.currentHourmeter || 0) + 8;
      setCurrentKmOrHour(nextMeter);
    }
  }, [equipmentId]);

  const numLiters = Number(liters) || 0;
  const numKmOrHour = Number(currentKmOrHour) || 0;

  // Calculate metrics
  const metrics = selectedEquipment ? calculateFuelLogMetrics(
    numLiters,
    pricePerLiter,
    selectedEquipment,
    numKmOrHour,
    previousLogs.filter(l => l.equipmentId === equipmentId),
    settings.suspiciousFuelMarginPercentage
  ) : {
    totalValue: numLiters * pricePerLiter,
    flaggedSuspicious: false
  };

  const selectedDriver = users.find(u => u.id === driverOrOperatorId) || currentUser;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEquipment || !selectedStation || numLiters <= 0) {
      alert('Por favor, selecione o equipamento e informe a quantidade de litros abastecidos.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        dateTime,
        equipmentId: selectedEquipment.id,
        equipmentName: selectedEquipment.model,
        equipmentCategory: selectedEquipment.category,
        equipmentPlateOrCode: selectedEquipment.licensePlate || selectedEquipment.patrimonyCode || 'S/PLACA',
        driverOrOperatorId: selectedDriver?.id || currentUser.id,
        driverOrOperatorName: selectedDriver?.name || currentUser.name,
        attendantId: currentUser.id,
        attendantName: currentUser.name,
        gasStationId: selectedStation.id,
        gasStationName: selectedStation.name,
        fuelType,
        liters: numLiters,
        pricePerLiter,
        totalValue: metrics.totalValue,
        operationType,
        activityType,
        kmAtFueling: isKmBased ? numKmOrHour : undefined,
        hourmeterAtFueling: !isKmBased ? numKmOrHour : undefined,
        previousKmOrHour: metrics.previousKmOrHour,
        calculatedAverageKmPerLiter: metrics.calculatedAverageKmPerLiter,
        calculatedAverageLitersPerHour: metrics.calculatedAverageLitersPerHour,
        costPerKm: metrics.costPerKm,
        costPerHour: metrics.costPerHour,
        estimatedAutonomyKmOrHours: metrics.estimatedAutonomyKmOrHours,
        observations: observations.trim() || undefined,
        flaggedSuspicious: metrics.flaggedSuspicious,
        suspiciousReason: metrics.suspiciousReason,
        createdById: currentUser.id,
        createdByName: currentUser.name
      });

      setSavedLiters(numLiters);
      setIsSavedSuccess(true);

      setTimeout(() => {
        setIsSavedSuccess(false);
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error('Erro ao salvar abastecimento:', err);
      alert(`Erro ao salvar abastecimento: ${err?.message || 'Falha de comunicação.'}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className={`w-full max-w-xl rounded-3xl shadow-2xl border flex flex-col overflow-hidden ${
        darkMode ? 'bg-emerald-950 border-emerald-800 text-emerald-50' : 'bg-white border-emerald-100 text-gray-900'
      }`}>
        
        {/* Header */}
        <div className="p-4 border-b border-emerald-800/20 bg-gradient-to-r from-emerald-900 to-emerald-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500 text-gray-950 flex items-center justify-center font-bold shrink-0">
              <Fuel className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold">Novo Registro de Abastecimento</h2>
              <p className="text-[11px] text-emerald-200">AndradeAgro • Registro Rápido e Direto</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-emerald-800/80 hover:bg-emerald-700 text-emerald-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Confirmation Modal Overlay (Problem 4) */}
        {isSavedSuccess ? (
          <div className="p-8 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-900/30 animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-emerald-400">
                ✅ Abastecimento salvo com sucesso!
              </h3>
              <p className="text-xs text-emerald-200">
                Foram registrados <strong>{savedLiters} Litros</strong> para {selectedEquipment?.model} ({selectedEquipment?.licensePlate || selectedEquipment?.patrimonyCode}).
              </p>
            </div>
            <div className="inline-block px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-xs">
              Atualizando estoque e fechando...
            </div>
          </div>
        ) : (
          /* Simplified Form Body (Problem 3) */
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 max-h-[80vh]">
            
            {/* Low Fuel Warning Banner (Problem 5: <= 2000L) */}
            {isTankLow && (
              <div className="p-3.5 rounded-2xl bg-amber-500/20 border-2 border-amber-500/60 text-amber-900 dark:text-amber-200 flex items-center gap-3 text-xs shadow-md animate-pulse">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-gray-950 flex items-center justify-center font-black shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <span className="font-extrabold uppercase text-amber-800 dark:text-amber-300 block text-[11px]">
                    ⚠️ Combustível acabando!
                  </span>
                  <p className="text-[11px] font-medium leading-snug">
                    Estoque disponível no Tanque Central: <strong>{tankStatus.currentStock.toLocaleString('pt-BR')}L</strong> (limite de alerta: 2.000L).
                  </p>
                </div>
              </div>
            )}

            {/* Vehicle Selection */}
            <div>
              <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-emerald-200">
                Veículo / Trator / Máquina *
              </label>
              <select
                value={equipmentId}
                onChange={(e) => setEquipmentId(e.target.value)}
                required
                className={`w-full px-3 py-2.5 rounded-xl border text-xs font-bold outline-none ${
                  darkMode ? 'bg-emerald-900/40 border-emerald-800 text-amber-400' : 'bg-gray-50 border-gray-200 text-emerald-800'
                }`}
              >
                {fuelableVehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    [{v.category === 'VEICULO' ? 'VEÍCULO' : 'MÁQUINA'}] {v.model} - {v.licensePlate || v.patrimonyCode}
                  </option>
                ))}
              </select>
            </div>

            {/* Liters & Meter Row */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-emerald-200 mb-1">
                  Litros Abastecidos *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  required
                  placeholder="Ex: 50"
                  value={liters}
                  onChange={(e) => setLiters(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-sm font-black outline-none ${
                    darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-gray-200 text-gray-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-emerald-200 mb-1">
                  {isKmBased ? 'Quilometragem (KM) *' : 'Horímetro Atual (h) *'}
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  required
                  value={currentKmOrHour}
                  onChange={(e) => setCurrentKmOrHour(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-sm font-black outline-none ${
                    darkMode ? 'bg-emerald-950 border-emerald-800 text-amber-400' : 'bg-white border-gray-200 text-emerald-800'
                  }`}
                />
              </div>
            </div>

            {/* Date, Fuel Type, Station */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold mb-1 text-gray-700 dark:text-emerald-200">
                  Data e Hora *
                </label>
                <input
                  type="datetime-local"
                  value={dateTime}
                  onChange={(e) => setDateTime(e.target.value)}
                  required
                  className={`w-full px-3 py-2 rounded-xl border text-xs outline-none ${
                    darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 border-gray-200'
                  }`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold mb-1 text-gray-700 dark:text-emerald-200">
                  Tipo de Combustível *
                </label>
                <select
                  value={fuelType}
                  onChange={(e) => setFuelType(e.target.value as FuelType)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-bold outline-none ${
                    darkMode ? 'bg-emerald-900/40 border-emerald-800 text-amber-400' : 'bg-gray-50 border-gray-200 text-emerald-800'
                  }`}
                >
                  <option value="DIESEL_S10">Diesel S10</option>
                  <option value="DIESEL_S500">Diesel S500</option>
                  <option value="GASOLINA_COMUM">Gasolina Comum</option>
                  <option value="GASOLINA_GRID">Gasolina Aditivada</option>
                  <option value="ETANOL">Etanol Hidratado</option>
                  <option value="ARLA_32">Arla 32</option>
                </select>
              </div>
            </div>

            {/* Driver & Station */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold mb-1 text-gray-700 dark:text-emerald-200">
                  Motorista / Operador
                </label>
                <select
                  value={driverOrOperatorId}
                  onChange={(e) => setDriverOrOperatorId(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs outline-none ${
                    darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.department || u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold mb-1 text-gray-700 dark:text-emerald-200">
                  Local / Posto de Saída
                </label>
                <select
                  value={gasStationId}
                  onChange={(e) => setGasStationId(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs outline-none ${
                    darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  {gasStations.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.type})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Operation Type & Activity */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold mb-1 text-gray-700 dark:text-emerald-200">
                  Tipo de Operação
                </label>
                <select
                  value={operationType}
                  onChange={(e) => setOperationType(e.target.value as OperationType)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs outline-none font-bold ${
                    darkMode ? 'bg-emerald-950 border-emerald-800 text-slate-100' : 'bg-slate-50 border-slate-300'
                  }`}
                >
                  <option value="GRAMA">🌱 Grama</option>
                  <option value="COLHEITA">🌾 Colheita</option>
                  <option value="PLANTIO">🚜 Plantio</option>
                  <option value="TRANSPORTE">🚚 Transporte</option>
                  <option value="OUTROS">🔧 Outros</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold mb-1 text-gray-700 dark:text-emerald-200">
                  Atividade Específica
                </label>
                <select
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value as ActivityType)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs outline-none font-bold ${
                    darkMode ? 'bg-emerald-950 border-emerald-800 text-slate-100' : 'bg-slate-50 border-slate-300'
                  }`}
                >
                  <option value="CORTE">✂️ Corte</option>
                  <option value="ROCADA">🌿 Roçada</option>
                  <option value="COLETA_PALHA">🌾 Coleta de Palha</option>
                  <option value="APLICACAO">🧪 Aplicação</option>
                  <option value="OUTROS">⚙️ Outros</option>
                </select>
              </div>
            </div>

            {/* Total Value Bar */}
            <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-300 block">
                  Valor Estimado ({numLiters}L × {formatCurrency(pricePerLiter)})
                </span>
                <span className="text-sm font-black text-amber-900 dark:text-amber-200">
                  {formatCurrency(metrics.totalValue)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-500 dark:text-emerald-400 block">Capacidade Tanque</span>
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{selectedEquipment?.tankCapacityLiters || 0}L</span>
              </div>
            </div>

            {/* Observations (Optional) */}
            <div>
              <label className="block text-[11px] font-bold mb-1 text-gray-700 dark:text-emerald-200">
                Observações (Opcional)
              </label>
              <input
                type="text"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Ex: Talhão 04 / Corte de grama bermuda..."
                className={`w-full px-3 py-2 rounded-xl border text-xs outline-none ${
                  darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 border-gray-200'
                }`}
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-2 border-t border-emerald-800/20 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 dark:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-5 py-2.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-gray-950 shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-transform active:scale-95 ${
                  isSubmitting ? 'opacity-70 cursor-wait' : ''
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Salvar Abastecimento</span>
                  </>
                )}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};

export const FuelingFormModal = React.memo(FuelingFormModalComponent);
