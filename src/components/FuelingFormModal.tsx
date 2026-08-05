import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Fuel, Calendar, Clock, Truck, User as UserIcon, 
  DollarSign, Camera, FileText, AlertTriangle, CheckCircle2, Calculator, Sparkles 
} from 'lucide-react';
import { Vehicle, GasStation, User, FuelType, FuelLog, SystemSettings, OperationType, ActivityType } from '../types';
import { 
  calculateFuelLogMetrics, formatCurrency, getFuelTypeName, getSectorName 
} from '../utils/calculations';

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

  // Form states
  const [dateTime, setDateTime] = useState<string>(
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  );
  
  const fuelableVehicles = useMemo(
    () => vehicles.filter(v => v.fuelType !== 'NENHUM'),
    [vehicles]
  );

  const [equipmentId, setEquipmentId] = useState<string>(() => {
    if (preSelectedVehicleId && fuelableVehicles.some(v => v.id === preSelectedVehicleId)) {
      return preSelectedVehicleId;
    }
    return fuelableVehicles[0]?.id || '';
  });

  const selectedEquipment = vehicles.find(v => v.id === equipmentId);

  const [driverOrOperatorId, setDriverOrOperatorId] = useState<string>(
    selectedEquipment?.assignedOperatorId || users[2]?.id || users[0]?.id || ''
  );

  const [gasStationId, setGasStationId] = useState<string>(gasStations[0]?.id || '');

  const selectedStation = gasStations.find(s => s.id === gasStationId);

  const [fuelType, setFuelType] = useState<FuelType>(
    selectedEquipment?.fuelType || 'DIESEL_S10'
  );

  const [liters, setLiters] = useState<number>(50);

  const initialPrice = selectedStation?.pricePerLiter[fuelType] || 5.79;
  const [pricePerLiter, setPricePerLiter] = useState<number>(initialPrice);

  const isKmBased = selectedEquipment?.category === 'VEICULO';
  const initialCurrentKmOrHour = isKmBased 
    ? (selectedEquipment?.currentKm || 0) + 150 
    : (selectedEquipment?.currentHourmeter || 0) + 10;

  const [currentKmOrHour, setCurrentKmOrHour] = useState<number>(initialCurrentKmOrHour);

  const [dashboardPhotoUrl, setDashboardPhotoUrl] = useState<string>('');
  const [invoicePhotoUrl, setInvoicePhotoUrl] = useState<string>('');
  const [observations, setObservations] = useState<string>('');
  const [operationType, setOperationType] = useState<OperationType>('GRAMA');
  const [activityType, setActivityType] = useState<ActivityType>('CORTE');

  // Update defaults when equipment changes
  useEffect(() => {
    if (selectedEquipment) {
      setFuelType(selectedEquipment.fuelType);
      if (selectedEquipment.assignedOperatorId) {
        setDriverOrOperatorId(selectedEquipment.assignedOperatorId);
      }
      const nextKmOrHour = isKmBased 
        ? (selectedEquipment.currentKm || 0) + 100 
        : (selectedEquipment.currentHourmeter || 0) + 8;
      setCurrentKmOrHour(nextKmOrHour);
    }
  }, [equipmentId]);

  // Update price when station or fuelType changes
  useEffect(() => {
    if (selectedStation && selectedStation.pricePerLiter[fuelType]) {
      setPricePerLiter(selectedStation.pricePerLiter[fuelType]);
    }
  }, [gasStationId, fuelType]);

  // Calculate live metrics
  const metrics = selectedEquipment ? calculateFuelLogMetrics(
    liters,
    pricePerLiter,
    selectedEquipment,
    currentKmOrHour,
    previousLogs.filter(l => l.equipmentId === equipmentId),
    settings.suspiciousFuelMarginPercentage
  ) : {
    totalValue: liters * pricePerLiter,
    flaggedSuspicious: false
  };

  const selectedDriver = users.find(u => u.id === driverOrOperatorId);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEquipment || !selectedStation || !selectedDriver) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        dateTime,
        equipmentId: selectedEquipment.id,
        equipmentName: selectedEquipment.model,
        equipmentCategory: selectedEquipment.category,
        equipmentPlateOrCode: selectedEquipment.licensePlate || selectedEquipment.patrimonyCode || 'S/PLACA',
        driverOrOperatorId: selectedDriver.id,
        driverOrOperatorName: selectedDriver.name,
        attendantId: currentUser.id,
        attendantName: currentUser.name,
        gasStationId: selectedStation.id,
        gasStationName: selectedStation.name,
        fuelType,
        liters,
        pricePerLiter,
        totalValue: metrics.totalValue,
        operationType,
        activityType,
        kmAtFueling: isKmBased ? currentKmOrHour : undefined,
        hourmeterAtFueling: !isKmBased ? currentKmOrHour : undefined,
        previousKmOrHour: metrics.previousKmOrHour,
        calculatedAverageKmPerLiter: metrics.calculatedAverageKmPerLiter,
        calculatedAverageLitersPerHour: metrics.calculatedAverageLitersPerHour,
        costPerKm: metrics.costPerKm,
        costPerHour: metrics.costPerHour,
        estimatedAutonomyKmOrHours: metrics.estimatedAutonomyKmOrHours,
        dashboardPhotoUrl: dashboardPhotoUrl || undefined,
        invoicePhotoUrl: invoicePhotoUrl || undefined,
        observations: observations || undefined,
        flaggedSuspicious: metrics.flaggedSuspicious,
        suspiciousReason: metrics.suspiciousReason,
        createdById: currentUser.id,
        createdByName: currentUser.name
      });

      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar no modal de abastecimento:', err);
      alert(`Erro ao salvar abastecimento: ${err?.message || 'Falha de comunicação com o Firestore.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className={`w-full max-w-3xl rounded-2xl shadow-2xl border max-h-[90vh] flex flex-col overflow-hidden ${
        darkMode ? 'bg-emerald-950 border-emerald-800 text-emerald-50' : 'bg-white border-emerald-100 text-gray-900'
      }`}>
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-emerald-800/20 bg-gradient-to-r from-emerald-900 to-emerald-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-gray-950 flex items-center justify-center font-bold">
              <Fuel className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold">Novo Registro de Abastecimento</h2>
              <p className="text-xs text-emerald-200">AndradeAgro • Cálculo automático de consumo e custo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-emerald-800/80 hover:bg-emerald-700 text-emerald-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5 flex-1">
          
          {/* Anomaly Alert Warning Banner if suspicious */}
          {metrics.flaggedSuspicious && (
            <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-200 flex items-start gap-3 text-xs animate-pulse">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold uppercase tracking-wide block">Alerta de Consumo Suspeito</span>
                <p className="mt-0.5 leading-relaxed">{metrics.suspiciousReason}</p>
              </div>
            </div>
          )}

          {/* Row 1: Date/Time & Equipment Select */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div>
              <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-emerald-200">
                Data e Hora do Abastecimento
              </label>
              <input
                type="datetime-local"
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                required
                className={`w-full px-3 py-2 rounded-xl border text-xs outline-none ${
                  darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-emerald-200">
                Veículo / Trator / Máquina
              </label>
              <select
                value={equipmentId}
                onChange={(e) => setEquipmentId(e.target.value)}
                required
                className={`w-full px-3 py-2 rounded-xl border text-xs font-bold outline-none ${
                  darkMode ? 'bg-emerald-900/40 border-emerald-800 text-amber-400' : 'bg-gray-50 border-gray-200 text-emerald-800'
                }`}
              >
                {fuelableVehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    [{v.category}] {v.model} ({v.licensePlate || v.patrimonyCode})
                  </option>
                ))}
              </select>
            </div>

          </div>

          {/* Selected Equipment Spec Badge */}
          {selectedEquipment && (
            <div className={`p-3 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
              darkMode ? 'bg-emerald-900/30 border-emerald-800/80' : 'bg-emerald-50/70 border-emerald-100'
            }`}>
              <div>
                <span className="font-bold text-gray-900 dark:text-emerald-100">{selectedEquipment.model}</span>
                <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300">
                  {getSectorName(selectedEquipment.sector)}
                </span>
              </div>
              <div className="flex gap-3 text-[11px] font-semibold text-gray-600 dark:text-emerald-300">
                <span>Capacidade: <strong className="text-emerald-700 dark:text-emerald-400">{selectedEquipment.tankCapacityLiters}L</strong></span>
                <span>{isKmBased ? 'KM Atual:' : 'Horímetro Atual:'} <strong className="text-emerald-700 dark:text-emerald-400">{isKmBased ? `${selectedEquipment.currentKm} km` : `${selectedEquipment.currentHourmeter || 0} h`}</strong></span>
              </div>
            </div>
          )}

          {/* Row 2: Driver / Operator */}
          <div>
            <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-emerald-200">
              Motorista / Operador Responsável
            </label>
            <select
              value={driverOrOperatorId}
              onChange={(e) => setDriverOrOperatorId(e.target.value)}
              required
              className={`w-full px-3 py-2 rounded-xl border text-xs outline-none ${
                darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
              }`}
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.department})
                </option>
              ))}
            </select>
          </div>

          {/* Row 2.5: Operation Type & Activity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-emerald-200">
                Tipo de Operação
              </label>
              <select
                value={operationType}
                onChange={(e) => setOperationType(e.target.value as OperationType)}
                className={`w-full px-3 py-2 rounded-xl border text-xs outline-none font-bold ${
                  darkMode ? 'bg-emerald-950 border-emerald-800 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
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
              <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-emerald-200">
                Atividade Específica
              </label>
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value as ActivityType)}
                className={`w-full px-3 py-2 rounded-xl border text-xs outline-none font-bold ${
                  darkMode ? 'bg-emerald-950 border-emerald-800 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
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

          {/* Row 3: Gas Station & Fuel Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div>
              <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-emerald-200">
                Posto de Combustível
              </label>
              <select
                value={gasStationId}
                onChange={(e) => setGasStationId(e.target.value)}
                required
                className={`w-full px-3 py-2 rounded-xl border text-xs outline-none ${
                  darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                }`}
              >
                {gasStations.map(s => (
                  <option key={s.id} value={s.id}>
                    [{s.type}] {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-emerald-200">
                Tipo de Combustível
              </label>
              <select
                value={fuelType}
                onChange={(e) => setFuelType(e.target.value as FuelType)}
                required
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

          {/* Row 4: Liters, Price/L, Total Value & Odometers */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
            
            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-emerald-200 mb-1">
                Litros Abastecidos
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={liters}
                onChange={(e) => setLiters(parseFloat(e.target.value) || 0)}
                required
                className={`w-full px-3 py-1.5 rounded-xl border text-xs font-bold outline-none ${
                  darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-gray-200 text-gray-900'
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-emerald-200 mb-1">
                Valor por Litro (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={pricePerLiter}
                onChange={(e) => setPricePerLiter(parseFloat(e.target.value) || 0)}
                required
                className={`w-full px-3 py-1.5 rounded-xl border text-xs font-bold outline-none ${
                  darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-gray-200 text-gray-900'
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-emerald-200 mb-1">
                {isKmBased ? 'Quilometragem (KM)' : 'Horímetro Atual (Horas)'}
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={currentKmOrHour}
                onChange={(e) => setCurrentKmOrHour(parseFloat(e.target.value) || 0)}
                required
                className={`w-full px-3 py-1.5 rounded-xl border text-xs font-bold outline-none ${
                  darkMode ? 'bg-emerald-950 border-emerald-800 text-amber-400' : 'bg-white border-gray-200 text-emerald-800'
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-emerald-200 mb-1">
                Valor Total (Calculado)
              </label>
              <div className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-900 dark:text-amber-300 font-black text-xs">
                {formatCurrency(metrics.totalValue)}
              </div>
            </div>

          </div>

          {/* Automatic Calculations Card */}
          <div className={`p-4 rounded-2xl border ${
            darkMode ? 'bg-emerald-900/30 border-emerald-800' : 'bg-emerald-50/80 border-emerald-200/80'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-900 dark:text-emerald-100">
                Indicadores Calculados Automaticamente
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              
              <div className="p-2 rounded-xl bg-white/80 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-800/50">
                <span className="text-[10px] text-gray-500 dark:text-emerald-400 block">Rendimento / Consumo</span>
                <span className="font-extrabold text-sm text-emerald-700 dark:text-emerald-300">
                  {metrics.calculatedAverageKmPerLiter 
                    ? `${metrics.calculatedAverageKmPerLiter} km/L` 
                    : metrics.calculatedAverageLitersPerHour 
                    ? `${metrics.calculatedAverageLitersPerHour} L/h` 
                    : 'Aguardando 2º abast.'}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-white/80 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-800/50">
                <span className="text-[10px] text-gray-500 dark:text-emerald-400 block">Custo Unitário</span>
                <span className="font-extrabold text-sm text-emerald-700 dark:text-emerald-300">
                  {metrics.costPerKm 
                    ? `${formatCurrency(metrics.costPerKm)} / km` 
                    : metrics.costPerHour 
                    ? `${formatCurrency(metrics.costPerHour)} / h` 
                    : '-'}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-white/80 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-800/50 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-gray-500 dark:text-emerald-400 block">Autonomia Estimada</span>
                <span className="font-extrabold text-sm text-amber-600 dark:text-amber-400">
                  {metrics.estimatedAutonomyKmOrHours 
                    ? `${metrics.estimatedAutonomyKmOrHours} ${isKmBased ? 'km' : 'horas'}` 
                    : '-'}
                </span>
              </div>

            </div>
          </div>

          {/* Photo Attachments Simulator */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div>
              <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-emerald-200">
                Foto do Painel / Odômetro (Opcional)
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="Link ou Simular Foto do Painel..."
                  value={dashboardPhotoUrl}
                  onChange={(e) => setDashboardPhotoUrl(e.target.value)}
                  className={`flex-1 px-3 py-1.5 rounded-xl border text-xs outline-none ${
                    darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 border-gray-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setDashboardPhotoUrl('https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80')}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-800 text-amber-400 font-bold text-xs flex items-center gap-1"
                  title="Simular Foto do Painel"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Foto</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-emerald-200">
                Foto da Nota Fiscal / Comprovante (Opcional)
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="Link ou Simular Comprovante..."
                  value={invoicePhotoUrl}
                  onChange={(e) => setInvoicePhotoUrl(e.target.value)}
                  className={`flex-1 px-3 py-1.5 rounded-xl border text-xs outline-none ${
                    darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 border-gray-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setInvoicePhotoUrl('https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80')}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-800 text-amber-400 font-bold text-xs flex items-center gap-1"
                  title="Simular Comprovante"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Nota</span>
                </button>
              </div>
            </div>

          </div>

          {/* Observations */}
          <div>
            <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-emerald-200">
              Observações Operacionais
            </label>
            <textarea
              rows={2}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Ex: Trabalho em solo compactado / Talhão 14 / Substituição de filtro pendente..."
              className={`w-full p-2.5 rounded-xl border text-xs outline-none ${
                darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
              }`}
            />
          </div>

          {/* Submit Action Buttons */}
          <div className="pt-3 border-t border-emerald-800/20 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 dark:text-emerald-300 hover:bg-emerald-500/10"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-800 to-emerald-700 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-lg shadow-emerald-900/20 flex items-center gap-2 ${
                isSubmitting ? 'opacity-70 cursor-wait' : ''
              }`}
            >
              {isSubmitting ? (
                <>
                  <Clock className="w-4 h-4 text-amber-400 animate-spin" />
                  <span>Salvando no Firestore...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                  <span>Salvar Registro de Abastecimento</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

export const FuelingFormModal = React.memo(FuelingFormModalComponent);
