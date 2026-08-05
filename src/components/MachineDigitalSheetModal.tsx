import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid 
} from 'recharts';
import { 
  X, Truck, Fuel, Wrench, AlertTriangle, CheckCircle2, Clock, 
  Calendar, FileText, User as UserIcon, BarChart3, Shield, Filter, 
  PlusCircle, RefreshCw, AlertCircle, Camera, Check, ChevronRight,
  TrendingUp, Award, Layers, Sparkles, Edit, Trash2, Info, DollarSign,
  Plus, CheckSquare, ArrowLeft
} from 'lucide-react';
import { 
  Vehicle, FuelLog, MaintenanceLog, MachineIssue, 
  PreventiveMaintenanceItem, PreventiveItemKey, User, MaintenanceType 
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
  onOpenFuelingModalWithEquipment?: (equipmentId: string) => void;
  onAddMaintenance?: (log: Omit<MaintenanceLog, 'id'>) => void;
  onUpdateMaintenance?: (id: string, fields: Partial<MaintenanceLog>) => void;
  onDeleteMaintenance?: (id: string) => void;
  onReportProblemSubmit: (issueData: Omit<MachineIssue, 'id' | 'dateTime' | 'status'>) => void;
  onRecordPreventiveService: (equipmentId: string, itemKey: PreventiveItemKey, currentHourmeter: number, notes?: string) => void;
  onResolveIssue?: (issueId: string) => void;
  onUpdateVehicleStatus?: (vehicleId: string, newStatus: 'ATIVO' | 'EM_MANUTENCAO' | 'INATIVO') => void;
  initialTab?: 'PREVENTIVE' | 'HISTORY' | 'TIMELINE' | 'OVERVIEW' | 'ISSUES';
  darkMode?: boolean;
}

export const MachineDigitalSheetModalComponent: React.FC<MachineDigitalSheetModalProps> = ({
  isOpen,
  onClose,
  vehicle,
  fuelLogs = [],
  maintenanceLogs = [],
  machineIssues = [],
  preventiveItems = [],
  currentUser,
  onOpenFuelingModalWithEquipment,
  onAddMaintenance,
  onUpdateMaintenance,
  onDeleteMaintenance,
  onReportProblemSubmit,
  onRecordPreventiveService,
  onResolveIssue,
  onUpdateVehicleStatus,
  initialTab = 'HISTORY',
  darkMode = true
}) => {
  if (!isOpen || !vehicle) return null;

  const isAdmin = currentUser?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<'PREVENTIVE' | 'HISTORY' | 'TIMELINE' | 'OVERVIEW' | 'ISSUES'>(initialTab);
  const [isReportProblemOpen, setIsReportProblemOpen] = useState(false);
  const [recordingItem, setRecordingItem] = useState<PreventiveMaintenanceItem | null>(null);
  const [recordHourmeter, setRecordHourmeter] = useState<number>(vehicle.currentHourmeter || vehicle.currentKm || 0);
  const [recordNotes, setRecordNotes] = useState<string>('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Form State for Adding / Editing Maintenance Log
  const [isMntFormOpen, setIsMntFormOpen] = useState(false);
  const [editingMntId, setEditingMntId] = useState<string | null>(null);
  const [mntType, setMntType] = useState<MaintenanceType>('TROCA_OLEO');
  const [mntTitle, setMntTitle] = useState('');
  const [mntDate, setMntDate] = useState(new Date().toISOString().slice(0, 10));
  const [mntMeter, setMntMeter] = useState<number>(vehicle.currentHourmeter || vehicle.currentKm || 0);
  const [mntDesc, setMntDesc] = useState('');
  const [mntPerformedBy, setMntPerformedBy] = useState(currentUser?.name || '');
  const [mntSupplier, setMntSupplier] = useState('Oficina Interna AndradeAgro');
  const [mntCost, setMntCost] = useState<number>(0);
  const [mntNotes, setMntNotes] = useState('');

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

  const oilChangeLogs = useMemo(() => {
    return machineMaintenanceLogs.filter(m => 
      m.type === 'TROCA_OLEO' || 
      m.type === 'TROCA_FILTROS' || 
      m.title.toLowerCase().includes('óleo') || 
      m.title.toLowerCase().includes('oleo') || 
      m.title.toLowerCase().includes('filtro')
    );
  }, [machineMaintenanceLogs]);

  const machineReportedIssues = useMemo(() => {
    return machineIssues
      .filter(i => i.equipmentId === vehicle.id)
      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
  }, [machineIssues, vehicle.id]);

  const machinePreventiveItems = useMemo(() => {
    return preventiveItems.filter(p => p.equipmentId === vehicle.id);
  }, [preventiveItems, vehicle.id]);

  // Monthly KPIs & Accumulated Costs
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

  const accumulatedFuelCost = useMemo(() => {
    return machineFuelLogs.reduce((sum, f) => sum + (f.totalValue || 0), 0);
  }, [machineFuelLogs]);

  const accumulatedMaintenanceCost = useMemo(() => {
    return machineMaintenanceLogs.reduce((sum, m) => sum + (m.cost || 0), 0);
  }, [machineMaintenanceLogs]);

  const totalAccumulatedCost = accumulatedFuelCost + accumulatedMaintenanceCost;

  const averageConsumption = useMemo(() => {
    if (machineFuelLogs.length === 0) return 0;
    const isKm = vehicle.category === 'VEICULO';
    if (isKm) {
      const logsWithAvg = machineFuelLogs.filter(l => l.calculatedAverageKmPerLiter && l.calculatedAverageKmPerLiter > 0);
      if (logsWithAvg.length === 0) return 3.2;
      return logsWithAvg.reduce((sum, l) => sum + (l.calculatedAverageKmPerLiter || 0), 0) / logsWithAvg.length;
    } else {
      const logsWithAvg = machineFuelLogs.filter(l => l.calculatedAverageLitersPerHour && l.calculatedAverageLitersPerHour > 0);
      if (logsWithAvg.length === 0) return 18.5;
      return logsWithAvg.reduce((sum, l) => sum + (l.calculatedAverageLitersPerHour || 0), 0) / logsWithAvg.length;
    }
  }, [machineFuelLogs, vehicle.category]);

  const lastFueling = machineFuelLogs[0] || null;
  const lastMaintenance = machineMaintenanceLogs[0] || null;

  // Chart Data for Recharts
  const fuelChartData = useMemo(() => {
    return [...machineFuelLogs]
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
      .slice(-10)
      .map(f => ({
        date: new Date(f.dateTime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        litros: f.liters,
        horimetro: f.hourmeterAtFueling || f.odometerAtFueling || 0,
        custo: f.totalValue
      }));
  }, [machineFuelLogs]);

  const maintenanceChartData = useMemo(() => {
    return [...machineMaintenanceLogs]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-10)
      .map(m => ({
        date: new Date(m.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        custo: m.cost,
        horimetro: m.kmOrHourAtService,
        title: m.title
      }));
  }, [machineMaintenanceLogs]);

  // Preventive Maintenance Status Analyzer
  const currentMeter = vehicle.currentHourmeter || vehicle.currentKm || 0;

  const getPreventiveStatus = (item: PreventiveMaintenanceItem) => {
    const hoursRemaining = item.nextScheduledHourmeter - currentMeter;
    if (hoursRemaining <= 0) {
      return { status: 'RED', label: 'Atrasada 🔴', color: 'bg-red-600 text-white', hoursRemaining };
    }
    if (hoursRemaining <= 50) {
      return { status: 'YELLOW', label: 'Próxima 🟡', color: 'bg-amber-500 text-slate-950', hoursRemaining };
    }
    return { status: 'GREEN', label: 'Em dia 🟢', color: 'bg-emerald-600 text-white', hoursRemaining };
  };

  // Machine Alerts List
  const machineAlerts = useMemo(() => {
    const list: { title: string; desc: string; type: 'RED' | 'YELLOW' | 'BLUE' }[] = [];

    // Overdue or upcoming preventive maintenance
    machinePreventiveItems.forEach(item => {
      const st = getPreventiveStatus(item);
      if (st.status === 'RED') {
        list.push({
          title: `⚠️ Manutenção Atrasada: ${item.itemName}`,
          desc: `Ultrapassou o horímetro previsto (${item.nextScheduledHourmeter}h) em ${Math.abs(st.hoursRemaining)} horas!`,
          type: 'RED'
        });
      } else if (st.status === 'YELLOW') {
        list.push({
          title: `⏰ Manutenção Próxima: ${item.itemName}`,
          desc: `Faltam apenas ${st.hoursRemaining} horas para atingir o limite de ${item.nextScheduledHourmeter}h.`,
          type: 'YELLOW'
        });
      }
    });

    // Unresolved issues
    const openIssues = machineReportedIssues.filter(i => i.status === 'ABERTO');
    if (openIssues.length > 0) {
      list.push({
        title: `🚨 ${openIssues.length} Problema(s) Pendente(s)`,
        desc: `Defeitos informados por operadores aguardando resolução na oficina.`,
        type: 'RED'
      });
    }

    if (vehicle.status === 'EM_MANUTENCAO') {
      list.push({
        title: `🛠️ Equipamento em Manutenção`,
        desc: `Esta máquina está atualmente sinalizada como em manutenção preventiva/corretiva.`,
        type: 'YELLOW'
      });
    }

    return list;
  }, [machinePreventiveItems, machineReportedIssues, vehicle.status, currentMeter]);

  // Combined timeline of events
  const combinedTimeline = useMemo(() => {
    const events: {
      id: string;
      date: string;
      type: 'FUEL' | 'MAINTENANCE' | 'ISSUE' | 'STATUS';
      title: string;
      description: string;
      user: string;
      value?: string;
      photoUrl?: string;
      rawObj: any;
    }[] = [];

    machineFuelLogs.forEach(f => {
      events.push({
        id: `f-${f.id}`,
        date: f.dateTime,
        type: 'FUEL',
        title: `Abastecimento (${f.liters}L)`,
        description: `Posto: ${f.gasStationName} • Horímetro/KM: ${f.hourmeterAtFueling || f.kmAtFueling || 'N/I'}`,
        user: f.driverOrOperatorName,
        value: formatCurrency(f.totalValue),
        photoUrl: f.dashboardPhotoUrl,
        rawObj: f
      });
    });

    machineMaintenanceLogs.forEach(m => {
      events.push({
        id: `m-${m.id}`,
        date: m.date,
        type: 'MAINTENANCE',
        title: `Manutenção: ${m.title}`,
        description: `Horímetro/KM: ${m.kmOrHourAtService}h • Serv: ${m.description} (${m.supplierOrWorkshop})`,
        user: m.performedBy || 'Técnico',
        value: m.cost > 0 ? formatCurrency(m.cost) : undefined,
        rawObj: m
      });
    });

    machineReportedIssues.forEach(i => {
      events.push({
        id: `i-${i.id}`,
        date: i.dateTime,
        type: 'ISSUE',
        title: `Problema: ${i.status === 'RESOLVIDO' ? 'RESOLVIDO' : 'ABERTO'}`,
        description: `"${i.description}"`,
        user: i.reportedByUserName,
        photoUrl: i.photoUrl,
        rawObj: i
      });
    });

    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [machineFuelLogs, machineMaintenanceLogs, machineReportedIssues]);

  // Preventive service submit
  const handleRecordSubmit = () => {
    if (!recordingItem) return;
    onRecordPreventiveService(vehicle.id, recordingItem.itemKey, recordHourmeter, recordNotes);
    setActionSuccessMsg(`Serviço de ${recordingItem.itemName} registrado no horímetro ${recordHourmeter}h!`);
    setRecordingItem(null);
    setRecordNotes('');
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  // Open form to add new maintenance
  const handleOpenAddMaintenance = () => {
    setEditingMntId(null);
    setMntType('TROCA_OLEO');
    setMntTitle('');
    setMntDate(new Date().toISOString().slice(0, 10));
    setMntMeter(vehicle.currentHourmeter || vehicle.currentKm || 0);
    setMntDesc('');
    setMntPerformedBy(currentUser?.name || '');
    setMntSupplier('Oficina Interna AndradeAgro');
    setMntCost(0);
    setMntNotes('');
    setIsMntFormOpen(true);
  };

  // Open form to edit maintenance (Admin only)
  const handleOpenEditMaintenance = (m: MaintenanceLog) => {
    if (!isAdmin) return;
    setEditingMntId(m.id);
    setMntType(m.type);
    setMntTitle(m.title);
    setMntDate(m.date);
    setMntMeter(m.kmOrHourAtService);
    setMntDesc(m.description);
    setMntPerformedBy(m.performedBy);
    setMntSupplier(m.supplierOrWorkshop);
    setMntCost(m.cost);
    setMntNotes(m.notes || '');
    setIsMntFormOpen(true);
  };

  // Save Maintenance Form
  const handleSaveMaintenanceForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mntTitle.trim() || !mntDesc.trim()) {
      alert('Por favor, preencha o título e a descrição do serviço.');
      return;
    }

    if (editingMntId) {
      if (onUpdateMaintenance) {
        onUpdateMaintenance(editingMntId, {
          type: mntType,
          title: mntTitle,
          date: mntDate,
          kmOrHourAtService: mntMeter,
          description: mntDesc,
          performedBy: mntPerformedBy,
          supplierOrWorkshop: mntSupplier,
          cost: mntCost,
          notes: mntNotes
        });
        setActionSuccessMsg('Registro de manutenção atualizado com sucesso!');
      }
    } else {
      if (onAddMaintenance) {
        onAddMaintenance({
          equipmentId: vehicle.id,
          equipmentName: `${vehicle.model} (${vehicle.patrimonyCode || vehicle.licensePlate || 'MÁQUINA'})`,
          equipmentPlateOrCode: vehicle.patrimonyCode || vehicle.licensePlate || vehicle.id,
          date: mntDate,
          type: mntType,
          title: mntTitle,
          description: mntDesc,
          kmOrHourAtService: mntMeter,
          nextServiceKmOrHour: mntMeter + 250,
          cost: Number(mntCost) || 0,
          supplierOrWorkshop: mntSupplier || 'Oficina Interna',
          performedBy: mntPerformedBy || currentUser.name,
          status: 'CONCLUIDO',
          notes: mntNotes
        });
        setActionSuccessMsg('Novo registro de manutenção gravado no histórico!');
      }
    }

    setIsMntFormOpen(false);
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  const handleDeleteMnt = (id: string) => {
    if (!isAdmin) return;
    if (confirm('Tem certeza que deseja excluir este registro de manutenção?')) {
      if (onDeleteMaintenance) {
        onDeleteMaintenance(id);
        setActionSuccessMsg('Registro de manutenção removido.');
        setTimeout(() => setActionSuccessMsg(null), 3000);
      }
    }
  };

  const handleDismiss = () => {
    if (typeof window !== 'undefined' && window.location.hash) {
      history.pushState("", document.title, window.location.pathname + window.location.search);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      
      {/* Mobile Floating Action Bar for Touch/Small Screens */}
      <div className="fixed top-2 left-2 right-2 z-[100] flex sm:hidden items-center justify-between bg-[#064E3B] text-white p-2 rounded-2xl shadow-2xl border border-[#FACC15]/40 backdrop-blur-md">
        <button
          onClick={handleDismiss}
          className="px-3 py-2 rounded-xl bg-[#FACC15] text-[#064E3B] font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar</span>
        </button>

        <span className="text-[11px] font-black text-[#FACC15] truncate max-w-[150px] px-2">
          {vehicle.model}
        </span>

        <button
          onClick={handleDismiss}
          className="px-3 py-2 rounded-xl bg-red-600 text-white font-black text-xs flex items-center gap-1 shadow-md active:scale-95"
        >
          <span>Sair</span>
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className={`relative w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col mt-12 sm:mt-0 ${
        darkMode ? 'bg-slate-900 text-slate-100 border border-emerald-900/60' : 'bg-white text-slate-900'
      }`}>

        {/* Top Sticky Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-emerald-900/60 bg-[#064E3B] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FACC15] text-[#064E3B] flex items-center justify-center font-black shadow-md shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-black tracking-widest text-[#FACC15] block">
                FICHA DIGITAL DA MÁQUINA • TEMPO REAL
              </span>
              <h2 className="text-base sm:text-lg font-black truncate max-w-xs sm:max-w-md">
                {vehicle.model} ({vehicle.patrimonyCode || vehicle.licensePlate || 'MÁQUINA'})
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDismiss}
              className="px-3 py-1.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-transform active:scale-95 shrink-0"
              title="Voltar"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>
            <button
              onClick={handleDismiss}
              className="w-9 h-9 rounded-2xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-transform active:scale-95 shrink-0"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body - Scrollable */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs">

          {/* Toast Notification */}
          {actionSuccessMsg && (
            <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500 text-emerald-800 dark:text-emerald-200 font-bold text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{actionSuccessMsg}</span>
            </div>
          )}

          {/* 1. Identification Header Card */}
          <div className={`p-4 rounded-3xl border space-y-3 ${
            darkMode ? 'bg-emerald-950/40 border-emerald-900/60' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              
              <div className="flex items-center gap-3.5">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-slate-200 dark:bg-emerald-900 border border-slate-300 dark:border-emerald-700 shrink-0 shadow-sm">
                  {vehicle.photoUrl ? (
                    <img src={vehicle.photoUrl} alt={vehicle.model} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <Truck className="w-8 h-8" />
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-[#064E3B] text-[#FACC15]">
                      {vehicle.category}
                    </span>

                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase ${
                      vehicle.status === 'ATIVO' 
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : vehicle.status === 'EM_MANUTENCAO'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                    }`}>
                      {vehicle.status === 'ATIVO' ? '🟢 ATIVA' : vehicle.status === 'EM_MANUTENCAO' ? '🟡 EM MANUTENÇÃO' : '🔴 PARADA'}
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

                  <h1 className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1 truncate">
                    {vehicle.model}
                  </h1>
                  
                  <p className="text-xs text-slate-500 dark:text-emerald-300 font-medium truncate">
                    {vehicle.manufacturer} • Ano {vehicle.year} • Setor: <strong>{getSectorName(vehicle.sector)}</strong>
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                <button
                  onClick={() => setIsReportProblemOpen(true)}
                  className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md transition-transform active:scale-95"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Informar Defeito</span>
                </button>

                <button
                  onClick={handleOpenAddMaintenance}
                  className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-2xl bg-[#064E3B] hover:bg-[#043d2e] text-[#FACC15] font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md transition-transform active:scale-95"
                >
                  <PlusCircle className="w-4 h-4 text-[#FACC15]" />
                  <span>Nova Manutenção</span>
                </button>
              </div>

            </div>

            {/* Spec Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
              <div className="p-2.5 rounded-2xl bg-white dark:bg-emerald-900/60 border">
                <span className="text-[10px] text-slate-500 block">Horímetro / KM Atual:</span>
                <strong className="text-slate-900 dark:text-slate-100 text-sm font-black">
                  {vehicle.category === 'VEICULO' 
                    ? `${vehicle.currentKm.toLocaleString('pt-BR')} km`
                    : `${vehicle.currentHourmeter || 0} Horas`}
                </strong>
              </div>

              <div className="p-2.5 rounded-2xl bg-white dark:bg-emerald-900/60 border">
                <span className="text-[10px] text-slate-500 block">Tanque / Combustível:</span>
                <strong className="text-slate-900 dark:text-slate-100">
                  {vehicle.fuelType === 'NENHUM' ? 'Não se aplica' : `${vehicle.tankCapacityLiters}L (${getFuelTypeName(vehicle.fuelType)})`}
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
              onClick={() => setActiveTab('PREVENTIVE')}
              className={`px-3.5 py-2 rounded-2xl font-extrabold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                activeTab === 'PREVENTIVE'
                  ? 'bg-[#064E3B] text-white shadow-sm'
                  : 'text-slate-600 dark:text-emerald-300 hover:bg-slate-100 dark:hover:bg-emerald-900/40'
              }`}
            >
              <Wrench className="w-4 h-4 text-[#FACC15]" />
              <span>Manutenção Preventiva ({machinePreventiveItems.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`px-3.5 py-2 rounded-2xl font-extrabold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                activeTab === 'HISTORY'
                  ? 'bg-[#064E3B] text-white shadow-sm'
                  : 'text-slate-600 dark:text-emerald-300 hover:bg-slate-100 dark:hover:bg-emerald-900/40'
              }`}
            >
              <FileText className="w-4 h-4 text-[#FACC15]" />
              <span>Histórico de Manutenções ({machineMaintenanceLogs.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('TIMELINE')}
              className={`px-3.5 py-2 rounded-2xl font-extrabold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                activeTab === 'TIMELINE'
                  ? 'bg-[#064E3B] text-white shadow-sm'
                  : 'text-slate-600 dark:text-emerald-300 hover:bg-slate-100 dark:hover:bg-emerald-900/40'
              }`}
            >
              <Clock className="w-4 h-4 text-[#FACC15]" />
              <span>Linha do Tempo</span>
            </button>

            <button
              onClick={() => setActiveTab('OVERVIEW')}
              className={`px-3.5 py-2 rounded-2xl font-extrabold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                activeTab === 'OVERVIEW'
                  ? 'bg-[#064E3B] text-white shadow-sm'
                  : 'text-slate-600 dark:text-emerald-300 hover:bg-slate-100 dark:hover:bg-emerald-900/40'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-[#FACC15]" />
              <span>Indicadores & Custos</span>
            </button>

            <button
              onClick={() => setActiveTab('ISSUES')}
              className={`px-3.5 py-2 rounded-2xl font-extrabold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                activeTab === 'ISSUES'
                  ? 'bg-[#064E3B] text-white shadow-sm'
                  : 'text-slate-600 dark:text-emerald-300 hover:bg-slate-100 dark:hover:bg-emerald-900/40'
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-[#FACC15]" />
              <span>Problemas ({machineReportedIssues.length})</span>
            </button>
          </div>

          {/* TAB 1: CONTROLE DE MANUTENÇÃO PREVENTIVA */}
          {activeTab === 'PREVENTIVE' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                    Controle de Manutenção Preventiva da Máquina
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Horímetro / KM Atual: <strong>{currentMeter} {vehicle.category === 'VEICULO' ? 'KM' : 'Horas'}</strong>
                  </p>
                </div>

                <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-bold bg-emerald-100 dark:bg-emerald-950 px-2.5 py-1 rounded-xl">
                  {machinePreventiveItems.length} Itens Monitorados
                </span>
              </div>

              {/* Grid of preventive items */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {machinePreventiveItems.map(item => {
                  const st = getPreventiveStatus(item);
                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border space-y-3 relative overflow-hidden transition-all ${
                        darkMode ? 'bg-emerald-950/50 border-emerald-900' : 'bg-slate-50 border-slate-200'
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

                        <span className={`px-2.5 py-1 rounded-xl font-black text-[10px] uppercase shrink-0 shadow-xs ${st.color}`}>
                          {st.label}
                        </span>
                      </div>

                      <div className="space-y-1.5 bg-white/50 dark:bg-black/20 p-2.5 rounded-xl border border-black/5">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">Última Troca / Serviço:</span>
                          <strong className="text-slate-800 dark:text-emerald-200">
                            {item.lastServiceHourmeter}h ({item.lastServiceDate ? new Date(item.lastServiceDate).toLocaleDateString('pt-BR') : 'Sem data'})
                          </strong>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">Próxima Troca Programada:</span>
                          <strong className="text-slate-800 dark:text-emerald-200">{item.nextScheduledHourmeter}h</strong>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">Horas Faltantes:</span>
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
                        className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5 text-[#FACC15]" />
                        <span>Registrar Troca / Serviço Realizado</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Quick recording sub-form for preventive item */}
              {recordingItem && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3 animate-in fade-in">
                  <h4 className="font-black text-xs text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-amber-600" />
                    <span>Registrar Serviço: {recordingItem.itemName}</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-emerald-200 mb-1">Horímetro Atual no Serviço (h):</label>
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
                      <label className="block font-bold text-slate-700 dark:text-emerald-200 mb-1">Observações / Detalhes das Peças:</label>
                      <input
                        type="text"
                        placeholder="Ex: Troca com óleo Mobil HD e filtro original..."
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

          {/* TAB 2: HISTÓRICO DE MANUTENÇÕES */}
          {activeTab === 'HISTORY' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-[#064E3B] dark:text-[#FACC15]" />
                    <span>Histórico Completo de Manutenções</span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Acesso para funcionários e administradores.
                  </p>
                </div>

                <button
                  onClick={handleOpenAddMaintenance}
                  className="px-3.5 py-2 rounded-2xl bg-[#064E3B] hover:bg-[#043d2e] text-[#FACC15] font-black text-xs flex items-center gap-1.5 shadow-md transition-transform active:scale-95"
                >
                  <Plus className="w-4 h-4 text-[#FACC15]" />
                  <span>+ Adicionar Registro de Manutenção</span>
                </button>
              </div>

              {/* Section 1: Special Highlight for Oil & Filter Changes */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                <h4 className="font-extrabold text-xs text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Últimas Trocas de Óleo e Filtros</span>
                </h4>

                {oilChangeLogs.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic">Nenhum registro específico de troca de óleo cadastrado.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {oilChangeLogs.slice(0, 4).map(m => (
                      <div key={m.id} className="p-3 rounded-xl bg-white dark:bg-emerald-950 border space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-extrabold text-slate-900 dark:text-slate-100">{m.title}</span>
                          <span className="text-[10px] font-bold text-slate-400">{new Date(m.date).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-emerald-300">Horímetro/KM: <strong>{m.kmOrHourAtService}</strong></p>
                        <p className="text-[11px] text-slate-500">Mecânico/Resp: <strong>{m.performedBy}</strong></p>
                        {m.description && <p className="text-[10px] text-slate-500 italic">"{m.description}"</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 2: All Maintenance Logs List */}
              <div className="space-y-3">
                <h4 className="font-extrabold text-xs text-slate-700 dark:text-emerald-200">
                  Todas as Manutenções Realizadas ({machineMaintenanceLogs.length})
                </h4>

                {machineMaintenanceLogs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 border border-dashed rounded-3xl">
                    Nenhum registro de manutenção encontrado para esta máquina.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {machineMaintenanceLogs.map(log => (
                      <div 
                        key={log.id}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-emerald-950/60 border text-xs space-y-2 relative"
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md font-black text-[9px] uppercase bg-emerald-700 text-white">
                              {log.type.replace('_', ' ')}
                            </span>
                            <h5 className="font-extrabold text-xs text-slate-900 dark:text-slate-100">
                              {log.title}
                            </h5>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 font-bold">
                              🗓️ {new Date(log.date).toLocaleDateString('pt-BR')}
                            </span>

                            {/* Admin-only controls */}
                            {isAdmin && (
                              <div className="flex items-center gap-1 ml-2">
                                <button
                                  onClick={() => handleOpenEditMaintenance(log)}
                                  className="p-1 rounded bg-slate-200 dark:bg-emerald-800 hover:bg-slate-300 text-slate-700 dark:text-emerald-100"
                                  title="Editar Manutenção"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteMnt(log.id)}
                                  className="p-1 rounded bg-red-100 dark:bg-red-950 hover:bg-red-200 text-red-600 dark:text-red-300"
                                  title="Excluir Manutenção"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <p className="text-slate-700 dark:text-emerald-200 font-medium">
                          {log.description}
                        </p>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] text-slate-500 border-t border-slate-200 dark:border-emerald-900">
                          <div>
                            <span className="block text-[10px]">Horímetro/KM:</span>
                            <strong className="text-slate-800 dark:text-slate-200">{log.kmOrHourAtService}</strong>
                          </div>

                          <div>
                            <span className="block text-[10px]">Mecânico / Resp.:</span>
                            <strong className="text-slate-800 dark:text-slate-200">{log.performedBy || 'Não informado'}</strong>
                          </div>

                          <div>
                            <span className="block text-[10px]">Oficina / Fornecedor:</span>
                            <strong className="text-slate-800 dark:text-slate-200">{log.supplierOrWorkshop || 'Interno'}</strong>
                          </div>

                          <div>
                            <span className="block text-[10px]">Custo Registrado:</span>
                            <strong className="text-[#064E3B] dark:text-[#FACC15]">{log.cost > 0 ? formatCurrency(log.cost) : 'R$ 0,00'}</strong>
                          </div>
                        </div>

                        {log.notes && (
                          <p className="text-[10px] text-slate-500 italic bg-white/50 dark:bg-black/20 p-2 rounded-xl">
                            Obs: {log.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: LINHA DO TEMPO */}
          {activeTab === 'TIMELINE' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#064E3B] dark:text-[#FACC15]" />
                <span>Linha do Tempo Integrada da Máquina ({combinedTimeline.length})</span>
              </h3>

              {combinedTimeline.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 border border-dashed rounded-3xl">
                  Nenhum evento registrado no histórico desta máquina.
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

          {/* TAB 4: INDICADORES E CUSTOS */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#064E3B] dark:text-[#FACC15]" />
                  <span>Indicadores Operacionais e Custos da Máquina</span>
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">Horas / KM Acumulado:</span>
                  <strong className="text-xl font-black text-[#064E3B] dark:text-[#FACC15]">
                    {vehicle.category === 'VEICULO' ? `${vehicle.currentKm} km` : `${vehicle.currentHourmeter || 0} h`}
                  </strong>
                  <p className="text-[10px] text-slate-500">Total trabalhado</p>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">Consumo Mensal:</span>
                  <strong className="text-xl font-black text-slate-900 dark:text-slate-100">
                    {litersConsumedMonth.toLocaleString('pt-BR')} L
                  </strong>
                  <p className="text-[10px] text-slate-500">{formatCurrency(totalSpentMonth)} no mês</p>
                </div>

                <div className="p-4 rounded-2xl bg-[#064E3B] text-white p-4 rounded-2xl space-y-1 col-span-2 sm:col-span-1 shadow-md">
                  <span className="text-[10px] text-[#FACC15] font-black block uppercase">Custo Acumulado Total:</span>
                  <strong className="text-xl font-black text-white">
                    {formatCurrency(totalAccumulatedCost)}
                  </strong>
                  <p className="text-[10px] text-slate-200">Somatório Abastecimentos + Manutenções</p>
                </div>
              </div>

              {/* Quick Summary Cards */}
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

              {/* RECHARTS GRAPHS FOR TECHNICAL ANALYSIS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs pt-2">
                {/* Chart 1: Abastecimentos e Litros Consumidos */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-emerald-950/40 border border-slate-200 dark:border-emerald-900/60 space-y-3">
                  <div className="flex items-center justify-between border-b pb-2 border-slate-200 dark:border-emerald-900/60">
                    <span className="font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <Fuel className="w-4 h-4 text-[#064E3B] dark:text-[#FACC15]" />
                      <span>Histórico de Consumo (Litros)</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold">Volume por abastecimento</span>
                  </div>

                  {fuelChartData.length === 0 ? (
                    <div className="h-44 flex items-center justify-center text-slate-400 text-xs italic">
                      Sem dados de abastecimento suficientes para o gráfico.
                    </div>
                  ) : (
                    <div className="h-48 w-full pt-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={fuelChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: darkMode ? '#042d23' : '#ffffff', 
                              borderColor: '#059669', 
                              borderRadius: '12px',
                              fontSize: '11px',
                              color: darkMode ? '#ffffff' : '#000000'
                            }}
                            formatter={(value: any) => [`${value} Litros`, 'Volume']}
                          />
                          <Bar dataKey="litros" fill="#059669" radius={[6, 6, 0, 0]} name="Litros" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Chart 2: Evolução do Horímetro / KM */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-emerald-950/40 border border-slate-200 dark:border-emerald-900/60 space-y-3">
                  <div className="flex items-center justify-between border-b pb-2 border-slate-200 dark:border-emerald-900/60">
                    <span className="font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-[#FACC15]" />
                      <span>Evolução do Horímetro / KM</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold">
                      {vehicle.category === 'VEICULO' ? 'Quilometragem' : 'Horas Operacionais'}
                    </span>
                  </div>

                  {fuelChartData.length === 0 && maintenanceChartData.length === 0 ? (
                    <div className="h-44 flex items-center justify-center text-slate-400 text-xs italic">
                      Sem histórico de horímetro registrado.
                    </div>
                  ) : (
                    <div className="h-48 w-full pt-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart 
                          data={fuelChartData.length > 0 ? fuelChartData : maintenanceChartData} 
                          margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="colorMeter" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#FACC15" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#FACC15" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} domain={['auto', 'auto']} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: darkMode ? '#042d23' : '#ffffff', 
                              borderColor: '#eab308', 
                              borderRadius: '12px',
                              fontSize: '11px',
                              color: darkMode ? '#ffffff' : '#000000'
                            }}
                            formatter={(value: any) => [
                              `${value} ${vehicle.category === 'VEICULO' ? 'km' : 'h'}`,
                              'Horímetro / KM'
                            ]}
                          />
                          <Area type="monotone" dataKey="horimetro" stroke="#FACC15" fillOpacity={1} fill="url(#colorMeter)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PROBLEMAS RELATADOS */}
          {activeTab === 'ISSUES' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span>Problemas & Defeitos Relatados</span>
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

        {/* Modal Inline Form: Add/Edit Maintenance Log */}
        {isMntFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm">
            <div className={`w-full max-w-lg rounded-3xl p-5 border shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto ${
              darkMode ? 'bg-slate-900 text-white border-emerald-900' : 'bg-white text-slate-900 border-slate-200'
            }`}>
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-black text-sm flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-[#FACC15]" />
                  <span>{editingMntId ? 'Editar Registro de Manutenção' : 'Novo Registro de Manutenção'}</span>
                </h3>
                <button
                  onClick={() => setIsMntFormOpen(false)}
                  className="p-1 rounded-full text-slate-400 hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveMaintenanceForm} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold mb-1">Tipo de Manutenção:</label>
                  <select
                    value={mntType}
                    onChange={(e) => setMntType(e.target.value as MaintenanceType)}
                    className={`w-full p-2.5 rounded-xl border font-bold ${
                      darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-200'
                    }`}
                  >
                    <option value="TROCA_OLEO">Troca de Óleo</option>
                    <option value="TROCA_FILTROS">Troca de Filtros (Óleo, Ar, Combustível)</option>
                    <option value="REVISAO">Revisão Geral / Preventiva</option>
                    <option value="LUBRIFICACAO">Lubrificação e Engraxamento</option>
                    <option value="PNEUS">Pneus / Esteiras</option>
                    <option value="PECAS">Troca de Peças</option>
                    <option value="SERVICO_CORRETIVO">Serviço Corretivo</option>
                    <option value="OUTROS">Outros</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1">Título do Serviço:</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Troca de óleo do motor + filtro original"
                    value={mntTitle}
                    onChange={(e) => setMntTitle(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border ${
                      darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-200'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold mb-1">Data:</label>
                    <input
                      type="date"
                      required
                      value={mntDate}
                      onChange={(e) => setMntDate(e.target.value)}
                      className={`w-full p-2.5 rounded-xl border ${
                        darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-200'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-1">Horímetro ou KM:</label>
                    <input
                      type="number"
                      required
                      value={mntMeter}
                      onChange={(e) => setMntMeter(Number(e.target.value))}
                      className={`w-full p-2.5 rounded-xl border font-bold ${
                        darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-200'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold mb-1">Descrição do Serviço Realizado:</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Descreva detalhadamente o serviço executado..."
                    value={mntDesc}
                    onChange={(e) => setMntDesc(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border ${
                      darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-200'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold mb-1">Responsável / Mecânico:</label>
                    <input
                      type="text"
                      placeholder="Nome do responsável"
                      value={mntPerformedBy}
                      onChange={(e) => setMntPerformedBy(e.target.value)}
                      className={`w-full p-2.5 rounded-xl border ${
                        darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-200'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-1">Oficina / Fornecedor:</label>
                    <input
                      type="text"
                      placeholder="Ex: Oficina Interna"
                      value={mntSupplier}
                      onChange={(e) => setMntSupplier(e.target.value)}
                      className={`w-full p-2.5 rounded-xl border ${
                        darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-200'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold mb-1">Valor / Custo (R$) (Opcional):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={mntCost}
                      onChange={(e) => setMntCost(Number(e.target.value))}
                      className={`w-full p-2.5 rounded-xl border ${
                        darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-200'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-1">Observações:</label>
                    <input
                      type="text"
                      placeholder="Ex: Garantia de 90 dias"
                      value={mntNotes}
                      onChange={(e) => setMntNotes(e.target.value)}
                      className={`w-full p-2.5 rounded-xl border ${
                        darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-200'
                      }`}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-emerald-900">
                  <button
                    type="button"
                    onClick={() => setIsMntFormOpen(false)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-2xl bg-[#064E3B] text-[#FACC15] font-black text-xs shadow-md hover:bg-[#043d2e]"
                  >
                    {editingMntId ? 'Salvar Alterações' : 'Gravar Manutenção'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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
    </div>
  );
};

export const MachineDigitalSheetModal = React.memo(MachineDigitalSheetModalComponent);
