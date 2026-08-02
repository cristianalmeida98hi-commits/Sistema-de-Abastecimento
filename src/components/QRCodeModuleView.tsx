import React, { useState, useMemo } from 'react';
import { 
  QrCode, Search, Filter, Printer, Download, Fuel, Truck, 
  CheckCircle2, Camera, Clock, Calendar, Shield, ExternalLink,
  RefreshCw, FileText, ArrowRight, User as UserIcon, Info
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { Vehicle, User, FuelLog, EquipmentCategory, Sector } from '../types';
import { formatCurrency, getFuelTypeName, getSectorName } from '../utils/calculations';

interface QRCodeModuleViewProps {
  vehicles: Vehicle[];
  fuelLogs: FuelLog[];
  currentUser: User;
  onOpenDigitalSheet?: (vehicle: Vehicle) => void;
  darkMode: boolean;
}

export const QRCodeModuleView: React.FC<QRCodeModuleViewProps> = ({
  vehicles,
  fuelLogs,
  currentUser,
  onOpenDigitalSheet,
  darkMode
}) => {
  const [activeTab, setActiveTab] = useState<'GENERATOR' | 'SCANNER'>('GENERATOR');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Selected Machine for Detailed QR Inspection & Scanned Result
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(vehicles[0] || null);

  // Scanner Simulator State
  const [scannedVehicleId, setScannedVehicleId] = useState<string>(vehicles[0]?.id || '');
  const [scanSuccessMessage, setScanSuccessMessage] = useState<string | null>(null);

  // Filtered vehicles list
  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      if (selectedCategory !== 'ALL' && v.category !== selectedCategory) return false;
      if (selectedSector !== 'ALL' && v.sector !== selectedSector) return false;
      if (search) {
        const q = search.toLowerCase();
        const m = v.model.toLowerCase().includes(q);
        const p = (v.licensePlate || v.patrimonyCode || '').toLowerCase().includes(q);
        const f = v.manufacturer.toLowerCase().includes(q);
        if (!m && !p && !f) return false;
      }
      return true;
    });
  }, [vehicles, selectedCategory, selectedSector, search]);

  // Up-to-date data for the currently selected/scanned vehicle
  const currentScannedVehicle = useMemo(() => {
    if (!selectedVehicle) return null;
    return vehicles.find(v => v.id === selectedVehicle.id) || selectedVehicle;
  }, [selectedVehicle, vehicles]);

  // Fueling history for the selected vehicle
  const selectedVehicleFuelLogs = useMemo(() => {
    if (!currentScannedVehicle) return [];
    return fuelLogs
      .filter(f => f.equipmentId === currentScannedVehicle.id)
      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
  }, [currentScannedVehicle, fuelLogs]);

  // Trigger Scanner Simulation
  const handleSimulateScan = (vehicleId: string) => {
    const v = vehicles.find(item => item.id === vehicleId);
    if (v) {
      setSelectedVehicle(v);
      if (onOpenDigitalSheet) {
        onOpenDigitalSheet(v);
      }
      setScanSuccessMessage(`Ficha Digital e Aba de Manutenção abertas para: ${v.model} (${v.licensePlate || v.patrimonyCode})`);
      setTimeout(() => setScanSuccessMessage(null), 4000);
    }
  };

  // Generate unique URL/ID link stored in QR Code
  const getVehicleQRCodeValue = (v: Vehicle) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://andradeagro.app';
    return `${origin}/#maintenance/${v.id}`;
  };

  // Print Badge for single machine
  const handlePrintBadge = (v: Vehicle) => {
    const printWin = window.open('', '_blank');
    if (!printWin) return;

    const qrValue = getVehicleQRCodeValue(v);

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Etiqueta QR Code - ${v.model}</title>
          <style>
            body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 20px; background: #f8fafc; text-align: center; }
            .card { background: #ffffff; border: 3px solid #064E3B; border-radius: 16px; padding: 24px; max-width: 380px; margin: 0 auto; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
            .header { color: #064E3B; font-size: 20px; font-weight: 900; letter-spacing: -0.5px; margin-bottom: 2px; }
            .sub { color: #d97706; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; }
            .qr-box { background: #ffffff; border: 2px solid #e2e8f0; border-radius: 12px; padding: 12px; display: inline-block; margin: 10px 0; }
            .code-badge { background: #064E3B; color: #FACC15; font-size: 16px; font-weight: 900; padding: 6px 14px; border-radius: 8px; display: inline-block; margin-top: 8px; }
            .meta { font-size: 12px; color: #334155; margin-top: 12px; text-align: left; background: #f1f5f9; padding: 10px; border-radius: 8px; }
            .meta p { margin: 4px 0; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">ANDRADEAGRO</div>
            <div class="sub">Identificação Oficial de Equipamento</div>
            <h2 style="font-size: 16px; margin: 6px 0; color: #0f172a;">${v.model}</h2>
            <div class="code-badge">${v.licensePlate || v.patrimonyCode}</div>
            
            <div class="qr-box">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrValue)}" width="180" height="180" alt="QR Code" />
            </div>

            <div class="meta">
              <p>📍 Setor: ${getSectorName(v.sector)}</p>
              <p>⛽ Tanque: ${v.tankCapacityLiters} Litros (${getFuelTypeName(v.fuelType)})</p>
              <p>🔑 ID Máquina: ${v.id}</p>
            </div>
          </div>
          <script>
            setTimeout(() => { window.print(); }, 500);
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  // Batch Print for all filtered machines
  const handleBatchPrint = () => {
    const printWin = window.open('', '_blank');
    if (!printWin) return;

    const cardsHtml = filteredVehicles.map(v => {
      const qrValue = getVehicleQRCodeValue(v);
      return `
        <div class="card">
          <div class="header">ANDRADEAGRO</div>
          <div class="sub">Identificação do Equipamento</div>
          <div class="model">${v.model}</div>
          <div class="code-badge">${v.licensePlate || v.patrimonyCode}</div>
          <div class="qr-box">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrValue)}" width="140" height="140" alt="QR" />
          </div>
          <div class="meta">Setor: ${getSectorName(v.sector)} • Cap: ${v.tankCapacityLiters}L</div>
        </div>
      `;
    }).join('');

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Impressão em Lote - QR Codes AndradeAgro</title>
          <style>
            body { font-family: sans-serif; padding: 20px; background: #fff; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
            .card { border: 2px solid #064E3B; border-radius: 12px; padding: 16px; text-align: center; page-break-inside: avoid; }
            .header { color: #064E3B; font-weight: 900; font-size: 16px; }
            .sub { color: #d97706; font-size: 10px; font-weight: 800; text-transform: uppercase; }
            .model { font-weight: 800; font-size: 14px; margin: 4px 0; }
            .code-badge { background: #064E3B; color: #FACC15; font-weight: 900; font-size: 14px; padding: 4px 8px; border-radius: 6px; display: inline-block; margin: 4px 0; }
            .qr-box { margin: 8px 0; }
            .meta { font-size: 11px; color: #475569; font-weight: 600; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h1 style="text-align: center; color: #064E3B; font-size: 20px;">Catálogo de QR Codes de Frota & Máquinas (${filteredVehicles.length})</h1>
          <div class="grid">${cardsHtml}</div>
          <script>
            setTimeout(() => { window.print(); }, 800);
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className={`p-6 rounded-3xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${
        darkMode ? 'bg-[#042d23] border-emerald-900/60 text-slate-100' : 'bg-white border-slate-100'
      }`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#064E3B] text-[#FACC15]">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Módulo Integrado de QR Code
              </h1>
              <p className="text-xs text-slate-600 dark:text-emerald-200 font-medium">
                Gere e gerencie QR Codes exclusivos com ID/Link para cada máquina e consulte o cadastro e histórico em tempo real.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('GENERATOR')}
            className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all ${
              activeTab === 'GENERATOR'
                ? 'bg-[#064E3B] text-white shadow-md'
                : 'bg-slate-100 dark:bg-emerald-950 text-slate-700 dark:text-emerald-200 hover:bg-slate-200'
            }`}
          >
            <QrCode className="w-4 h-4 text-[#FACC15]" />
            <span>Gerador & Etiquetas</span>
          </button>

          <button
            onClick={() => setActiveTab('SCANNER')}
            className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all ${
              activeTab === 'SCANNER'
                ? 'bg-[#064E3B] text-white shadow-md'
                : 'bg-slate-100 dark:bg-emerald-950 text-slate-700 dark:text-emerald-200 hover:bg-slate-200'
            }`}
          >
            <Camera className="w-4 h-4 text-[#FACC15]" />
            <span>Leitor / Leitura de QR</span>
          </button>
        </div>
      </div>

      {scanSuccessMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{scanSuccessMessage}</span>
        </div>
      )}

      {/* Main Container Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: List & Filters (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className={`p-5 rounded-3xl border shadow-sm space-y-4 ${
            darkMode ? 'bg-[#042d23] border-emerald-900/60' : 'bg-white border-slate-100'
          }`}>
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#064E3B] dark:text-[#FACC15]" />
                <span>Máquinas & Veículos Cadastrados ({filteredVehicles.length})</span>
              </h2>

              <button
                onClick={handleBatchPrint}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir Todos em Lote</span>
              </button>
            </div>

            {/* Filter controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filtrar por modelo, código..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={`w-full pl-8 pr-3 py-2 rounded-xl border text-xs outline-none ${
                    darkMode ? 'bg-emerald-950 border-emerald-800 text-slate-100' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className={`px-3 py-2 rounded-xl border text-xs outline-none ${
                  darkMode ? 'bg-emerald-950 border-emerald-800 text-slate-100' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <option value="ALL">Todas Categorias</option>
                <option value="VEICULO">Veículos com Placa</option>
                <option value="TRATOR">Tratores</option>
                <option value="MAQUINA_AGRICOLA">Máquinas Agrícolas</option>
              </select>

              <select
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className={`px-3 py-2 rounded-xl border text-xs outline-none ${
                  darkMode ? 'bg-emerald-950 border-emerald-800 text-slate-100' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <option value="ALL">Todos os Setores</option>
                <option value="PREPARO_SOLO">Preparo de Solo</option>
                <option value="COLHEITA">Colheita</option>
                <option value="PULVERIZACAO">Pulverização</option>
                <option value="AGRICOLA">Agrícola</option>
                <option value="LOGISTICA">Logística</option>
              </select>
            </div>

            {/* Equipment Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[580px] overflow-y-auto pr-1">
              {filteredVehicles.map(v => {
                const isSelected = selectedVehicle?.id === v.id;
                const qrVal = getVehicleQRCodeValue(v);

                return (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVehicle(v)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-[#064E3B] dark:border-[#FACC15] bg-emerald-50 dark:bg-emerald-900/30 ring-2 ring-[#064E3B]/20'
                        : darkMode ? 'bg-emerald-950/40 border-emerald-900 hover:border-emerald-700' : 'bg-slate-50 border-slate-200/80 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-white p-1 border shadow-xs shrink-0 flex items-center justify-center">
                        <QRCodeCanvas key={v.id} value={qrVal} size={40} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                          {v.manufacturer}
                        </p>
                        <h3 className="font-extrabold text-xs text-slate-900 dark:text-slate-100 truncate">
                          {v.model}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-black text-[#064E3B] dark:text-[#FACC15] bg-[#064E3B]/10 dark:bg-[#FACC15]/10 px-1.5 py-0.5 rounded">
                            {v.licensePlate || v.patrimonyCode}
                          </span>
                          <span className="text-[10px] text-slate-500 truncate">
                            {getSectorName(v.sector)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePrintBadge(v);
                      }}
                      className="p-2 rounded-xl bg-white dark:bg-emerald-900 border text-slate-700 dark:text-emerald-200 hover:bg-amber-50 dark:hover:bg-emerald-800 transition-colors shrink-0"
                      title="Imprimir QR Code"
                    >
                      <Printer className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Detailed QR Inspector, Scanned Profile & Fueling History (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Active Equipment Inspection Card */}
          {currentScannedVehicle ? (
            <div className={`p-6 rounded-3xl border shadow-sm space-y-5 ${
              darkMode ? 'bg-[#042d23] border-emerald-900/60' : 'bg-white border-slate-100'
            }`}>
              
              {/* Header Profile */}
              <div className="flex items-center justify-between border-b pb-4 border-slate-100 dark:border-emerald-900">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl overflow-hidden bg-slate-100 border shrink-0">
                    <img
                      src={currentScannedVehicle.photoUrl || 'https://images.unsplash.com/photo-1592861956120-e524fc739696?w=600&auto=format&fit=crop&q=80'}
                      alt={currentScannedVehicle.model}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                      {currentScannedVehicle.licensePlate || currentScannedVehicle.patrimonyCode}
                    </span>
                    <h2 className="font-black text-base text-slate-900 dark:text-slate-100 mt-1">
                      {currentScannedVehicle.model}
                    </h2>
                  </div>
                </div>

                <button
                  onClick={() => handlePrintBadge(currentScannedVehicle)}
                  className="p-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir</span>
                </button>
              </div>

              {/* QR Code Visual Representation */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-emerald-950/60 border border-slate-200/80 dark:border-emerald-900/40 flex flex-col items-center justify-center text-center space-y-2">
                <div className="p-3 bg-white rounded-2xl border shadow-md">
                  <QRCodeCanvas key={currentScannedVehicle.id} value={getVehicleQRCodeValue(currentScannedVehicle)} size={160} />
                </div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-emerald-300 break-all max-w-xs">
                  Link Armazenado: <strong className="text-slate-800 dark:text-slate-200">{getVehicleQRCodeValue(currentScannedVehicle)}</strong>
                </p>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-emerald-950/50 border">
                  <span className="text-slate-500 text-[10px] block">Setor:</span>
                  <strong className="text-slate-900 dark:text-slate-100">{getSectorName(currentScannedVehicle.sector)}</strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-emerald-950/50 border">
                  <span className="text-slate-500 text-[10px] block">Combustível / Tanque:</span>
                  <strong className="text-slate-900 dark:text-slate-100">
                    {getFuelTypeName(currentScannedVehicle.fuelType)} ({currentScannedVehicle.tankCapacityLiters}L)
                  </strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-emerald-950/50 border">
                  <span className="text-slate-500 text-[10px] block">Uso / Odômetro / Horímetro:</span>
                  <strong className="text-slate-900 dark:text-slate-100">
                    {currentScannedVehicle.category === 'VEICULO'
                      ? `${currentScannedVehicle.currentKm.toLocaleString('pt-BR')} km`
                      : `${currentScannedVehicle.currentHourmeter || 0} horas`}
                  </strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-emerald-950/50 border">
                  <span className="text-slate-500 text-[10px] block">Operador Atribuído:</span>
                  <strong className="text-amber-600 dark:text-amber-400">
                    {currentScannedVehicle.assignedOperatorName || 'Nenhum'}
                  </strong>
                </div>
              </div>

              {/* Notice Banner */}
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
                <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <p>
                  <strong>📌 Ficha Digital & Manutenção:</strong> O QR Code da máquina direciona diretamente para a aba de manutenção com o histórico de trocas de óleo, preventivas e registros técnicos. Os abastecimentos são efetuados via tablet operacional.
                </p>
              </div>

              {/* ACTION: Open digital sheet */}
              <div className="space-y-2 pt-1">
                {onOpenDigitalSheet && (
                  <button
                    onClick={() => onOpenDigitalSheet(currentScannedVehicle)}
                    className="w-full py-3.5 rounded-2xl bg-[#064E3B] hover:bg-[#043d2e] text-[#FACC15] font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-[0.99]"
                  >
                    <FileText className="w-4 h-4 text-[#FACC15]" />
                    <span>📄 ABRIR FICHA DIGITAL & ABA DE MANUTENÇÃO DA MÁQUINA</span>
                  </button>
                )}
              </div>

            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 border border-dashed rounded-3xl">
              Selecione uma máquina para visualizar o QR Code e histórico.
            </div>
          )}

          {/* Quick Scanner Simulator Panel (if tab SCANNER selected or bottom panel) */}
          {activeTab === 'SCANNER' && (
            <div className={`p-5 rounded-3xl border shadow-sm space-y-4 ${
              darkMode ? 'bg-[#042d23] border-emerald-900/60' : 'bg-white border-slate-100'
            }`}>
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-amber-500" />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                  Simulador de Leitura por Câmera / Leitor
                </h3>
              </div>

              <p className="text-xs text-slate-600 dark:text-emerald-200">
                Selecione o equipamento escaneado pelo operador para buscar automaticamente os dados atualizados do banco de dados:
              </p>

              <div className="space-y-3">
                <select
                  value={scannedVehicleId}
                  onChange={(e) => setScannedVehicleId(e.target.value)}
                  className={`w-full p-3 rounded-2xl border text-xs font-bold outline-none ${
                    darkMode ? 'bg-emerald-950 border-emerald-800 text-slate-100' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      [{v.category}] {v.model} ({v.licensePlate || v.patrimonyCode})
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => handleSimulateScan(scannedVehicleId)}
                  className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Escanear & Buscar Dados Atualizados</span>
                </button>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
