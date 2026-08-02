import React, { useState } from 'react';
import { Fuel, Plus, Edit3, CheckCircle2, DollarSign, MapPin, Building, X } from 'lucide-react';
import { GasStation, FuelType } from '../types';
import { formatCurrency, getFuelTypeName } from '../utils/calculations';

interface GasStationsViewProps {
  gasStations: GasStation[];
  onAddStation: (station: Omit<GasStation, 'id'>) => void;
  onUpdateStation: (id: string, fields: Partial<GasStation>) => void;
  darkMode: boolean;
}

export const GasStationsViewComponent: React.FC<GasStationsViewProps> = ({
  gasStations,
  onAddStation,
  onUpdateStation,
  darkMode
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingStation, setEditingStation] = useState<GasStation | null>(null);

  // New Station form
  const [name, setName] = useState('');
  const [type, setType] = useState<'INTERNO' | 'EXTERNO'>('INTERNO');
  const [supplierName, setSupplierName] = useState('');
  const [location, setLocation] = useState('');
  const [dieselS10Price, setDieselS10Price] = useState(5.79);
  const [dieselS500Price, setDieselS500Price] = useState(5.59);
  const [gasolinaPrice, setGasolinaPrice] = useState(6.09);
  const [etanolPrice, setEtanolPrice] = useState(3.89);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddStation({
      name,
      type,
      supplierName,
      location,
      pricePerLiter: {
        DIESEL_S10: dieselS10Price,
        DIESEL_S500: dieselS500Price,
        GASOLINA_COMUM: gasolinaPrice,
        GASOLINA_GRID: gasolinaPrice + 0.30,
        ETANOL: etanolPrice,
        ARLA_32: 2.50
      },
      active: true
    });
    setShowModal(false);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-emerald-100 flex items-center gap-2">
            <Fuel className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            Postos de Combustível & Fornecedores
          </h1>
          <p className="text-xs text-gray-500 dark:text-emerald-400">
            Gestão do posto interno da fazenda, postos comerciais externos e tabela de preços vigentes.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          <span>Cadastrar Posto</span>
        </button>
      </div>

      {/* Gas Stations Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {gasStations.map(stn => (
          <div
            key={stn.id}
            className={`p-5 rounded-2xl border space-y-4 transition-all ${
              darkMode ? 'bg-emerald-950/40 border-emerald-900' : 'bg-white border-emerald-100 shadow-sm'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                  stn.type === 'INTERNO' 
                    ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30' 
                    : 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                }`}>
                  Posto {stn.type}
                </span>
                <h3 className="font-extrabold text-sm text-gray-900 dark:text-emerald-100 mt-1">
                  {stn.name}
                </h3>
                <p className="text-xs text-gray-500 dark:text-emerald-300 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-500" /> {stn.location}
                </p>
              </div>

              <button
                onClick={() => setEditingStation(stn)}
                className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
                title="Editar Tabela de Preços"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>

            {/* Price Table */}
            <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 space-y-1.5 text-xs">
              <span className="text-[10px] font-bold text-gray-500 dark:text-emerald-400 uppercase block mb-1">
                Tabela de Preços Atual (R$/L)
              </span>
              <div className="flex justify-between font-semibold">
                <span>Diesel S10:</span>
                <strong className="text-emerald-700 dark:text-emerald-300">{formatCurrency(stn.pricePerLiter.DIESEL_S10)}</strong>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Diesel S500:</span>
                <strong className="text-emerald-700 dark:text-emerald-300">{formatCurrency(stn.pricePerLiter.DIESEL_S500)}</strong>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Gasolina Comum:</span>
                <strong className="text-gray-800 dark:text-emerald-200">{formatCurrency(stn.pricePerLiter.GASOLINA_COMUM)}</strong>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Etanol:</span>
                <strong className="text-amber-600 dark:text-amber-400">{formatCurrency(stn.pricePerLiter.ETANOL)}</strong>
              </div>
            </div>

            <p className="text-[11px] text-gray-500 dark:text-emerald-400 font-medium">
              Fornecedor: <strong>{stn.supplierName}</strong>
            </p>
          </div>
        ))}
      </div>

      {/* New Station Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className={`w-full max-w-md rounded-2xl shadow-2xl border p-5 space-y-4 ${
            darkMode ? 'bg-emerald-950 border-emerald-800 text-emerald-100' : 'bg-white border-emerald-100 text-gray-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-emerald-800/20">
              <span className="font-bold text-sm">Cadastrar Novo Posto</span>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-emerald-500/10">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Nome do Posto</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Posto Fazenda Andrade - Sede..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800' : 'bg-gray-50'}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Tipo</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800' : 'bg-gray-50'}`}
                  >
                    <option value="INTERNO">Interno (Fazenda)</option>
                    <option value="EXTERNO">Externo (Comercial)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">Fornecedor</label>
                  <input
                    type="text"
                    placeholder="Ex: Vibra / Shell..."
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800' : 'bg-gray-50'}`}
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Localização</label>
                <input
                  type="text"
                  placeholder="Ex: Sorriso/MT - BR 163 Km 740..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800' : 'bg-gray-50'}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Preço Diesel S10 (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={dieselS10Price}
                    onChange={(e) => setDieselS10Price(parseFloat(e.target.value) || 0)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800' : 'bg-gray-50'}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Preço Etanol (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={etanolPrice}
                    onChange={(e) => setEtanolPrice(parseFloat(e.target.value) || 0)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800' : 'bg-gray-50'}`}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 rounded-xl hover:bg-emerald-500/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 text-gray-950 font-bold"
                >
                  Salvar Posto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export const GasStationsView = React.memo(GasStationsViewComponent);
