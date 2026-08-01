import React, { useState, useMemo } from 'react';
import { QrCode, X, Camera, CheckCircle2, Truck, Fuel, FileText, Info } from 'lucide-react';
import { Vehicle, FuelLog } from '../types';
import { formatCurrency, getFuelTypeName, getSectorName } from '../utils/calculations';

interface QRCodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: Vehicle[];
  fuelLogs?: FuelLog[];
  onOpenFuelingModalWithEquipment: (equipmentId: string) => void;
  darkMode: boolean;
}

export const QRCodeScannerModal: React.FC<QRCodeScannerModalProps> = ({
  isOpen,
  onClose,
  vehicles,
  fuelLogs = [],
  onOpenFuelingModalWithEquipment,
  darkMode
}) => {
  if (!isOpen) return null;

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(vehicles[0]?.id || '');
  const [scannedResult, setScannedResult] = useState<Vehicle | null>(null);

  // Up to date vehicle data from DB
  const liveVehicle = useMemo(() => {
    if (!scannedResult) return null;
    return vehicles.find(v => v.id === scannedResult.id) || scannedResult;
  }, [scannedResult, vehicles]);

  // Fuel logs for live vehicle
  const liveVehicleFuelLogs = useMemo(() => {
    if (!liveVehicle) return [];
    return fuelLogs
      .filter(f => f.equipmentId === liveVehicle.id)
      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
  }, [liveVehicle, fuelLogs]);

  const handleScan = () => {
    const found = vehicles.find(v => v.id === selectedVehicleId);
    if (found) {
      setScannedResult(found);
    }
  };

  const handleStartFueling = () => {
    if (liveVehicle) {
      onClose();
      onOpenFuelingModalWithEquipment(liveVehicle.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div className={`w-full max-w-lg rounded-3xl shadow-2xl border p-6 space-y-4 max-h-[90vh] overflow-y-auto ${
        darkMode ? 'bg-[#042d23] border-emerald-900 text-slate-100' : 'bg-white border-slate-100 text-slate-900'
      }`}>
        
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3 border-emerald-800/20">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#064E3B] text-[#FACC15]">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                Leitor de QR Code de Máquinas
              </h2>
              <p className="text-[11px] text-slate-500">
                Consulte o cadastro atualizado e histórico da máquina
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-emerald-900/50">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {!scannedResult ? (
          <>
            {/* Camera Viewport Simulation */}
            <div className="p-6 rounded-2xl bg-slate-950 border-2 border-dashed border-[#FACC15]/60 relative overflow-hidden flex flex-col items-center justify-center space-y-3 text-center">
              <Camera className="w-10 h-10 text-[#FACC15] animate-pulse" />
              <p className="text-xs text-emerald-200 font-semibold">
                Posicione o QR Code colado no veículo no centro do leitor...
              </p>
              <div className="w-48 h-1 bg-gradient-to-r from-transparent via-[#FACC15] to-transparent animate-bounce rounded-full" />
            </div>

            {/* Selector Simulator */}
            <div className="text-left text-xs space-y-2 pt-1">
              <label className="block font-bold text-slate-800 dark:text-emerald-200">
                Simular Leitura do QR Code de Equipamento:
              </label>
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className={`w-full p-3 rounded-2xl border font-bold text-xs outline-none ${
                  darkMode ? 'bg-emerald-950 border-emerald-800 text-[#FACC15]' : 'bg-slate-50 border-slate-200 text-[#064E3B]'
                }`}
              >
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    [{v.category}] {v.model} ({v.licensePlate || v.patrimonyCode})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleScan}
              className="w-full py-3.5 rounded-2xl bg-[#064E3B] hover:bg-[#043d2e] text-[#FACC15] font-black text-xs flex items-center justify-center gap-2 shadow-md transition-transform active:scale-[0.99]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Escanear & Buscar Dados no Banco</span>
            </button>
          </>
        ) : (
          /* Scanned Live Results */
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-white border shrink-0">
                  <img
                    src={liveVehicle?.photoUrl || 'https://images.unsplash.com/photo-1592861956120-e524fc739696?w=600&auto=format&fit=crop&q=80'}
                    alt={liveVehicle?.model}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-md">
                    {liveVehicle?.licensePlate || liveVehicle?.patrimonyCode}
                  </span>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 mt-0.5">
                    {liveVehicle?.model}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setScannedResult(null)}
                className="text-xs font-bold text-[#064E3B] dark:text-[#FACC15] underline"
              >
                Escanear Outro
              </button>
            </div>

            {/* Cadastro Atualizado */}
            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-[#064E3B] dark:text-[#FACC15]" />
                <span>Cadastro Atualizado (Banco de Dados)</span>
              </h4>
              <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-emerald-300 bg-slate-50 dark:bg-emerald-950/60 p-3 rounded-2xl border">
                <p><strong>Fabricante:</strong> {liveVehicle?.manufacturer}</p>
                <p><strong>Setor:</strong> {getSectorName(liveVehicle?.sector || 'AGRICOLA')}</p>
                <p><strong>Tanque:</strong> {liveVehicle?.tankCapacityLiters}L ({getFuelTypeName(liveVehicle?.fuelType || 'DIESEL_S10')})</p>
                <p><strong>Uso Atual:</strong> {liveVehicle?.category === 'VEICULO' ? `${liveVehicle?.currentKm} km` : `${liveVehicle?.currentHourmeter || 0} h`}</p>
                <p className="col-span-2"><strong>Operador Responsável:</strong> {liveVehicle?.assignedOperatorName || 'Não atribuído'}</p>
              </div>
            </div>

            {/* Histórico de Abastecimento */}
            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#064E3B] dark:text-[#FACC15]" />
                <span>Histórico de Abastecimento ({liveVehicleFuelLogs.length})</span>
              </h4>
              {liveVehicleFuelLogs.length === 0 ? (
                <div className="p-3 text-center text-[11px] text-slate-500 border border-dashed rounded-xl">
                  Nenhum registro de abastecimento para este equipamento ainda.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {liveVehicleFuelLogs.slice(0, 4).map(log => (
                    <div key={log.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-emerald-950/60 border text-[11px] flex items-center justify-between">
                      <div>
                        <span className="font-extrabold text-slate-900 dark:text-slate-100">{log.liters} L</span>
                        <span className="text-slate-500 ml-2">{new Date(log.dateTime).toLocaleDateString('pt-BR')}</span>
                        <p className="text-slate-600 dark:text-emerald-300">Op: {log.driverOrOperatorName}</p>
                      </div>
                      <span className="font-bold text-slate-800 dark:text-emerald-200">{formatCurrency(log.totalValue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action button */}
            <button
              onClick={handleStartFueling}
              className="w-full py-3.5 rounded-2xl bg-[#064E3B] hover:bg-[#043d2e] text-[#FACC15] font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-[0.99]"
            >
              <Fuel className="w-4 h-4 fill-[#FACC15]" />
              <span>⚡ INICIAR NOVO REGISTRO DE ABASTECIMENTO</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
