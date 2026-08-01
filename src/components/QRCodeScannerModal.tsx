import React, { useState } from 'react';
import { QrCode, X, Camera, CheckCircle2, Truck, Fuel } from 'lucide-react';
import { Vehicle } from '../types';

interface QRCodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: Vehicle[];
  onOpenFuelingModalWithEquipment: (equipmentId: string) => void;
  darkMode: boolean;
}

export const QRCodeScannerModal: React.FC<QRCodeScannerModalProps> = ({
  isOpen,
  onClose,
  vehicles,
  onOpenFuelingModalWithEquipment,
  darkMode
}) => {
  if (!isOpen) return null;

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(vehicles[0]?.id || '');

  const handleSimulateScan = () => {
    onClose();
    if (selectedVehicleId) {
      onOpenFuelingModalWithEquipment(selectedVehicleId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
      <div className={`w-full max-w-md rounded-2xl shadow-2xl border p-5 space-y-4 text-center ${
        darkMode ? 'bg-emerald-950 border-emerald-800 text-emerald-100' : 'bg-white border-emerald-100 text-gray-900'
      }`}>
        <div className="flex items-center justify-between border-b pb-3 border-emerald-800/20">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-amber-500" />
            <span className="font-bold text-sm">Leitor de QR Code de Veículos</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-emerald-500/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Simulator Frame */}
        <div className="p-6 rounded-2xl bg-black border-2 border-dashed border-amber-500/50 relative overflow-hidden flex flex-col items-center justify-center space-y-3">
          <Camera className="w-12 h-12 text-amber-400 animate-pulse" />
          <p className="text-xs text-emerald-200">Aproxime o QR Code colado no veículo ou trator...</p>
          <div className="w-48 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-bounce" />
        </div>

        {/* Quick Simulator Selector */}
        <div className="text-left text-xs space-y-2">
          <label className="block font-bold text-gray-700 dark:text-emerald-200">
            Simular Leitura de QR Code do Equipamento:
          </label>
          <select
            value={selectedVehicleId}
            onChange={(e) => setSelectedVehicleId(e.target.value)}
            className={`w-full p-2.5 rounded-xl border font-bold ${
              darkMode ? 'bg-emerald-900/40 border-emerald-800 text-amber-400' : 'bg-gray-50 border-gray-200 text-emerald-900'
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
          onClick={handleSimulateScan}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-gray-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Confirmar Leitura & Abrir Abastecimento</span>
        </button>
      </div>
    </div>
  );
};
