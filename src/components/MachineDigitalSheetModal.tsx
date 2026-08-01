import React, { useState, useMemo } from 'react';
import { 
  X, Truck, Fuel, Wrench, AlertTriangle, CheckCircle2, Clock, 
  Calendar, FileText, User as UserIcon, BarChart3, Shield, Filter, 
  PlusCircle, RefreshCw, AlertCircle, Camera, Check, ChevronRight,
  TrendingUp, Award, Layers, Sparkles
} from 'lucide-react';
import { 
  Vehicle, FuelLog, MaintenanceLog, MachineIssue, 
  PreventiveMaintenanceItem, PreventiveItemKey, User 
} from '../types';
import { formatCurrency, getFuelTypeName, getSectorName } from '../utils/calculations';
import { ReportProblemModal } from './ReportProblemModal';

interface MachineDigitalSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: Vehicle;
  fuelLogs: FuelLog[];
  maintenanceLogs: MaintenanceLog[];
  machineIssues: MachineIssue[];
  preventiveItems: PreventiveMaintenanceItem[];
  currentUser: User;
  onOpenFuelingModalWithEquipment: (equipmentId: string) => void;
  onReportProblemSubmit: (issueData: Omit<MachineIssue, 'id' | 'dateTime' | 'status'>) => void;
  onRecordPreventiveService: (equipmentId: string, itemKey: PreventiveItemKey, currentHourmeter: number, notes?: string) => void;
  onResolveIssue?: (issueId: string) => void;
  onUpdateVehicleStatus?: (vehicleId: string, newStatus: 'ATIVO' | 'EM_MANUTENCAO' | 'INATIVO') => void;
  darkMode: boolean;
}

export const MachineDigitalSheetModal: React.FC<MachineDigitalSheetModalProps> = ({
  isOpen,
  onClose,
  vehicle,
  fuelLogs = [],
  maintenanceLogs = [],
  machineIssues = [],
  preventiveItems = [],
  currentUser,
  onOpenFuelingModalWithEquipment,
  onReportProblemSubmit,
  onRecordPreventiveService,
  onResolveIssue,
  onUpdateVehicleStatus,
  darkMode
}) => {
  if (!isOpen || !vehicle) return null;

  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'PREVENTIVE' | 'TIMELINE' | 'ISSUES'>('OVERVIEW');
  const [isReportProblemOpen, setIsReportProblemOpen] = useState(false);
  const [recordingItem, setRecordingItem] = useState<PreventiveMaintenanceItem | null>(null);
  const [recordHourmeter, setRecordHourmeter] = useState<number>(vehicle.currentHourmeter || vehicle.currentKm || 0);
  const [recordNotes, setRecordNotes] = useState<string>('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Machine Specific Data Filters
  const machineFuelLogs = useMemo(() => {
    return fuelLogs
      .filter(f => f.equipmentId === vehicle.id)
      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
  }, [fuelLogs, vehicle.id]);

  const machineMaintenanceLogs = useMemo(() => {
    return maintenanceLogs
      .filter(m => m.equipmentId === vehicle.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [maintenanceLogs, vehicle.id]);

  const machineReportedIssues = useMemo(() => {
    return machineIssues
      .filter(i => i.equipmentId === vehicle.id)
      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
  }, [machineIssues, vehicle.id]);

  const machinePreventiveItems = useMemo(() => {
    return preventiveItems.filter(p => p.equipmentId === vehicle.id);
  }, [preventiveItems, vehicle.id]);

  // Monthly KPIs Calculations
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthFuelLogs = useMemo(() => {
    return machineFuelLogs.filter(f => f.dateTime.startsWith(currentMonth));
  }, [machineFuelLogs, currentMonth]);

  const litersConsumedMonth = useMemo(() => {
    return monthFuelLogs.reduce((sum, f) => sum + f.liters, 0);
  }, [monthFuelLogs]);

  const totalSpentMonth = useMemo(() => {
    return monthFuelLogs.reduce((sum, f) => sum + f.totalValue, 0);
  }, [monthFuelLogs]);

  const averageConsumption = useMemo(() => {
    if (machineFuelLogs.length === 0) return 0;
    const isKm = vehicle.category === 'VEICULO';
    if (isKm) {
      const logsWithAvg = machineFuelLogs.filter(l => l.calculatedAverageKmPerLiter && l.calculatedAverageKmPerLiter > 0);
      if (logsWithAvg.length === 0) return 3.2; // default km/L estimate
      return logsWithAvg.reduce((sum, l) => sum + (l.calculatedAverageKmPerLiter || 0), 0) / logsWithAvg.length;
    } else {
      const logsWithAvg = machineFuelLogs.filter(l => l.calculatedAverageLitersPerHour && l.calculatedAverageLitersPerHour > 0);
      if (logsWithAvg.length === 0) return 18.5; // default L/h estimate
      return logsWithAvg.reduce((sum, l) => sum + (l.calculatedAverageLitersPerHour || 0), 0) / logsWithAvg.length;
    }
  }, [machineFuelLogs, vehicle.category]);

  const lastFueling = machineFuelLogs[0] || null;
  const lastMaintenance = machineMaintenanceLogs[0] || null;

  // Preventive Maintenance Status Analyzer
  const currentMeter = vehicle.currentHourmeter || vehicle.currentKm || 0;

  const getPreventiveStatus = (item: PreventiveMaintenanceItem) => {
    const hoursRemaining = item.nextScheduledHourmeter - currentMeter;
    if (hoursRemaining <= 0) {
      return { status: 'RED', label: 'Atrasada', color: 'bg-red-500 text-white', hoursRemaining };
    }
    if (hoursRemaining <= 50) {
      return { status: 'YELLOW', label: 'Próxima', color: 'bg-amber-500 text-slate-950', hoursRemaining };
    }
    return { status: 'GREEN', label: 'Em Dia', color: 'bg-emerald-600 text-white', hoursRemaining };
  };

  // Automated Machine Alerts
  const machineAlerts = useMemo(() => {
    const alerts: { title: string; desc: string; type: 'RED' | 'YELLOW' | 'BLUE' }[] = [];

    // Check overdue maintenance
    machinePreventiveItems.forEach(item => {
      const st = getPreventiveStatus(item);
      if (st.status === 'RED') {
        alerts.push({
          title: `Manutenção Vencida: ${item.itemName}`,
          desc: `Horímetro atual (${currentMeter}h) ultrapassou o limite agendado de ${item.nextScheduledHourmeter}h.`,
          type: 'RED'
        });
      } else if (st.status === 'YELLOW') {
        alerts.push({
          title: `Atenção: ${item.itemName} próxima do limite`,
          desc: `Faltam apenas ${st.hoursRemaining} horas para a próxima troca programada.`,
          type: 'YELLOW'
        });
      }
    });

    // Check open reported issues
    const openIssues = machineReportedIssues.filter(i => i.status === 'ABERTO');
    if (openIssues.length > 0) {
      alerts.push({
        title: `Existe(m) ${openIssues.length} problema(s) relatado(s) em aberto`,
        desc: `Verifique os relatos dos operadores na aba de problemas.`,
        type: 'RED'
      });
    }

    // Check if idle machine
    if (vehicle.status === 'INATIVO') {
      alerts.push({
        title: 'Máquina Inativa / Parada por muito tempo',
        desc: 'Verifique o planejamento do setor para otimizar o uso do equipamento.',
        type: 'BLUE'
      });
    } else if (vehicle.status === 'EM_MANUTENCAO') {
      alerts.push({
        title: 'Máquina Atualmente em Manutenção',
        desc: 'Equipamento marcado como indisponível no setor de frotas.',
        type: 'YELLOW'
      });
    }

    return alerts;
  }, [machinePreventiveItems, currentMeter, machineReportedIssues, vehicle.status]);

  // Combined Unified Timeline
  const combinedTimeline = useMemo(() => {
    const timeline: {
      id: string;
      type: 'FUEL' | 'MAINTENANCE' | 'ISSUE' | 'PROFILE';
      date: string;
      user: string;
      title: string;
      description: string;
      value?: string;
      photoUrl?: string;
    }[] = [];

    machineFuelLogs.forEach(f => {
      timeline.push({
        id: f.id,
        type: 'FUEL',
        date: f.dateTime,
        user: f.driverOrOperatorName,
        title: `Abastecimento (${f.liters} Litros)`,
        description: `Operação: ${f.operationType || 'Agrícola'} • Atividade: ${f.activityType || 'Padrão'} • ${f.gasStationName}`,
        value: formatCurrency(f.totalValue),
        photoUrl: f.dashboardPhotoUrl
      });
    });

    machineMaintenanceLogs.forEach(m => {
      timeline.push({
        id: m.id,
        type: 'MAINTENANCE',
        date: m.date,
        user: m.performedBy || 'Oficina',
        title: `Manutenção: ${m.title}`,
        description: `${m.description} (${m.supplierOrWorkshop})`,
        value: m.cost > 0 ? formatCurrency(m.cost) : 'Preventiva',
      });
    });

    machineReportedIssues.forEach(i => {
      timeline.push({
        id: i.id,
        type: 'ISSUE',
        date: i.dateTime,
        user: i.reportedByUserName,
        title: `Problema Relatado: ${i.status}`,
        description: i.description,
        photoUrl: i.photoUrl
      });
    });

    return timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [machineFuelLogs, machineMaintenanceLogs, machineReportedIssues]);

  const handleRecordSubmit = () => {
    if (!recordingItem) return;
    onRecordPreventiveService(vehicle.id, recordingItem.itemKey, recordHourmeter, recordNotes);
    setActionSuccessMsg(`Manutenção de "${recordingItem.itemName}" gravada com sucesso!`);
    setRecordingItem(null);
    setRecordNotes('');
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className={`w-full max-w-4xl rounded-3xl shadow-2xl border p-4 sm:p-6 space-y-5 max-h-[95vh] overflow-y-auto ${
        darkMode ? 'bg-[#042d23] border-emerald-900 text-slate-100' : 'bg-white border-slate-100 text-slate-900'
      }`}>
        
        {/* Top Navigation & Close Header */}
        <div className="flex items-center justify-between border-b pb-3 border-emerald-800/20">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#064E3B] text-[#FACC15]">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider">
                AndradeAgro • Ficha Digital em Tempo Real
              </span>
              <h2 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                Ficha Digital da Máquina
              </h2>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-2xl bg-slate-100 dark:bg-emerald-900/60 hover:bg-slate-200 text-slate-700 dark:text-emerald-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {actionSuccessMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in slide-in-from-top-1">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        {/* 1. Main Machine Profile Card */}
        <div className={`p-5 rounded-3xl border shadow-sm space-y-4 ${
          darkMode ? 'bg-emerald-950/50 border-emerald-900' : 'bg-slate-50 border-slate-200/80'
        }`}>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white border-2 border-[#064E3B] shrink-0 shadow-md">
                <img
                  src={vehicle.photoUrl || 'https://images.unsplash.com/photo-1592861956120-e524fc739696?w=600&auto=format&fit=crop&q=80'}
                  alt={vehicle.model}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase bg-[#064E3B] text-[#FACC15] px-2.5 py-0.5 rounded-lg">
                    {vehicle.licensePlate || vehicle.patrimonyCode || vehicle.id}
                  </span>
                  
                  {/* Status selector or badge */}
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                      vehicle.status === 'ATIVO' 
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                        : vehicle.status === 'EM_MANUTENCAO'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                    }`}>
                      {vehicle.status === 'ATIVO' ? '🟢 ATIVA' : vehicle.status === 'EM_MANUTENCAO' ? '🟡 EM MANUTENÇÃO' : '🔴 PARADA / INATIVA'}
                    </span>

                    {onUpdateVehicleStatus && (
                      <select
                        value={vehicle.status}
                        onChange={(e) => onUpdateVehicleStatus(vehicle.id, e.target.value as any)}
                        className={`text-[10px] font-bold py-0.5 px-1 rounded-md border outline-none cursor-pointer ${
                          darkMode ? 'bg-emerald-900 border-emerald-700 text-white' : 'bg-white border-slate-200'
                        }`}
                      >
                        <option value="ATIVO">Mudar p/ Ativa</option>
                        <option value="EM_MANUTENCAO">Mudar p/ Em Manutenção</option>
                        <option value="INATIVO">Mudar p/ Parada</option>
                      </select>
                    )}
                  </div>
                </div>

                <h1 className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1 truncate">
                  {vehicle.model}
                </h1>
                
                <p className="text-xs text-slate-500 dark:text-emerald-300 font-medium truncate">
                  {vehicle.manufacturer} • Ano {vehicle.year} • Setor: <strong>{getSectorName(vehicle.sector)}</strong>
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              <button
                onClick={() => {
                  onClose();
                  onOpenFuelingModalWithEquipment(vehicle.id);
                }}
                className="flex-1 md:flex-initial px-4 py-3 rounded-2xl bg-[#064E3B] hover:bg-[#043d2e] text-[#FACC15] font-black text-xs flex items-center justify-center gap-2 shadow-md transition-transform active:scale-95"
              >
                <Fuel className="w-4 h-4 fill-[#FACC15]" />
                <span>Novo Abastecimento</span>
              </button>

              <button
                onClick={() => setIsReportProblemOpen(true)}
                className="flex-1 md:flex-initial px-4 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition-transform active:scale-95"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Informar Problema</span>
              </button>
            </div>

          </div>

          {/* Machine Spec Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
            <div className="p-2.5 rounded-2xl bg-white dark:bg-emerald-900/60 border">
              <span className="text-[10px] text-slate-500 block">Horímetro / KM Atual:</span>
              <strong className="text-slate-900 dark:text-slate-100 text-sm">
                {vehicle.category === 'VEICULO' 
                  ? `${vehicle.currentKm.toLocaleString('pt-BR')} km`
                  : `${vehicle.currentHourmeter || 0} Horas`}
              </strong>
            </div>

            <div className="p-2.5 rounded-2xl bg-white dark:bg-emerald-900/60 border">
              <span className="text-[10px] text-slate-500 block">Tanque / Combustível:</span>
              <strong className="text-slate-900 dark:text-slate-100">
                {vehicle.tankCapacityLiters}L ({getFuelTypeName(vehicle.fuelType)})
              </strong>
            </div>

            <div className="p-2.5 rounded-2xl bg-white dark:bg-emerald-900/60 border">
              <span className="text-[10px] text-slate-500 block">Operador Responsável:</span>
              <strong className="text-amber-600 dark:text-amber-400">
                {vehicle.assignedOperatorName || 'Não atribuído'}
              </strong>
            </div>

            <div className="p-2.5 rounded-2xl bg-white dark:bg-emerald-900/60 border">
              <span className="text-[10px] text-slate-500 block">Código Patrimônio:</span>
              <strong className="text-slate-900 dark:text-slate-100">
                {vehicle.patrimonyCode || vehicle.licensePlate || 'PAT-00'}
              </strong>
            </div>
          </div>
        </div>

        {/* 2. Automated Live Machine Alerts */}
        {machineAlerts.length > 0 && (
          <div className="space-y-2">
            {machineAlerts.map((alt, idx) => (
              <div 
                key={idx}
                className={`p-3 rounded-2xl border text-xs flex items-start gap-3 ${
                  alt.type === 'RED'
                    ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
                    : alt.type === 'YELLOW'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200'
                      : 'bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-200'
                }`}
              >
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-extrabold block">{alt.title}</strong>
                  <span className="text-[11px] opacity-90">{alt.desc}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 3. Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200 dark:border-emerald-900/60 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`px-4 py-2.5 rounded-2xl font-extrabold whitespace-nowrap flex items-center gap-2 transition-all ${
              activeTab === 'OVERVIEW'
                ? 'bg-[#064E3B] text-white shadow-sm'
                : 'text-slate-600 dark:text-emerald-300 hover:bg-slate-100 dark:hover:bg-emerald-900/40'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-[#FACC15]" />
            <span>Relatório & Indicadores</span>
          </button>

          <button
            onClick={() => setActiveTab('PREVENTIVE')}
            className={`px-4 py-2.5 rounded-2xl font-extrabold whitespace-nowrap flex items-center gap-2 transition-all ${
              activeTab === 'PREVENTIVE'
                ? 'bg-[#064E3B] text-white shadow-sm'
                : 'text-slate-600 dark:text-emerald-300 hover:bg-slate-100 dark:hover:bg-emerald-900/40'
            }`}
          >
            <Wrench className="w-4 h-4 text-[#FACC15]" />
            <span>Manutenção Preventiva ({machinePreventiveItems.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('TIMELINE')}
            className={`px-4 py-2.5 rounded-2xl font-extrabold whitespace-nowrap flex items-center gap-2 transition-all ${
              activeTab === 'TIMELINE'
                ? 'bg-[#064E3B] text-white shadow-sm'
                : 'text-slate-600 dark:text-emerald-300 hover:bg-slate-100 dark:hover:bg-emerald-900/40'
            }`}
          >
            <Clock className="w-4 h-4 text-[#FACC15]" />
            <span>Histórico / Linha do Tempo</span>
          </button>

          <button
            onClick={() => setActiveTab('ISSUES')}
            className={`px-4 py-2.5 rounded-2xl font-extrabold whitespace-nowrap flex items-center gap-2 transition-all ${
              activeTab === 'ISSUES'
                ? 'bg-[#064E3B] text-white shadow-sm'
                : 'text-slate-600 dark:text-emerald-300 hover:bg-slate-100 dark:hover:bg-emerald-900/40'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-[#FACC15]" />
            <span>Problemas Relatados ({machineReportedIssues.length})</span>
          </button>
        </div>

        {/* TAB 1: OVERVIEW & MONTHLY REPORT */}
        {activeTab === 'OVERVIEW' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#064E3B] dark:text-[#FACC15]" />
                <span>Resumo do Mês Atual (Métricas da Máquina)</span>
              </h3>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-md">
                {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 space-y-1">
                <span className="text-[10px] text-slate-500 font-bold block uppercase">Litros no Mês:</span>
                <strong className="text-xl font-black text-[#064E3B] dark:text-[#FACC15]">
                  {litersConsumedMonth.toLocaleString('pt-BR')} L
                </strong>
                <p className="text-[10px] text-slate-500">{monthFuelLogs.length} abastecimento(s)</p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 space-y-1">
                <span className="text-[10px] text-slate-500 font-bold block uppercase">Valor Gasto no Mês:</span>
                <strong className="text-xl font-black text-slate-900 dark:text-slate-100">
                  {formatCurrency(totalSpentMonth)}
                </strong>
                <p className="text-[10px] text-slate-500">Custo operacional</p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 space-y-1">
                <span className="text-[10px] text-slate-500 font-bold block uppercase">Média de Consumo:</span>
                <strong className="text-xl font-black text-amber-600 dark:text-amber-400">
                  {averageConsumption.toFixed(1)} {vehicle.category === 'VEICULO' ? 'km/L' : 'L/h'}
                </strong>
                <p className="text-[10px] text-slate-500">Média calculada</p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 space-y-1">
                <span className="text-[10px] text-slate-500 font-bold block uppercase">Horas / KM Atual:</span>
                <strong className="text-xl font-black text-slate-900 dark:text-slate-100">
                  {vehicle.category === 'VEICULO' ? `${vehicle.currentKm} km` : `${vehicle.currentHourmeter || 0} h`}
                </strong>
                <p className="text-[10px] text-slate-500">Horímetro acumulado</p>
              </div>
            </div>

            {/* Last Fueling & Last Maintenance quick cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-emerald-950/40 border space-y-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Fuel className="w-4 h-4 text-[#064E3B] dark:text-[#FACC15]" />
                    <span>Último Abastecimento</span>
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {lastFueling ? new Date(lastFueling.dateTime).toLocaleDateString('pt-BR') : 'Sem registros'}
                  </span>
                </div>
                {lastFueling ? (
                  <div className="space-y-1">
                    <p className="font-bold text-slate-900 dark:text-slate-100">{lastFueling.liters} Litros • {formatCurrency(lastFueling.totalValue)}</p>
                    <p className="text-[11px] text-slate-500">Operador: {lastFueling.driverOrOperatorName}</p>
                    <p className="text-[11px] text-slate-500">Posto: {lastFueling.gasStationName}</p>
                  </div>
                ) : (
                  <p className="text-slate-400">Nenhum abastecimento gravado.</p>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-emerald-950/40 border space-y-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-amber-500" />
                    <span>Última Manutenção</span>
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {lastMaintenance ? new Date(lastMaintenance.date).toLocaleDateString('pt-BR') : 'Sem registros'}
                  </span>
                </div>
                {lastMaintenance ? (
                  <div className="space-y-1">
                    <p className="font-bold text-slate-900 dark:text-slate-100">{lastMaintenance.title}</p>
                    <p className="text-[11px] text-slate-500">Técnico: {lastMaintenance.performedBy} ({lastMaintenance.supplierOrWorkshop})</p>
                    <p className="text-[11px] text-slate-500">Horímetro: {lastMaintenance.kmOrHourAtService}h</p>
                  </div>
                ) : (
                  <p className="text-slate-400">Nenhuma manutenção gravada.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CONTROLE DE MANUTENÇÃO PREVENTIVA */}
        {activeTab === 'PREVENTIVE' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                  Controle de Manutenção Preventiva
                </h3>
                <p className="text-[11px] text-slate-500">
                  Horímetro Atual: <strong>{currentMeter} Horas</strong>
                </p>
              </div>
            </div>

            {/* List of 7 standard items */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {machinePreventiveItems.map(item => {
                const st = getPreventiveStatus(item);
                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border space-y-3 relative overflow-hidden transition-all ${
                      darkMode ? 'bg-emerald-950/50 border-emerald-900' : 'bg-slate-50 border-slate-200/90'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {item.itemKey.replace('_', ' ')}
                        </span>
                        <h4 className="font-extrabold text-xs text-slate-900 dark:text-slate-100">
                          {item.itemName}
                        </h4>
                      </div>

                      <span className={`px-2.5 py-1 rounded-xl font-black text-[10px] uppercase shrink-0 ${st.color}`}>
                        {st.label}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-500">Último Serviço:</span>
                        <strong className="text-slate-800 dark:text-emerald-200">{item.lastServiceHourmeter}h ({new Date(item.lastServiceDate).toLocaleDateString('pt-BR')})</strong>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-500">Próxima Troca:</span>
                        <strong className="text-slate-800 dark:text-emerald-200">{item.nextScheduledHourmeter}h</strong>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-500">Horas Faltantes:</span>
                        <strong className={st.hoursRemaining <= 0 ? 'text-red-500 font-black' : st.hoursRemaining <= 50 ? 'text-amber-500 font-bold' : 'text-emerald-600 font-bold'}>
                          {st.hoursRemaining <= 0 ? `Vencida há ${Math.abs(st.hoursRemaining)}h` : `${st.hoursRemaining} horas`}
                        </strong>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 dark:bg-emerald-900 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          st.status === 'RED' ? 'bg-red-500' : st.status === 'YELLOW' ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{
                          width: `${Math.min(100, Math.max(5, (1 - st.hoursRemaining / item.intervalHours) * 100))}%`
                        }}
                      />
                    </div>

                    <button
                      onClick={() => setRecordingItem(item)}
                      className="w-full py-2 rounded-xl bg-white dark:bg-emerald-900 border text-slate-800 dark:text-emerald-100 font-bold text-[11px] hover:bg-slate-100 dark:hover:bg-emerald-800 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-[#FACC15]" />
                      <span>Registrar Serviço Realizado</span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Modal/Form inline to record preventive service */}
            {recordingItem && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                <h4 className="font-black text-xs text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <Wrench className="w-4 h-4 text-amber-600" />
                  <span>Registrar Manutenção: {recordingItem.itemName}</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-emerald-200 mb-1">Horímetro no Serviço (h):</label>
                    <input
                      type="number"
                      value={recordHourmeter}
                      onChange={(e) => setRecordHourmeter(Number(e.target.value))}
                      className={`w-full p-2.5 rounded-xl border font-bold ${
                        darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-200'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-emerald-200 mb-1">Observações / Peças Utilizadas:</label>
                    <input
                      type="text"
                      placeholder="Ex: Troca com filtro original John Deere..."
                      value={recordNotes}
                      onChange={(e) => setRecordNotes(e.target.value)}
                      className={`w-full p-2.5 rounded-xl border text-xs ${
                        darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-200'
                      }`}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => setRecordingItem(null)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleRecordSubmit}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-extrabold text-xs shadow-md"
                  >
                    Gravar Manutenção Preventiva
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: HISTÓRICO & LINHA DO TEMPO */}
        {activeTab === 'TIMELINE' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#064E3B] dark:text-[#FACC15]" />
              <span>Linha do Tempo Integrada da Máquina ({combinedTimeline.length})</span>
            </h3>

            {combinedTimeline.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 border border-dashed rounded-3xl">
                Nenhum evento registrado ainda no histórico desta máquina.
              </div>
            ) : (
              <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200 dark:before:bg-emerald-900/60 pr-1 max-h-96 overflow-y-auto">
                {combinedTimeline.map(item => (
                  <div key={item.id} className="relative pl-8 space-y-1">
                    <div className={`absolute left-1.5 top-1 w-4 h-4 rounded-full border-2 bg-white dark:bg-emerald-950 ${
                      item.type === 'FUEL' 
                        ? 'border-[#064E3B] text-[#064E3B]' 
                        : item.type === 'MAINTENANCE' 
                          ? 'border-amber-500 text-amber-500' 
                          : 'border-red-500 text-red-500'
                    }`} />

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-emerald-950/60 border text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900 dark:text-slate-100">
                          {item.title}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          {new Date(item.date).toLocaleDateString('pt-BR')} {new Date(item.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <p className="text-slate-600 dark:text-emerald-300">
                        {item.description}
                      </p>

                      <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 border-t border-slate-200/60 dark:border-emerald-900">
                        <span>Responsável: <strong>{item.user}</strong></span>
                        {item.value && <strong className="text-[#064E3B] dark:text-[#FACC15]">{item.value}</strong>}
                      </div>

                      {item.photoUrl && (
                        <div className="mt-2 w-24 h-20 rounded-xl overflow-hidden border">
                          <img src={item.photoUrl} alt="Anexo" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PROBLEMAS RELATADOS */}
        {activeTab === 'ISSUES' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span>Problemas & Defeitos Relatados pelos Operadores</span>
              </h3>

              <button
                onClick={() => setIsReportProblemOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Informar Novo Problema</span>
              </button>
            </div>

            {machineReportedIssues.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 border border-dashed rounded-3xl">
                Nenhum problema relatado para esta máquina até o momento.
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {machineReportedIssues.map(iss => (
                  <div
                    key={iss.id}
                    className={`p-4 rounded-2xl border text-xs space-y-2.5 ${
                      iss.status === 'ABERTO' 
                        ? 'bg-red-500/10 border-red-500/30 text-slate-900 dark:text-slate-100'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md font-black text-[9px] uppercase ${
                          iss.status === 'ABERTO' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
                        }`}>
                          {iss.status}
                        </span>
                        <span className="font-bold text-slate-600 dark:text-emerald-300">
                          Relatado por {iss.reportedByUserName}
                        </span>
                      </div>

                      <span className="text-[10px] text-slate-400">
                        {new Date(iss.dateTime).toLocaleDateString('pt-BR')} {new Date(iss.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="font-medium text-slate-800 dark:text-slate-200">
                      "{iss.description}"
                    </p>

                    {iss.photoUrl && (
                      <div className="w-36 h-28 rounded-xl overflow-hidden border">
                        <img src={iss.photoUrl} alt="Foto do defeito" className="w-full h-full object-cover" />
                      </div>
                    )}

                    {iss.status === 'ABERTO' && onResolveIssue && (
                      <button
                        onClick={() => {
                          onResolveIssue(iss.id);
                          setActionSuccessMsg('Problema marcado como resolvido!');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Marcar Como Resolvido</span>
                      </button>
                    )}

                    {iss.status === 'RESOLVIDO' && (
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-300 font-bold">
                        Resolvido por {iss.resolvedBy || 'Gestor'} em {iss.resolvedAt ? new Date(iss.resolvedAt).toLocaleDateString('pt-BR') : ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Sub-modal: Informar Problema */}
      <ReportProblemModal
        isOpen={isReportProblemOpen}
        onClose={() => setIsReportProblemOpen(false)}
        vehicle={vehicle}
        currentUser={currentUser}
        onSubmit={(data) => {
          onReportProblemSubmit(data);
          setActionSuccessMsg('Problema registrado com sucesso! Administradores notificados.');
          setTimeout(() => setActionSuccessMsg(null), 4000);
        }}
        darkMode={darkMode}
      />
    </div>
  );
};
