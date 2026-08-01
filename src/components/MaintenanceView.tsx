import React, { useState, useMemo } from 'react';
import { 
  Wrench, Plus, Search, Filter, Calendar, CheckCircle2, 
  Clock, AlertTriangle, DollarSign, X, FileText, ChevronRight 
} from 'lucide-react';
import { MaintenanceLog, MaintenanceType, Vehicle, User } from '../types';
import { formatCurrency, formatDateBR } from '../utils/calculations';

interface MaintenanceViewProps {
  maintenanceLogs: MaintenanceLog[];
  vehicles: Vehicle[];
  users: User[];
  currentUser: User;
  onAddMaintenance: (m: Omit<MaintenanceLog, 'id'>) => void;
  onUpdateMaintenance: (id: string, fields: Partial<MaintenanceLog>) => void;
  darkMode: boolean;
}

export const MaintenanceView: React.FC<MaintenanceViewProps> = ({
  maintenanceLogs,
  vehicles,
  users,
  currentUser,
  onAddMaintenance,
  onUpdateMaintenance,
  darkMode
}) => {
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // New Maintenance Form
  const [equipmentId, setEquipmentId] = useState(vehicles[0]?.id || '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<MaintenanceType>('REVISAO');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kmOrHourAtService, setKmOrHourAtService] = useState(0);
  const [nextServiceKmOrHour, setNextServiceKmOrHour] = useState(0);
  const [cost, setCost] = useState(0);
  const [supplierOrWorkshop, setSupplierOrWorkshop] = useState('Oficina Interna Fazenda Andrade');
  const [performedBy, setPerformedBy] = useState(users[0]?.name || 'Técnico Responsável');

  const filteredLogs = useMemo(() => {
    return maintenanceLogs.filter(m => {
      if (search) {
        const q = search.toLowerCase();
        const matchTitle = m.title.toLowerCase().includes(q);
        const matchEquip = m.equipmentName.toLowerCase().includes(q);
        const matchPlate = m.equipmentPlateOrCode.toLowerCase().includes(q);
        if (!matchTitle && !matchEquip && !matchPlate) return false;
      }
      if (typeFilter !== 'ALL' && m.type !== typeFilter) return false;
      return true;
    });
  }, [maintenanceLogs, search, typeFilter]);

  const totalMaintenanceCost = filteredLogs.reduce((acc, m) => acc + m.cost, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const eq = vehicles.find(v => v.id === equipmentId);
    if (!eq) return;

    onAddMaintenance({
      equipmentId: eq.id,
      equipmentName: eq.model,
      equipmentPlateOrCode: eq.licensePlate || eq.patrimonyCode || 'S/PLACA',
      date,
      type,
      title,
      description,
      kmOrHourAtService,
      nextServiceKmOrHour: nextServiceKmOrHour || undefined,
      cost,
      supplierOrWorkshop,
      performedBy,
      status: 'CONCLUIDO'
    });

    setShowModal(false);
    setTitle('');
    setDescription('');
    setCost(0);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-emerald-100 flex items-center gap-2">
            <Wrench className="w-6 h-6 text-amber-500" />
            Controle de Manutenções & Revisões
          </h1>
          <p className="text-xs text-gray-500 dark:text-emerald-400">
            Revisões preventivas, trocas de óleo, filtros, pneus e reparos corretivos das frotas.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          <span>Cadastrar Manutenção</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={`p-4 rounded-xl border ${darkMode ? 'bg-emerald-950/40 border-emerald-900' : 'bg-white border-emerald-100'}`}>
          <span className="text-[10px] font-bold text-gray-500 uppercase">Total de Manutenções</span>
          <p className="text-xl font-black text-gray-900 dark:text-emerald-100">{filteredLogs.length}</p>
        </div>
        <div className={`p-4 rounded-xl border ${darkMode ? 'bg-emerald-950/40 border-emerald-900' : 'bg-white border-emerald-100'}`}>
          <span className="text-[10px] font-bold text-gray-500 uppercase">Custo Acumulado</span>
          <p className="text-xl font-black text-amber-600 dark:text-amber-400">{formatCurrency(totalMaintenanceCost)}</p>
        </div>
        <div className={`p-4 rounded-xl border ${darkMode ? 'bg-emerald-950/40 border-emerald-900' : 'bg-white border-emerald-100'}`}>
          <span className="text-[10px] font-bold text-gray-500 uppercase">Concluídas</span>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
            {filteredLogs.filter(l => l.status === 'CONCLUIDO').length}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className={`p-4 rounded-2xl border space-y-3 ${
        darkMode ? 'bg-emerald-950/40 border-emerald-900' : 'bg-white border-emerald-100'
      }`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <input
            type="text"
            placeholder="Buscar por título ou equipamento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`px-3 py-2 rounded-xl border outline-none ${
              darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 border-gray-200'
            }`}
          />

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className={`px-3 py-2 rounded-xl border outline-none ${
              darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 border-gray-200'
            }`}
          >
            <option value="ALL">Todos os Tipos</option>
            <option value="REVISAO">Revisões Preventivas</option>
            <option value="TROCA_OLEO">Troca de Óleo</option>
            <option value="TROCA_FILTROS">Troca de Filtros</option>
            <option value="PNEUS">Pneus / Esteiras</option>
            <option value="SERVICO_CORRETIVO">Serviços Corretivos</option>
          </select>
        </div>
      </div>

      {/* Maintenance Logs List */}
      <div className="space-y-3">
        {filteredLogs.map(m => (
          <div
            key={m.id}
            className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
              darkMode ? 'bg-emerald-950/40 border-emerald-900' : 'bg-white border-emerald-100 shadow-sm'
            }`}
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300">
                    {m.type}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-emerald-400 font-medium">
                    Data: {formatDateBR(m.date)}
                  </span>
                </div>
                <h3 className="font-extrabold text-sm text-gray-900 dark:text-emerald-100 mt-0.5">
                  {m.title}
                </h3>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-bold">
                  {m.equipmentName} ({m.equipmentPlateOrCode})
                </p>
                <p className="text-xs text-gray-500 dark:text-emerald-300/80 mt-1">
                  {m.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end border-t md:border-t-0 pt-2 md:pt-0 border-emerald-800/10">
              <div className="text-right">
                <span className="text-[10px] text-gray-500 dark:text-emerald-400 block">Custo Total</span>
                <span className="font-black text-sm text-gray-900 dark:text-emerald-100">{formatCurrency(m.cost)}</span>
              </div>

              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                m.status === 'CONCLUIDO' 
                  ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300' 
                  : m.status === 'EM_ANDAMENTO' 
                  ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300' 
                  : 'bg-gray-200 text-gray-700'
              }`}>
                {m.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* New Maintenance Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className={`w-full max-w-lg rounded-2xl shadow-2xl border p-5 space-y-4 max-h-[90vh] overflow-y-auto ${
            darkMode ? 'bg-emerald-950 border-emerald-800 text-emerald-100' : 'bg-white border-emerald-100 text-gray-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-emerald-800/20">
              <span className="font-bold text-sm">Registrar Manutenção / Serviço</span>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-emerald-500/10">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Equipamento</label>
                <select
                  value={equipmentId}
                  onChange={(e) => setEquipmentId(e.target.value)}
                  className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800' : 'bg-gray-50'}`}
                >
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.model} ({v.licensePlate || v.patrimonyCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Data</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800' : 'bg-gray-50'}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Tipo de Manutenção</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as MaintenanceType)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800' : 'bg-gray-50'}`}
                  >
                    <option value="REVISAO">Revisão Preventiva</option>
                    <option value="TROCA_OLEO">Troca de Óleo</option>
                    <option value="TROCA_FILTROS">Troca de Filtros</option>
                    <option value="PNEUS">Pneus / Esteiras</option>
                    <option value="SERVICO_CORRETIVO">Serviço Corretivo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Título do Serviço</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Troca de óleo 15W40 e filtro separador..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800' : 'bg-gray-50'}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Custo Total (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={cost}
                    onChange={(e) => setCost(parseFloat(e.target.value) || 0)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800' : 'bg-gray-50'}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Oficina / Fornecedor</label>
                  <input
                    type="text"
                    value={supplierOrWorkshop}
                    onChange={(e) => setSupplierOrWorkshop(e.target.value)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800' : 'bg-gray-50'}`}
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Descrição detalhada</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800' : 'bg-gray-50'}`}
                />
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
                  Salvar Manutenção
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
