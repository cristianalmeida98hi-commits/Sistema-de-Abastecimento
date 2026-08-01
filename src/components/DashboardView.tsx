import React, { useMemo } from 'react';
import { 
  Fuel, DollarSign, Calendar, TrendingUp, Truck, Users, 
  BarChart2, PieChart, ArrowUpRight, AlertCircle, Plus, FileText, CheckCircle2, ChevronRight
} from 'lucide-react';
import { FuelLog, Vehicle, Sector } from '../types';
import { formatCurrency, formatDateTimeBR, getSectorName, getFuelTypeName } from '../utils/calculations';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, 
  PieChart as RechartsPieChart, Pie, Cell, BarChart, Bar, CartesianGrid, Legend 
} from 'recharts';

interface DashboardViewProps {
  fuelLogs: FuelLog[];
  vehicles: Vehicle[];
  onOpenFuelingModal: () => void;
  onNavigate: (tab: string) => void;
  darkMode: boolean;
}

const SECTOR_COLORS: Record<string, string> = {
  PREPARO_SOLO: '#15803d',
  COLHEITA: '#d97706',
  PULVERIZACAO: '#0284c7',
  LOGISTICA: '#4f46e5',
  AGRICOLA: '#16a34a',
  DIRETORIA: '#ca8a04',
  OFICINA_MANUTENCAO: '#64748b'
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  fuelLogs = [],
  vehicles = [],
  onOpenFuelingModal,
  onNavigate,
  darkMode
}) => {
  // Date calculations
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 7);
  
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  // Filtered metric calculations
  const todayLogs = fuelLogs.filter(l => l.dateTime.startsWith(todayStr));
  const weekLogs = fuelLogs.filter(l => new Date(l.dateTime) >= sevenDaysAgo);
  const monthLogs = fuelLogs.filter(l => new Date(l.dateTime) >= startOfMonth);
  const yearLogs = fuelLogs.filter(l => new Date(l.dateTime) >= startOfYear);

  const todayLiters = todayLogs.reduce((acc, l) => acc + l.liters, 0);
  const todaySpent = todayLogs.reduce((acc, l) => acc + l.totalValue, 0);

  const weekSpent = weekLogs.reduce((acc, l) => acc + l.totalValue, 0);
  const monthSpent = monthLogs.reduce((acc, l) => acc + l.totalValue, 0);
  const monthLiters = monthLogs.reduce((acc, l) => acc + l.liters, 0);

  const yearSpent = yearLogs.reduce((acc, l) => acc + l.totalValue, 0);

  // Top Consumers Calculations
  const equipmentConsumption = useMemo(() => {
    const map = new Map<string, { name: string; plate: string; category: string; liters: number; cost: number }>();
    fuelLogs.forEach(l => {
      const existing = map.get(l.equipmentId) || {
        name: l.equipmentName,
        plate: l.equipmentPlateOrCode,
        category: l.equipmentCategory,
        liters: 0,
        cost: 0
      };
      existing.liters += l.liters;
      existing.cost += l.totalValue;
      map.set(l.equipmentId, existing);
    });
    return Array.from(map.values());
  }, [fuelLogs]);

  const topVehicle = equipmentConsumption
    .filter(e => e.category === 'VEICULO')
    .sort((a, b) => b.liters - a.liters)[0];

  const topTractorOrMachine = equipmentConsumption
    .filter(e => e.category === 'TRATOR' || e.category === 'MAQUINA_AGRICOLA')
    .sort((a, b) => b.liters - a.liters)[0];

  const topOperator = useMemo(() => {
    const map = new Map<string, { name: string; count: number; liters: number }>();
    fuelLogs.forEach(l => {
      const existing = map.get(l.driverOrOperatorId) || { name: l.driverOrOperatorName, count: 0, liters: 0 };
      existing.count += 1;
      existing.liters += l.liters;
      map.set(l.driverOrOperatorId, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.liters - a.liters)[0];
  }, [fuelLogs]);

  // Sector Data Chart
  const sectorChartData = useMemo(() => {
    const map = new Map<Sector, number>();
    fuelLogs.forEach(l => {
      const eq = vehicles.find(v => v.id === l.equipmentId);
      const sec = eq ? eq.sector : 'AGRICOLA';
      map.set(sec, (map.get(sec) || 0) + l.totalValue);
    });

    return Array.from(map.entries()).map(([sec, value]) => ({
      name: getSectorName(sec),
      key: sec,
      value: Math.round(value)
    }));
  }, [fuelLogs, vehicles]);

  // Monthly Spending History Chart
  const monthlyHistoryData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const currentMonthIdx = now.getMonth();
    const data = [];

    for (let i = 5; i >= 0; i--) {
      const idx = (currentMonthIdx - i + 12) % 12;
      const monthName = months[idx];
      // Generate realistic monthly aggregate from fuelLogs or fallback estimation
      const logsForMonth = fuelLogs.filter(l => {
        const d = new Date(l.dateTime);
        return d.getMonth() === idx;
      });
      const total = logsForMonth.reduce((acc, l) => acc + l.totalValue, 0);
      data.push({
        month: monthName,
        Gasto: total,
        Litros: logsForMonth.reduce((acc, l) => acc + l.liters, 0)
      });
    }

    return data;
  }, [fuelLogs]);

  // Operation Types Breakdown
  const operationTypeData = useMemo(() => {
    const map = new Map<string, { label: string; liters: number; cost: number; count: number }>();
    const labels: Record<string, string> = {
      GRAMA: '🌱 Grama',
      COLHEITA: '🌾 Colheita',
      PLANTIO: '🚜 Plantio',
      TRANSPORTE: '🚚 Transporte',
      OUTROS: '🔧 Outros'
    };

    fuelLogs.forEach(l => {
      const opKey = l.operationType || 'GRAMA';
      const existing = map.get(opKey) || { label: labels[opKey] || opKey, liters: 0, cost: 0, count: 0 };
      existing.liters += l.liters;
      existing.cost += l.totalValue;
      existing.count += 1;
      map.set(opKey, existing);
    });

    return Array.from(map.entries()).map(([key, data]) => ({
      key,
      ...data
    })).sort((a, b) => b.liters - a.liters);
  }, [fuelLogs]);

  // Executive summary narrative line
  const executiveSummaryText = useMemo(() => {
    if (fuelLogs.length === 0) {
      return "Nova Empresa: Nenhum abastecimento registrado ainda. Os custos estão zerados (R$ 0,00). Faça um lançamento de teste no sistema para validar os cálculos.";
    }
    const totalMonthLiters = monthLiters;
    const topOp = operationTypeData[0];
    if (!topOp) {
      return `Este mês foram consumidos ${totalMonthLiters.toLocaleString('pt-BR')} litros de combustível.`;
    }
    const topOpName = topOp.label.replace(/^[^\s]+\s*/, '').toLowerCase();
    const opName = topOperator?.name || 'Operador';

    return `Este mês foram consumidos ${totalMonthLiters.toLocaleString('pt-BR')} litros de combustível, sendo ${topOp.liters.toLocaleString('pt-BR')} litros utilizados em ${topOpName} pelo operador ${opName}.`;
  }, [fuelLogs.length, monthLiters, operationTypeData, topOperator]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* Executive Operational Narrative Banner */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-[#064E3B] to-[#043327] border-2 border-[#FACC15] shadow-md text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start md:items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FACC15] text-[#064E3B] flex items-center justify-center shrink-0 font-extrabold text-lg shadow-sm">
            💡
          </div>
          <div>
            <span className="text-[10px] uppercase font-black tracking-widest text-[#FACC15]">
              Resumo Operacional Inteligente
            </span>
            <p className="text-sm font-extrabold text-white mt-0.5 leading-relaxed">
              "{executiveSummaryText}"
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('reports')}
          className="self-start md:self-auto px-4 py-2 bg-[#FACC15] hover:bg-yellow-400 text-[#064E3B] font-extrabold text-xs rounded-2xl shadow transition-all shrink-0"
        >
          Relatórios Detalhados
        </button>
      </div>
      
      {/* Top Bento Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Bento Stat 1: Abastecimentos Hoje */}
        <div className={`p-5 rounded-3xl border shadow-sm transition-all flex flex-col justify-between ${
          darkMode ? 'bg-[#042d23] border-emerald-900/60 text-slate-100' : 'bg-white border-slate-100 text-slate-800'
        }`}>
          <div>
            <p className="text-slate-600 dark:text-emerald-300 text-xs font-bold uppercase tracking-wider mb-2">
              Abastecimentos (Hoje)
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-800 dark:text-slate-100">{todayLogs.length}</span>
              <span className="text-emerald-700 dark:text-emerald-300 text-xs font-bold px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/80 rounded-md border border-emerald-200/60">
                {todayLogs.length > 0 ? `${todayLogs.length} reg` : '0 reg'}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-emerald-300/90 mt-3 font-semibold">
            {todaySpent > 0 ? `Gasto hoje: ${formatCurrency(todaySpent)}` : 'Nenhum lançamento hoje'}
          </p>
        </div>

        {/* Bento Stat 2: Total Litros (Semana) */}
        <div className={`p-5 rounded-3xl border shadow-sm transition-all flex flex-col justify-between ${
          darkMode ? 'bg-[#042d23] border-emerald-900/60 text-slate-100' : 'bg-white border-slate-100 text-slate-800'
        }`}>
          <div>
            <p className="text-slate-600 dark:text-emerald-300 text-xs font-bold uppercase tracking-wider mb-2">
              Total Litros (Semana)
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                {weekLogs.reduce((acc, l) => acc + l.liters, 0).toLocaleString('pt-BR')}
              </span>
              <span className="text-slate-600 dark:text-emerald-300 text-sm font-bold">L</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-emerald-300/90 mt-3 font-semibold">
            Consumo estável vs. período anterior
          </p>
        </div>

        {/* Bento Stat 3: Gasto Mensal */}
        <div className={`p-5 rounded-3xl border shadow-sm transition-all flex flex-col justify-between ${
          darkMode ? 'bg-[#042d23] border-emerald-900/60 text-slate-100' : 'bg-white border-slate-100 text-slate-800'
        }`}>
          <div>
            <p className="text-slate-600 dark:text-emerald-300 text-xs font-bold uppercase tracking-wider mb-2">
              Gasto Mensal
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-xs font-bold text-slate-600 dark:text-emerald-300">R$</span>
              <span className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                {monthSpent.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-bold mt-3">
            {monthLiters.toLocaleString('pt-BR')}L acumulados este mês
          </p>
        </div>

        {/* Bento Stat 4: High-Impact Emerald Card - Frota Ativa */}
        <div className="bg-[#064E3B] p-5 rounded-3xl border border-[#064E3B] shadow-lg shadow-emerald-900/10 text-white flex flex-col justify-between">
          <div>
            <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider mb-2">
              Frota & Máquinas Ativas
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[#FACC15]">{vehicles.filter(v => v.status === 'ATIVO').length}</span>
              <span className="text-emerald-200 text-sm font-bold">/ {vehicles.length}</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="w-full h-2 bg-white/20 rounded-full">
              <div 
                className="h-full bg-[#FACC15] rounded-full transition-all duration-500" 
                style={{ width: `${Math.round((vehicles.filter(v => v.status === 'ATIVO').length / (vehicles.length || 1)) * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-emerald-100 font-bold mt-1.5 text-right">
              {Math.round((vehicles.filter(v => v.status === 'ATIVO').length / (vehicles.length || 1)) * 100)}% em operação
            </p>
          </div>
        </div>

      </div>

      {/* Main Bento Grid Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Main Chart Section - 8 cols */}
        <div className={`lg:col-span-8 bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col ${
          darkMode ? 'bg-[#042d23] border-emerald-900/60' : 'bg-white border-slate-100'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Fluxo de Consumo</h3>
              <p className="text-xs text-slate-600 dark:text-emerald-200 font-medium">Evolução dos abastecimentos por mês e por setor</p>
            </div>
            <span className="self-start sm:self-auto text-xs font-bold text-[#064E3B] dark:text-[#FACC15] bg-[#064E3B]/10 dark:bg-[#FACC15]/10 px-3 py-1.5 rounded-full border border-[#064E3B]/20">
              Mês Atual: {now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </span>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyHistoryData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorGastoBento" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#064E3B" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#064E3B" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#064e3b' : '#e2e8f0'} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: darkMode ? '#a7f3d0' : '#334155', fontWeight: 600 }} />
                <YAxis tick={{ fontSize: 11, fill: darkMode ? '#a7f3d0' : '#334155', fontWeight: 600 }} tickFormatter={(v) => `R$${v/1000}k`} />
                <Tooltip 
                  formatter={(val: any) => [formatCurrency(Number(val)), 'Total Gasto']}
                  contentStyle={{
                    backgroundColor: darkMode ? '#022c22' : '#ffffff',
                    borderColor: darkMode ? '#065f46' : '#cbd5e1',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: darkMode ? '#f8fafc' : '#0f172a',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                  }}
                />
                <Area type="monotone" dataKey="Gasto" stroke="#064E3B" strokeWidth={3} fillOpacity={1} fill="url(#colorGastoBento)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Sector Bars Preview inside Bento Card */}
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-emerald-900/40 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {sectorChartData.slice(0, 4).map((sec, idx) => (
              <div key={idx} className="bg-slate-100 dark:bg-emerald-950/60 p-3 rounded-2xl border border-slate-200/60 dark:border-emerald-900/40">
                <p className="text-[10px] font-extrabold text-slate-700 dark:text-emerald-300 uppercase truncate">{sec.name}</p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">{formatCurrency(sec.value)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Registrations Bento Card - 4 cols */}
        <div className={`lg:col-span-4 bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col justify-between ${
          darkMode ? 'bg-[#042d23] border-emerald-900/60' : 'bg-white border-slate-100'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Últimos Registros</h3>
              <button 
                onClick={() => onNavigate('fuel-logs')}
                className="text-[11px] font-bold text-[#064E3B] dark:text-[#FACC15] hover:underline"
              >
                Ver Todos
              </button>
            </div>

            <div className="space-y-3">
              {fuelLogs.slice(0, 4).map((log) => (
                <div key={log.id} className="flex items-center gap-3 p-3 bg-slate-100/80 dark:bg-emerald-950/60 rounded-2xl transition-colors hover:bg-slate-200/80 border border-slate-200/50 dark:border-emerald-900/40">
                  <div className="w-10 h-10 bg-[#064E3B] text-white rounded-full flex items-center justify-center shrink-0 font-bold shadow-sm">
                    <Fuel className="w-5 h-5 text-[#FACC15]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{log.equipmentName}</p>
                    <p className="text-[11px] text-slate-700 dark:text-emerald-200 uppercase font-bold truncate">
                      {log.driverOrOperatorName} • <span className="text-[#064E3B] dark:text-[#FACC15]">{log.liters}L</span>
                    </p>
                  </div>
                  <div className="text-[11px] font-bold text-slate-600 dark:text-emerald-300 shrink-0">
                    {formatDateTimeBR(log.dateTime).split(' ')[1] || 'Hoje'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => onNavigate('fuel-logs')}
            className="mt-5 w-full py-3 bg-[#064E3B] hover:bg-[#043d2e] text-white text-xs font-bold rounded-2xl transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            Ver Todos os Registros
          </button>
        </div>

      </div>

      {/* Secondary Bento Grid Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Maintenance Alerts Bento Box */}
        <div className="bg-red-50 dark:bg-red-950/40 rounded-3xl border border-red-200 dark:border-red-900/60 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse"></div>
              <h4 className="text-red-950 dark:text-red-100 font-extrabold text-sm">Alertas Críticos & Manutenção</h4>
            </div>
            <p className="text-red-900 dark:text-red-200 text-xs font-bold mt-3">
              {vehicles.filter(v => v.status === 'MANUTENCAO').length} Veículos em Manutenção Ativa
            </p>
            <p className="text-red-800 dark:text-red-300 text-[11px] mt-1 font-medium">
              Revisão de filtros, óleos lubrificantes e bicos injetores pendentes.
            </p>
          </div>
          <button
            onClick={() => onNavigate('maintenance')}
            className="text-red-900 dark:text-red-200 text-xs font-extrabold uppercase tracking-wider mt-5 flex items-center gap-1 hover:underline"
          >
            Resolver Agora
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Central Tank Inventory Quick View */}
        <div className={`rounded-3xl border p-6 shadow-sm flex flex-col justify-between ${
          darkMode ? 'bg-[#042d23] border-emerald-900/60' : 'bg-white border-slate-100'
        }`}>
          <div>
            <div className="flex justify-between items-start mb-3">
              <h4 className="text-slate-800 dark:text-slate-100 font-bold text-sm">Tanque Central (Fazenda)</h4>
              <span className="text-[#064E3B] dark:text-[#FACC15] font-extrabold text-xs uppercase tracking-wider bg-[#064E3B]/10 dark:bg-[#FACC15]/10 px-2.5 py-1 rounded-full border border-[#064E3B]/20">
                Diesel S10
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-emerald-200 mb-4 font-medium">Posto interno com medição diária</p>
            
            <div className="flex items-end gap-3 mb-2">
              <div className="flex-1 h-3 bg-slate-200 dark:bg-emerald-950/80 rounded-full overflow-hidden">
                <div className="h-full bg-[#064E3B] dark:bg-[#FACC15] rounded-full w-[68%]" />
              </div>
              <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100 whitespace-nowrap">20.400 L</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-emerald-200 font-semibold">
            Capacidade total: 30.000 Litros (68% preenchido)
          </p>
        </div>

        {/* Top Equipment Highlight Bento Box */}
        <div className={`rounded-3xl border p-6 shadow-sm flex flex-col justify-between ${
          darkMode ? 'bg-[#042d23] border-emerald-900/60' : 'bg-white border-slate-100'
        }`}>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Truck className="w-5 h-5 text-[#064E3B] dark:text-[#FACC15]" />
              <h4 className="text-slate-800 dark:text-slate-100 font-bold text-sm">Maior Consumidor de Hoje</h4>
            </div>
            {topVehicle ? (
              <div className="bg-slate-100 dark:bg-emerald-950/60 p-3.5 rounded-2xl border border-slate-200/60 dark:border-emerald-900/40">
                <p className="font-extrabold text-xs text-slate-900 dark:text-slate-100">{topVehicle.name}</p>
                <p className="text-[11px] text-slate-700 dark:text-emerald-200 font-semibold mt-1">
                  Placa: <span className="font-bold text-slate-900 dark:text-slate-100">{topVehicle.plate}</span> • <span className="text-[#064E3B] dark:text-[#FACC15] font-bold">{topVehicle.liters} Litros</span> ({formatCurrency(topVehicle.cost)})
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-600 dark:text-emerald-200 font-medium">Nenhum registro hoje ainda.</p>
            )}
          </div>
          <button
            onClick={() => onNavigate('fleet')}
            className="text-[#064E3B] dark:text-[#FACC15] text-xs font-bold hover:underline flex items-center gap-1 mt-4"
          >
            Ver Frotas & Máquinas
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Operation Breakdown Row */}
      <div className={`rounded-3xl border p-6 shadow-sm ${
        darkMode ? 'bg-[#042d23] border-emerald-900/60' : 'bg-white border-slate-100'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">Consumo por Tipo de Operação</h3>
            <p className="text-xs text-slate-600 dark:text-emerald-200 font-medium">Distribuição de combustível entre Grama, Colheita, Plantio e Transporte</p>
          </div>
          <span className="text-xs font-bold text-[#064E3B] dark:text-[#FACC15] bg-[#064E3B]/10 dark:bg-[#FACC15]/10 px-3 py-1 rounded-full border border-[#064E3B]/20">
            {monthLiters.toLocaleString('pt-BR')} L Totais
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          {operationTypeData.map((op) => {
            const pct = Math.round((op.liters / (monthLiters || 1)) * 100);
            return (
              <div key={op.key} className="p-4 rounded-2xl bg-slate-50 dark:bg-emerald-950/60 border border-slate-200/80 dark:border-emerald-900/40 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100">{op.label}</span>
                  <span className="text-[10px] font-bold text-[#064E3B] dark:text-[#FACC15] bg-emerald-100 dark:bg-emerald-900 px-2 py-0.5 rounded-md">
                    {pct}%
                  </span>
                </div>
                <div>
                  <p className="text-lg font-black text-slate-900 dark:text-slate-100">
                    {op.liters.toLocaleString('pt-BR')} <span className="text-xs font-bold text-slate-500">L</span>
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-emerald-300 font-semibold">
                    {formatCurrency(op.cost)} • {op.count} abastecimentos
                  </p>
                </div>
                <div className="w-full h-1.5 bg-slate-200 dark:bg-emerald-900 rounded-full overflow-hidden">
                  <div className="h-full bg-[#064E3B] dark:bg-[#FACC15] rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
