import React, { useState, useMemo } from 'react';
import { 
  Truck, Plus, Search, Filter, QrCode, Wrench, Fuel, CheckCircle2, 
  AlertTriangle, Clock, Calendar, Shield, X, Edit3, Trash2, Printer, Eye
} from 'lucide-react';
import { Vehicle, EquipmentCategory, FuelType, Sector, User, MaintenanceLog, FuelLog } from '../types';
import { formatCurrency, getFuelTypeName, getSectorName } from '../utils/calculations';
import { QRCodeCanvas } from 'qrcode.react';
import { generateQRCodeDataUrl } from '../utils/qrcode';
import { openPrintWindow } from '../utils/printWindow';

interface FleetManagementViewProps {
  vehicles: Vehicle[];
  users: User[];
  currentUser: User;
  maintenanceLogs: MaintenanceLog[];
  fuelLogs: FuelLog[];
  onAddVehicle: (v: Omit<Vehicle, 'id'>) => void;
  onUpdateVehicle: (id: string, v: Partial<Vehicle>) => void;
  onDeleteVehicle: (id: string) => void;
  onOpenFuelingModalWithEquipment: (equipmentId: string) => void;
  onOpenDigitalSheet?: (vehicle: Vehicle) => void;
  darkMode: boolean;
}

export const FleetManagementViewComponent: React.FC<FleetManagementViewProps> = ({
  vehicles,
  users,
  currentUser,
  maintenanceLogs,
  fuelLogs,
  onAddVehicle,
  onUpdateVehicle,
  onDeleteVehicle,
  onOpenFuelingModalWithEquipment,
  onOpenDigitalSheet,
  darkMode
}) => {
  const [activeTab, setActiveTab] = useState<EquipmentCategory>('VEICULO');
  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState<string>('ALL');

  // Modal Passport
  const [passportVehicle, setPassportVehicle] = useState<Vehicle | null>(null);

  // New & Edit Equipment Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [model, setModel] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [year, setYear] = useState(2024);
  const [licensePlate, setLicensePlate] = useState('');
  const [patrimonyCode, setPatrimonyCode] = useState('');
  const [sector, setSector] = useState<Sector>('AGRICOLA');
  const [fuelType, setFuelType] = useState<FuelType>('DIESEL_S10');
  const [tankCapacityLiters, setTankCapacityLiters] = useState(100);
  const [currentKm, setCurrentKm] = useState(0);
  const [currentHourmeter, setCurrentHourmeter] = useState(0);
  const [assignedOperatorId, setAssignedOperatorId] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      // Tab category match
      if (activeTab === 'MAQUINA_AGRICOLA') {
        if (v.category !== 'MAQUINA_AGRICOLA' && v.category !== 'IMPLEMENTO') return false;
      } else {
        if (v.category !== activeTab) return false;
      }

      // Search
      if (search) {
        const q = search.toLowerCase();
        const matchModel = v.model.toLowerCase().includes(q);
        const matchPlate = (v.licensePlate || v.patrimonyCode || '').toLowerCase().includes(q);
        const matchBrand = v.manufacturer.toLowerCase().includes(q);
        if (!matchModel && !matchPlate && !matchBrand) return false;
      }

      // Sector
      if (sectorFilter !== 'ALL' && v.sector !== sectorFilter) return false;

      return true;
    });
  }, [vehicles, activeTab, search, sectorFilter]);

  const handleCreateEquipment = (e: React.FormEvent) => {
    e.preventDefault();
    const operator = users.find(u => u.id === assignedOperatorId);

    onAddVehicle({
      category: activeTab,
      model,
      manufacturer,
      year,
      color: 'Verde/Branco',
      licensePlate: activeTab === 'VEICULO' ? licensePlate : `AGRO-${patrimonyCode}`,
      patrimonyCode: activeTab !== 'VEICULO' ? patrimonyCode : undefined,
      sector,
      fuelType,
      tankCapacityLiters,
      currentKm: activeTab === 'VEICULO' ? currentKm : 0,
      currentHourmeter: activeTab !== 'VEICULO' ? currentHourmeter : undefined,
      status: 'ATIVO',
      assignedOperatorId: operator?.id,
      assignedOperatorName: operator?.name,
      photoUrl: photoUrl || 'https://images.unsplash.com/photo-1592861956120-e524fc739696?w=600&auto=format&fit=crop&q=80'
    });

    setShowAddModal(false);
    // Reset
    setModel('');
    setManufacturer('');
    setYear(2024);
    setLicensePlate('');
    setPatrimonyCode('');
    setSector('AGRICOLA');
    setFuelType('DIESEL_S10');
    setTankCapacityLiters(100);
    setCurrentKm(0);
    setCurrentHourmeter(0);
    setAssignedOperatorId('');
    setPhotoUrl('');
  };

  const handleOpenEditModal = (v: Vehicle) => {
    setEditingVehicle(v);
    setModel(v.model || '');
    setManufacturer(v.manufacturer || '');
    setYear(v.year || 2024);
    setLicensePlate(v.licensePlate || '');
    setPatrimonyCode(v.patrimonyCode || '');
    setSector(v.sector || 'AGRICOLA');
    setFuelType(v.fuelType || 'DIESEL_S10');
    setTankCapacityLiters(v.tankCapacityLiters || 100);
    setCurrentKm(v.currentKm || 0);
    setCurrentHourmeter(v.currentHourmeter || 0);
    setAssignedOperatorId(v.assignedOperatorId || '');
    setPhotoUrl(v.photoUrl || '');
  };

  const handleUpdateEquipment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle) return;

    const operator = users.find(u => u.id === assignedOperatorId);

    onUpdateVehicle(editingVehicle.id, {
      model,
      manufacturer,
      year,
      licensePlate: editingVehicle.category === 'VEICULO' ? licensePlate : editingVehicle.licensePlate,
      patrimonyCode: editingVehicle.category !== 'VEICULO' ? patrimonyCode : editingVehicle.patrimonyCode,
      sector,
      fuelType,
      tankCapacityLiters,
      currentKm: editingVehicle.category === 'VEICULO' ? currentKm : editingVehicle.currentKm,
      currentHourmeter: editingVehicle.category !== 'VEICULO' ? currentHourmeter : editingVehicle.currentHourmeter,
      assignedOperatorId: assignedOperatorId || undefined,
      assignedOperatorName: operator?.name,
      photoUrl: photoUrl || undefined,
    });

    setEditingVehicle(null);
  };

  const handlePrintBadge = async (v: Vehicle) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://andradeagro.app';
    const qrValue = `${origin}/#ficha-maquina/${v.id}`;
    const qrDataUrl = await generateQRCodeDataUrl(qrValue, 300);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Ficha do Equipamento QR - ${v.model}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; text-align: center; background: #ffffff; color: #0f172a; }
            .card { border: 3px solid #0f3822; padding: 20px; border-radius: 16px; max-width: 400px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            h1 { color: #0f3822; font-size: 22px; margin-bottom: 4px; font-weight: 900; }
            .tag { background: #d4af37; color: #000; font-weight: bold; padding: 4px 10px; border-radius: 6px; display: inline-block; margin: 8px 0; }
            .qr { margin: 16px 0; }
            .no-print { margin-top: 20px; display: flex; justify-content: center; gap: 10px; }
            .btn { padding: 10px 18px; font-size: 14px; font-weight: 700; border-radius: 8px; cursor: pointer; border: none; }
            .btn-print { background: #0f3822; color: #ffffff; }
            .btn-close { background: #e2e8f0; color: #0f172a; }
            @media print {
              body { padding: 0; }
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>AndradeAgro</h1>
            <p><strong>${v.model}</strong></p>
            <p class="tag">${v.licensePlate || v.patrimonyCode}</p>
            <div class="qr">
              <img id="qr-img" src="${qrDataUrl}" width="200" height="200" alt="QR Code" />
            </div>
            <p>Setor: ${getSectorName(v.sector)}</p>
            <p>Combustível: ${v.fuelType === 'NENHUM' ? 'Não se aplica' : `${v.tankCapacityLiters} Litros (${getFuelTypeName(v.fuelType)})`}</p>
          </div>

          <div class="no-print">
            <button class="btn btn-print" onclick="window.print()">🖨️ Imprimir</button>
            <button class="btn btn-close" onclick="window.close()">✕ Fechar</button>
          </div>

          <script>
            let hasPrinted = false;
            function triggerPrint() {
              if (hasPrinted) return;
              hasPrinted = true;
              setTimeout(function() {
                window.print();
              }, 300);
            }
            const img = document.getElementById('qr-img');
            if (img && img.complete) {
              triggerPrint();
            } else if (img) {
              img.onload = triggerPrint;
            } else {
              triggerPrint();
            }
          </script>
        </body>
      </html>
    `;

    openPrintWindow(htmlContent);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-emerald-100 flex items-center gap-2">
            <Truck className="w-6 h-6 text-amber-500" />
            Gestão de Frota, Tratores & Máquinas
          </h1>
          <p className="text-xs text-gray-500 dark:text-emerald-400">
            Cadastros completos, horímetros, odômetros, status de manutenção e QR Codes.
          </p>
        </div>

        {currentUser.role === 'ADMIN' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center gap-2 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Cadastrar Equipamento</span>
          </button>
        )}
      </div>

      {/* Category Tabs & Search */}
      <div className={`p-4 rounded-2xl border space-y-4 ${
        darkMode ? 'bg-emerald-950/40 border-emerald-900' : 'bg-white border-emerald-100'
      }`}>
        <div className="flex items-center gap-2 border-b border-emerald-800/20 pb-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab('VEICULO')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'VEICULO'
                ? 'bg-amber-500 text-gray-950 shadow-md'
                : 'text-gray-600 dark:text-emerald-300 hover:bg-emerald-500/10'
            }`}
          >
            Veículos com Placa ({vehicles.filter(v => v.category === 'VEICULO').length})
          </button>
          <button
            onClick={() => setActiveTab('TRATOR')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'TRATOR'
                ? 'bg-amber-500 text-gray-950 shadow-md'
                : 'text-gray-600 dark:text-emerald-300 hover:bg-emerald-500/10'
            }`}
          >
            Tratores ({vehicles.filter(v => v.category === 'TRATOR').length})
          </button>
          <button
            onClick={() => setActiveTab('MAQUINA_AGRICOLA')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'MAQUINA_AGRICOLA'
                ? 'bg-amber-500 text-gray-950 shadow-md'
                : 'text-gray-600 dark:text-emerald-300 hover:bg-emerald-500/10'
            }`}
          >
            Máquinas Agrícolas ({vehicles.filter(v => v.category === 'MAQUINA_AGRICOLA' || v.category === 'IMPLEMENTO').length})
          </button>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por modelo, fabricante ou código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 rounded-xl border outline-none ${
                darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 border-gray-200'
              }`}
            />
          </div>

          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className={`px-3 py-2 rounded-xl border outline-none ${
              darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 border-gray-200'
            }`}
          >
            <option value="ALL">Todos os Setores</option>
            <option value="PREPARO_SOLO">Preparo de Solo</option>
            <option value="COLHEITA">Colheita</option>
            <option value="PULVERIZACAO">Pulverização</option>
            <option value="AGRICOLA">Agrícola</option>
            <option value="LOGISTICA">Logística / Transporte</option>
            <option value="DIRETORIA">Diretoria</option>
            <option value="OFICINA_MANUTENCAO">Oficina</option>
          </select>
        </div>
      </div>

      {/* Equipment Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredVehicles.map(v => (
          <div
            key={v.id}
            className={`rounded-2xl border overflow-hidden flex flex-col transition-all hover:shadow-lg ${
              darkMode ? 'bg-emerald-950/50 border-emerald-900' : 'bg-white border-emerald-100 shadow-sm'
            }`}
          >
            {/* Image Banner */}
            <div className="h-40 relative bg-emerald-900/20 overflow-hidden">
              <img
                src={v.photoUrl || 'https://images.unsplash.com/photo-1592861956120-e524fc739696?w=600&auto=format&fit=crop&q=80'}
                alt={v.model}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 right-2 flex gap-1">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase shadow-md ${
                  v.status === 'ATIVO' 
                    ? 'bg-emerald-500 text-gray-950' 
                    : v.status === 'EM_MANUTENCAO' 
                    ? 'bg-amber-500 text-gray-950' 
                    : 'bg-red-500 text-white'
                }`}>
                  {v.status === 'EM_MANUTENCAO' ? 'Manutenção' : v.status}
                </span>
              </div>
              <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/20 text-white font-extrabold text-xs">
                {v.licensePlate || v.patrimonyCode}
              </div>
            </div>

            {/* Content Body */}
            <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
              <div>
                <p className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">
                  {v.manufacturer} • {v.year}
                </p>
                <h3 className="font-extrabold text-sm text-gray-900 dark:text-emerald-100 line-clamp-1">
                  {v.model}
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-emerald-300 font-medium mt-0.5">
                  Setor: <strong className="text-gray-800 dark:text-emerald-200">{getSectorName(v.sector)}</strong>
                </p>
              </div>

              {/* Specs Badge */}
              <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-emerald-400">Uso Atual:</span>
                  <strong className="text-emerald-800 dark:text-emerald-300">
                    {v.category === 'VEICULO' ? `${v.currentKm.toLocaleString('pt-BR')} km` : `${v.currentHourmeter || 0} horas`}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-emerald-400">Combustível / Tanque:</span>
                  <strong className="text-gray-800 dark:text-emerald-200">{v.fuelType === 'NENHUM' ? 'Não se aplica' : `${v.tankCapacityLiters}L (${getFuelTypeName(v.fuelType)})`}</strong>
                </div>
                {v.assignedOperatorName && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-emerald-400">Operador:</span>
                    <strong className="text-amber-600 dark:text-amber-400 truncate max-w-[110px]">{v.assignedOperatorName}</strong>
                  </div>
                )}
              </div>

              {/* Card Actions */}
              <div className="pt-2 border-t border-emerald-800/20 flex items-center justify-between gap-1 flex-wrap">
                <button
                  onClick={() => {
                    if (onOpenDigitalSheet) {
                      onOpenDigitalSheet(v);
                    } else {
                      setPassportVehicle(v);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" /> Ficha Digital
                </button>

                {v.fuelType !== 'NENHUM' && (
                  <button
                    onClick={() => onOpenFuelingModalWithEquipment(v.id)}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-gray-950 text-xs font-bold flex items-center gap-1 shadow-sm"
                  >
                    <Fuel className="w-3.5 h-3.5" /> Abastecer
                  </button>
                )}

                <button
                  onClick={() => handlePrintBadge(v)}
                  className="p-1.5 rounded-lg bg-gray-100 dark:bg-emerald-900/40 text-gray-600 dark:text-emerald-300"
                  title="Imprimir Emblema com QR Code"
                >
                  <QrCode className="w-4 h-4 text-amber-500" />
                </button>

                {currentUser.role === 'ADMIN' && (
                  <>
                    <button
                      onClick={() => handleOpenEditModal(v)}
                      className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-500"
                      title="Editar Equipamento"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Tem certeza que deseja excluir o equipamento "${v.model}" (${v.licensePlate || v.patrimonyCode})? Esta ação não pode ser desfeita.`)) {
                          onDeleteVehicle(v.id);
                        }
                      }}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400"
                      title="Excluir Equipamento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>

            </div>
          </div>
        ))}
      </div>

      {/* Equipment Passport Modal */}
      {passportVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className={`w-full max-w-2xl rounded-2xl shadow-2xl border p-5 max-h-[90vh] overflow-y-auto space-y-4 ${
            darkMode ? 'bg-emerald-950 border-emerald-800 text-emerald-100' : 'bg-white border-emerald-100 text-gray-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-emerald-800/20">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-amber-500" />
                <span className="font-bold text-sm">Passaporte / Ficha do Equipamento</span>
              </div>
              <button onClick={() => setPassportVehicle(null)} className="p-1 rounded-lg hover:bg-emerald-500/10">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* QR Code & Badge */}
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center flex flex-col items-center justify-center">
                <div className="p-2 bg-white rounded-xl border border-gray-200 shadow-sm flex items-center justify-center">
                  <QRCodeCanvas
                    value={`${typeof window !== 'undefined' ? window.location.origin : 'https://andradeagro.app'}/#ficha-maquina/${passportVehicle.id}`}
                    size={140}
                  />
                </div>
                <span className="mt-2 text-xs font-black text-amber-600 dark:text-amber-400 uppercase">
                  {passportVehicle.licensePlate || passportVehicle.patrimonyCode}
                </span>
                <button
                  onClick={() => handlePrintBadge(passportVehicle)}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-amber-500 text-gray-950 font-bold text-xs flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" /> Imprimir QR
                </button>
              </div>

              {/* Specs */}
              <div className="md:col-span-2 space-y-2 text-xs">
                <p className="text-base font-extrabold text-gray-900 dark:text-emerald-100">{passportVehicle.model}</p>
                <div className="grid grid-cols-2 gap-2 text-gray-600 dark:text-emerald-300">
                  <p><strong>Fabricante:</strong> {passportVehicle.manufacturer}</p>
                  <p><strong>Ano:</strong> {passportVehicle.year}</p>
                  <p><strong>Setor:</strong> {getSectorName(passportVehicle.sector)}</p>
                  <p><strong>Tanque:</strong> {passportVehicle.tankCapacityLiters} Litros</p>
                  <p><strong>Combustível:</strong> {getFuelTypeName(passportVehicle.fuelType)}</p>
                  <p><strong>Uso Atual:</strong> {passportVehicle.category === 'VEICULO' ? `${passportVehicle.currentKm} km` : `${passportVehicle.currentHourmeter || 0} h`}</p>
                  <p><strong>Operador:</strong> {passportVehicle.assignedOperatorName || 'Não atribuído'}</p>
                  <p><strong>Status:</strong> {passportVehicle.status}</p>
                </div>

                {passportVehicle.notes && (
                  <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-emerald-900/30 border text-[11px]">
                    <strong>Observações:</strong> {passportVehicle.notes}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end gap-2">
              <button
                onClick={() => setPassportVehicle(null)}
                className="px-4 py-2 rounded-xl bg-emerald-800 text-white font-bold text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Equipment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className={`w-full max-w-lg rounded-2xl shadow-2xl border p-5 space-y-4 max-h-[90vh] overflow-y-auto ${
            darkMode ? 'bg-emerald-950 border-emerald-800 text-emerald-100' : 'bg-white border-emerald-100 text-gray-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-emerald-800/20">
              <span className="font-bold text-sm">Cadastrar Novo Equipamento</span>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg hover:bg-emerald-500/10">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEquipment} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Modelo do Equipamento</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: John Deere 8370R / Hilux SRX..."
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Fabricante</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Toyota, John Deere..."
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Ano</label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value) || 2024)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                  />
                </div>
              </div>

              {activeTab === 'VEICULO' ? (
                <div>
                  <label className="block font-bold mb-1">Placa do Veículo</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: QAA-8J90"
                    value={licensePlate}
                    onChange={(e) => setLicensePlate(e.target.value)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-bold mb-1">Código de Patrimônio</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: TRAT-003 ou MAQ-005"
                    value={patrimonyCode}
                    onChange={(e) => setPatrimonyCode(e.target.value)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Setor Operacional</label>
                  <select
                    value={sector}
                    onChange={(e) => setSector(e.target.value as Sector)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                  >
                    <option value="PREPARO_SOLO">Preparo de Solo</option>
                    <option value="COLHEITA">Colheita</option>
                    <option value="PULVERIZACAO">Pulverização</option>
                    <option value="AGRICOLA">Agrícola</option>
                    <option value="LOGISTICA">Logística / Transporte</option>
                    <option value="DIRETORIA">Diretoria</option>
                    <option value="OFICINA_MANUTENCAO">Oficina</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1">Tipo de Combustível</label>
                  <select
                    value={fuelType}
                    onChange={(e) => {
                      const selected = e.target.value as FuelType;
                      setFuelType(selected);
                      if (selected === 'NENHUM') {
                        setTankCapacityLiters(0);
                      }
                    }}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                  >
                    <option value="DIESEL_S10">Diesel S10</option>
                    <option value="DIESEL_S500">Diesel S500</option>
                    <option value="GASOLINA_COMUM">Gasolina Comum</option>
                    <option value="GASOLINA_GRID">Gasolina Aditivada</option>
                    <option value="ETANOL">Etanol Hidratado</option>
                    <option value="ARLA_32">Arla 32</option>
                    <option value="NENHUM">Nenhum (Não se aplica)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Capacidade Tanque (L)</label>
                  <input
                    type="number"
                    value={tankCapacityLiters}
                    onChange={(e) => setTankCapacityLiters(parseInt(e.target.value) || 0)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">
                    {activeTab === 'VEICULO' ? 'Quilometragem Inicial (KM)' : 'Horímetro Inicial (Horas)'}
                  </label>
                  <input
                    type="number"
                    value={activeTab === 'VEICULO' ? currentKm : currentHourmeter}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      if (activeTab === 'VEICULO') setCurrentKm(val);
                      else setCurrentHourmeter(val);
                    }}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Operador Atribuído (Opcional)</label>
                <select
                  value={assignedOperatorId}
                  onChange={(e) => setAssignedOperatorId(e.target.value)}
                  className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                >
                  <option value="">Nenhum operador atribuído</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.department || u.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1">URL da Foto (Opcional)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-xl hover:bg-emerald-500/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 text-gray-950 font-bold"
                >
                  Cadastrar Equipamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Equipment Modal */}
      {editingVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className={`w-full max-w-lg rounded-2xl shadow-2xl border p-5 space-y-4 max-h-[90vh] overflow-y-auto ${
            darkMode ? 'bg-emerald-950 border-emerald-800 text-emerald-100' : 'bg-white border-emerald-100 text-gray-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-emerald-800/20">
              <span className="font-bold text-sm">Editar Equipamento: {editingVehicle.model}</span>
              <button onClick={() => setEditingVehicle(null)} className="p-1 rounded-lg hover:bg-emerald-500/10">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateEquipment} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Modelo do Equipamento</label>
                <input
                  type="text"
                  required
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Fabricante</label>
                  <input
                    type="text"
                    required
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Ano</label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value) || 2024)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                  />
                </div>
              </div>

              {editingVehicle.category === 'VEICULO' ? (
                <div>
                  <label className="block font-bold mb-1">Placa do Veículo</label>
                  <input
                    type="text"
                    required
                    value={licensePlate}
                    onChange={(e) => setLicensePlate(e.target.value)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-bold mb-1">Código de Patrimônio</label>
                  <input
                    type="text"
                    required
                    value={patrimonyCode}
                    onChange={(e) => setPatrimonyCode(e.target.value)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Setor Operacional</label>
                  <select
                    value={sector}
                    onChange={(e) => setSector(e.target.value as Sector)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                  >
                    <option value="PREPARO_SOLO">Preparo de Solo</option>
                    <option value="COLHEITA">Colheita</option>
                    <option value="PULVERIZACAO">Pulverização</option>
                    <option value="AGRICOLA">Agrícola</option>
                    <option value="LOGISTICA">Logística / Transporte</option>
                    <option value="DIRETORIA">Diretoria</option>
                    <option value="OFICINA_MANUTENCAO">Oficina</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1">Tipo de Combustível</label>
                  <select
                    value={fuelType}
                    onChange={(e) => {
                      const selected = e.target.value as FuelType;
                      setFuelType(selected);
                      if (selected === 'NENHUM') {
                        setTankCapacityLiters(0);
                      }
                    }}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                  >
                    <option value="DIESEL_S10">Diesel S10</option>
                    <option value="DIESEL_S500">Diesel S500</option>
                    <option value="GASOLINA_COMUM">Gasolina Comum</option>
                    <option value="GASOLINA_GRID">Gasolina Aditivada</option>
                    <option value="ETANOL">Etanol Hidratado</option>
                    <option value="ARLA_32">Arla 32</option>
                    <option value="NENHUM">Nenhum (Não se aplica)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Capacidade Tanque (L)</label>
                  <input
                    type="number"
                    value={tankCapacityLiters}
                    onChange={(e) => setTankCapacityLiters(parseInt(e.target.value) || 0)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">
                    {editingVehicle.category === 'VEICULO' ? 'Quilometragem (KM)' : 'Horímetro (Horas)'}
                  </label>
                  <input
                    type="number"
                    value={editingVehicle.category === 'VEICULO' ? currentKm : currentHourmeter}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      if (editingVehicle.category === 'VEICULO') setCurrentKm(val);
                      else setCurrentHourmeter(val);
                    }}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Operador Atribuído (Opcional)</label>
                <select
                  value={assignedOperatorId}
                  onChange={(e) => setAssignedOperatorId(e.target.value)}
                  className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                >
                  <option value="">Nenhum operador atribuído</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.department || u.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1">URL da Foto (Opcional)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingVehicle(null)}
                  className="px-3 py-1.5 rounded-xl hover:bg-emerald-500/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 text-gray-950 font-bold"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export const FleetManagementView = React.memo(FleetManagementViewComponent);
