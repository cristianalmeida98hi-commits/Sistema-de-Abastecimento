import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Truck, Search, ChevronDown, Check, X, 
  Fuel, User as UserIcon, Gauge, Shield, Sparkles
} from 'lucide-react';
import { Vehicle, FuelType } from '../types';
import { getFuelTypeName, getSectorName } from '../utils/calculations';

interface VehicleSelectorProps {
  vehicles: Vehicle[];
  selectedVehicleId: string;
  onSelect: (vehicleId: string) => void;
  darkMode?: boolean;
  label?: string;
  required?: boolean;
  disabled?: boolean;
}

export const VehicleSelector: React.FC<VehicleSelectorProps> = ({
  vehicles,
  selectedVehicleId,
  onSelect,
  darkMode = true,
  label = 'Veículo / Trator / Máquina *',
  required = true,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'TRATOR' | 'MAQUINA_AGRICOLA' | 'VEICULO' | 'CAMINHAO'>('ALL');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter fuelable vehicles only
  const fuelableVehicles = useMemo(
    () => vehicles.filter(v => v.fuelType !== 'NENHUM'),
    [vehicles]
  );

  const selectedVehicle = useMemo(
    () => fuelableVehicles.find(v => v.id === selectedVehicleId) || fuelableVehicles[0],
    [fuelableVehicles, selectedVehicleId]
  );

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Counts by category
  const categoryCounts = useMemo(() => {
    return {
      ALL: fuelableVehicles.length,
      TRATOR: fuelableVehicles.filter(v => v.category === 'TRATOR').length,
      MAQUINA_AGRICOLA: fuelableVehicles.filter(v => v.category === 'MAQUINA_AGRICOLA').length,
      VEICULO: fuelableVehicles.filter(v => v.category === 'VEICULO').length,
    };
  }, [fuelableVehicles]);

  // Filtered vehicles
  const filteredVehicles = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return fuelableVehicles.filter(v => {
      // Category match
      if (categoryFilter !== 'ALL') {
        if (categoryFilter === 'VEICULO') {
          if (v.category !== 'VEICULO') return false;
        } else if (v.category !== categoryFilter) {
          return false;
        }
      }

      // Search match
      if (!query) return true;
      const plateOrCode = (v.licensePlate || v.patrimonyCode || '').toLowerCase();
      const model = (v.model || '').toLowerCase();
      const manufacturer = (v.manufacturer || '').toLowerCase();
      const sector = (v.sector || '').toLowerCase();
      const operator = (v.assignedOperatorName || '').toLowerCase();
      const fuel = getFuelTypeName(v.fuelType).toLowerCase();

      return (
        plateOrCode.includes(query) ||
        model.includes(query) ||
        manufacturer.includes(query) ||
        sector.includes(query) ||
        operator.includes(query) ||
        fuel.includes(query)
      );
    });
  }, [fuelableVehicles, searchQuery, categoryFilter]);

  const handleSelectVehicle = (vId: string) => {
    onSelect(vId);
    setIsOpen(false);
    setSearchQuery('');
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'TRATOR':
        return { label: 'TRATOR', emoji: '🚜', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
      case 'MAQUINA_AGRICOLA':
        return { label: 'MÁQUINA AGRÍCOLA', emoji: '🌾', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
      case 'VEICULO':
        return { label: 'VEÍCULO / CAMINHONETE', emoji: '🚗', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' };
      default:
        return { label: 'EQUIPAMENTO', emoji: '⚙️', color: 'bg-gray-500/20 text-gray-300 border-gray-500/40' };
    }
  };

  return (
    <div className="relative w-full space-y-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-black uppercase tracking-wider text-slate-200">
            {label}
          </label>
          <span className="text-[11px] font-semibold text-emerald-300">
            {fuelableVehicles.length} máquinas disponíveis
          </span>
        </div>
      )}

      {/* Selected Vehicle Card (Trigger) */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full text-left p-3 sm:p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 group outline-none ${
          disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
        } ${
          isOpen
            ? 'ring-2 ring-[#FACC15] border-[#FACC15] bg-[#063327]'
            : darkMode
            ? 'bg-[#042d23] hover:bg-[#06382b] border-emerald-800/80 text-white shadow-sm'
            : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-900 shadow-sm'
        }`}
      >
        {selectedVehicle ? (
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#FACC15] text-[#064E3B] flex items-center justify-center font-black text-lg shrink-0 shadow-sm">
              {getCategoryBadge(selectedVehicle.category).emoji}
            </div>

            <div className="min-w-0 flex-1 space-y-0.5">
              {/* Row 1: Category Pill & Plate Badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-[#FACC15] text-[#064E3B] shadow-xs">
                  {selectedVehicle.licensePlate || selectedVehicle.patrimonyCode || 'S/PLACA'}
                </span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getCategoryBadge(selectedVehicle.category).color}`}>
                  {getCategoryBadge(selectedVehicle.category).label}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                  {getFuelTypeName(selectedVehicle.fuelType)}
                </span>
              </div>

              {/* Row 2: Model Name */}
              <h4 className="text-sm sm:text-base font-extrabold text-white truncate group-hover:text-[#FACC15] transition-colors">
                {selectedVehicle.model}
              </h4>

              {/* Row 3: Meta details */}
              <div className="flex items-center gap-3 text-[11px] text-emerald-200/90 flex-wrap font-medium">
                {selectedVehicle.assignedOperatorName && (
                  <span className="flex items-center gap-1">
                    <UserIcon className="w-3 h-3 text-[#FACC15]" />
                    {selectedVehicle.assignedOperatorName}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-[#FACC15]" />
                  {selectedVehicle.category === 'VEICULO'
                    ? `${selectedVehicle.currentKm?.toLocaleString('pt-BR') || 0} KM`
                    : `${selectedVehicle.currentHourmeter?.toLocaleString('pt-BR') || 0} Horas`}
                </span>
                <span>Tanque: {selectedVehicle.tankCapacityLiters || 0}L</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-400 py-1">
            <Search className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-semibold">Clique para buscar e selecionar um veículo...</span>
          </div>
        )}

        {/* Action button hint */}
        <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-900/60 border border-emerald-700/60 text-[#FACC15] font-bold text-xs group-hover:bg-[#FACC15] group-hover:text-[#064E3B] transition-all">
          <span className="hidden sm:inline">Trocar</span>
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Search & Selection Dropdown Menu */}
      {isOpen && (
        <div className="p-3 sm:p-4 rounded-3xl border border-emerald-700/80 bg-[#03231b] shadow-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150 z-20">
          
          {/* Top Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#FACC15]" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar por modelo, placa, patrimônio, operador ou setor..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#063327] border-2 border-emerald-600/80 text-white placeholder-emerald-300/60 outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/20 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-300 hover:text-white hover:bg-emerald-800/60"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setCategoryFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl shrink-0 transition-all ${
                categoryFilter === 'ALL'
                  ? 'bg-[#FACC15] text-[#064E3B] font-black shadow-sm'
                  : 'bg-[#063327] text-emerald-200 hover:bg-emerald-800/60 border border-emerald-800'
              }`}
            >
              Todos ({categoryCounts.ALL})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('TRATOR')}
              className={`px-3 py-1.5 rounded-xl shrink-0 transition-all ${
                categoryFilter === 'TRATOR'
                  ? 'bg-[#FACC15] text-[#064E3B] font-black shadow-sm'
                  : 'bg-[#063327] text-emerald-200 hover:bg-emerald-800/60 border border-emerald-800'
              }`}
            >
              🚜 Tratores ({categoryCounts.TRATOR})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('MAQUINA_AGRICOLA')}
              className={`px-3 py-1.5 rounded-xl shrink-0 transition-all ${
                categoryFilter === 'MAQUINA_AGRICOLA'
                  ? 'bg-[#FACC15] text-[#064E3B] font-black shadow-sm'
                  : 'bg-[#063327] text-emerald-200 hover:bg-emerald-800/60 border border-emerald-800'
              }`}
            >
              🌾 Máquinas ({categoryCounts.MAQUINA_AGRICOLA})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('VEICULO')}
              className={`px-3 py-1.5 rounded-xl shrink-0 transition-all ${
                categoryFilter === 'VEICULO'
                  ? 'bg-[#FACC15] text-[#064E3B] font-black shadow-sm'
                  : 'bg-[#063327] text-emerald-200 hover:bg-emerald-800/60 border border-emerald-800'
              }`}
            >
              🚗 Veículos ({categoryCounts.VEICULO})
            </button>
          </div>

          {/* List of Vehicles */}
          <div className="max-h-64 sm:max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {filteredVehicles.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-[#04281f] border border-emerald-900/80 text-emerald-300">
                <Search className="w-8 h-8 mx-auto mb-2 text-[#FACC15] opacity-80" />
                <p className="font-bold text-xs text-white">Nenhum veículo encontrado</p>
                <p className="text-[11px] text-emerald-300 mt-1">
                  Tente buscar por outro termo ou limpe os filtros.
                </p>
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setCategoryFilter('ALL'); }}
                  className="mt-3 px-3 py-1.5 bg-[#FACC15] text-[#064E3B] rounded-xl text-xs font-black"
                >
                  Limpar Filtros
                </button>
              </div>
            ) : (
              filteredVehicles.map(v => {
                const isSelected = v.id === selectedVehicleId;
                const badge = getCategoryBadge(v.category);

                return (
                  <div
                    key={v.id}
                    onClick={() => handleSelectVehicle(v.id)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-[#064E3B] border-2 border-[#FACC15] shadow-md'
                        : 'bg-[#042d23] hover:bg-[#063b2e] border-emerald-800/80 text-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-base shrink-0 ${
                        isSelected ? 'bg-[#FACC15] text-[#064E3B]' : 'bg-emerald-950 text-emerald-200 border border-emerald-800'
                      }`}>
                        {badge.emoji}
                      </div>

                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            isSelected ? 'bg-[#FACC15] text-[#064E3B]' : 'bg-emerald-950 text-[#FACC15] border border-emerald-800'
                          }`}>
                            {v.licensePlate || v.patrimonyCode || 'S/PLACA'}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-200">
                            {getFuelTypeName(v.fuelType)}
                          </span>
                          <span className="text-[10px] text-emerald-300">
                            • Setor: {getSectorName(v.sector)}
                          </span>
                        </div>

                        <p className="text-xs sm:text-sm font-extrabold text-white truncate">
                          {v.model}
                        </p>

                        <div className="flex items-center gap-2 text-[10px] text-emerald-200/80">
                          {v.assignedOperatorName && (
                            <span>Op: <strong>{v.assignedOperatorName}</strong></span>
                          )}
                          <span>•</span>
                          <span>
                            {v.category === 'VEICULO'
                              ? `${v.currentKm?.toLocaleString('pt-BR') || 0} KM`
                              : `${v.currentHourmeter?.toLocaleString('pt-BR') || 0} h`}
                          </span>
                          <span>•</span>
                          <span>Tanque: {v.tankCapacityLiters || 0}L</span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isSelected ? (
                        <div className="w-7 h-7 rounded-full bg-[#FACC15] text-[#064E3B] flex items-center justify-center font-black">
                          <Check className="w-4 h-4 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-full border border-emerald-700 bg-emerald-950/40 text-transparent hover:border-[#FACC15]"></div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Close button footer */}
          <div className="pt-2 border-t border-emerald-800/60 flex items-center justify-between text-xs">
            <span className="text-emerald-300 text-[11px]">
              Exibindo {filteredVehicles.length} de {fuelableVehicles.length} máquinas
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1.5 bg-emerald-900/80 hover:bg-emerald-800 text-emerald-100 rounded-xl font-bold"
            >
              Fechar Lista
            </button>
          </div>

        </div>
      )}
    </div>
  );
};
