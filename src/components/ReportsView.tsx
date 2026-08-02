import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, FileText, Printer, Filter, Calendar, Fuel, 
  Truck, Users, DollarSign, Download, CheckCircle2 
} from 'lucide-react';
import { FuelLog, Vehicle, GasStation, User, SystemSettings } from '../types';
import { 
  formatCurrency, formatDateTimeBR, getFuelTypeName, getSectorName, 
  exportFuelLogsPDF, exportFuelLogsCSV 
} from '../utils/calculations';

interface ReportsViewProps {
  fuelLogs: FuelLog[];
  vehicles: Vehicle[];
  gasStations: GasStation[];
  users: User[];
  settings: SystemSettings;
  darkMode: boolean;
}

export const ReportsViewComponent: React.FC<ReportsViewProps> = ({
  fuelLogs = [],
  vehicles = [],
  gasStations = [],
  users = [],
  settings,
  darkMode
}) => {
  const [startDate, setStartDate] = useState<string>('2026-07-01');
  const [endDate, setEndDate] = useState<string>('2026-08-31');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>('ALL');
  const [selectedDriverId, setSelectedDriverId] = useState<string>('ALL');
  const [selectedStationId, setSelectedStationId] = useState<string>('ALL');

  const filteredLogs = useMemo(() => {
    return fuelLogs.filter(log => {
      if (startDate && log.dateTime.slice(0, 10) < startDate) return false;
      if (endDate && log.dateTime.slice(0, 10) > endDate) return false;
      if (selectedCategory !== 'ALL' && log.equipmentCategory !== selectedCategory) return false;
      if (selectedEquipmentId !== 'ALL' && log.equipmentId !== selectedEquipmentId) return false;
      if (selectedDriverId !== 'ALL' && log.driverOrOperatorId !== selectedDriverId) return false;
      if (selectedStationId !== 'ALL' && log.gasStationId !== selectedStationId) return false;
      return true;
    });
  }, [fuelLogs, startDate, endDate, selectedCategory, selectedEquipmentId, selectedDriverId, selectedStationId]);

  const summaryMetrics = useMemo(() => {
    const totalLiters = filteredLogs.reduce((acc, l) => acc + l.liters, 0);
    const totalCost = filteredLogs.reduce((acc, l) => acc + l.totalValue, 0);
    const avgPricePerLiter = totalLiters > 0 ? totalCost / totalLiters : 0;
    return { totalLiters, totalCost, avgPricePerLiter };
  }, [filteredLogs]);

  const { totalLiters, totalCost, avgPricePerLiter } = summaryMetrics;

  const handleExportPDF = () => {
    exportFuelLogsPDF(
      filteredLogs,
      `Relatório de Abastecimentos - AndradeAgro (${startDate || 'Início'} a ${endDate || 'Hoje'})`,
      { name: settings.companyName, slogan: settings.slogan, cnpj: settings.cnpj }
    );
  };

  const handleExportCSV = () => {
    exportFuelLogsCSV(filteredLogs, 'Relatorio_AndradeAgro_Filtrado');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-emerald-100 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            Central de Relatórios & Exportação
          </h1>
          <p className="text-xs text-gray-500 dark:text-emerald-400">
            Geração de relatórios executivos customizados para auditoria e prestação de contas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            className="bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            <span>Gerar PDF Oficial</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center gap-2"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>Exportar Excel (CSV)</span>
          </button>
          <button
            onClick={handlePrint}
            className={`p-2.5 rounded-xl border text-xs font-bold ${
              darkMode ? 'bg-emerald-900/40 border-emerald-800 text-emerald-200' : 'bg-white border-gray-200 text-gray-700'
            }`}
            title="Imprimir Relatório"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Options Card */}
      <div className={`p-5 rounded-2xl border space-y-4 ${
        darkMode ? 'bg-emerald-950/40 border-emerald-900' : 'bg-white border-emerald-100'
      }`}>
        <div className="flex items-center gap-2 font-bold text-xs text-gray-800 dark:text-emerald-200 border-b border-emerald-800/20 pb-3">
          <Filter className="w-4 h-4 text-amber-500" />
          <span>Parâmetros de Filtragem do Relatório</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div>
            <label className="block font-bold mb-1 text-gray-600 dark:text-emerald-300">Data Inicial</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
            />
          </div>

          <div>
            <label className="block font-bold mb-1 text-gray-600 dark:text-emerald-300">Data Final</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
            />
          </div>

          <div>
            <label className="block font-bold mb-1 text-gray-600 dark:text-emerald-300">Categoria</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
            >
              <option value="ALL">Todas</option>
              <option value="VEICULO">Veículos</option>
              <option value="TRATOR">Tratores</option>
              <option value="MAQUINA_AGRICOLA">Máquinas Agrícolas</option>
            </select>
          </div>

          <div>
            <label className="block font-bold mb-1 text-gray-600 dark:text-emerald-300">Equipamento</label>
            <select
              value={selectedEquipmentId}
              onChange={(e) => setSelectedEquipmentId(e.target.value)}
              className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
            >
              <option value="ALL">Todos</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.model} ({v.licensePlate || v.patrimonyCode})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold mb-1 text-gray-600 dark:text-emerald-300">Motorista / Operador</label>
            <select
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
            >
              <option value="ALL">Todos</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold mb-1 text-gray-600 dark:text-emerald-300">Posto de Origem</label>
            <select
              value={selectedStationId}
              onChange={(e) => setSelectedStationId(e.target.value)}
              className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
            >
              <option value="ALL">Todos os Postos</option>
              {gasStations.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Report Summary Overview Card */}
      <div className={`p-6 rounded-2xl border ${
        darkMode ? 'bg-emerald-950/40 border-emerald-900' : 'bg-white border-emerald-100 shadow-sm'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 border-emerald-800/20">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Resumo Consolidado do Período
            </span>
            <h2 className="text-xl font-extrabold text-gray-900 dark:text-emerald-100">
              {settings.companyName} - Fazenda Andrade
            </h2>
            <p className="text-xs text-gray-500 dark:text-emerald-300">
              {filteredLogs.length} registros selecionados • Período: {startDate} até {endDate}
            </p>
          </div>

          <div className="flex gap-4">
            <div>
              <span className="text-[10px] font-bold text-gray-500 dark:text-emerald-400 block">Volume Total</span>
              <span className="text-xl font-black text-emerald-700 dark:text-emerald-300">{totalLiters.toLocaleString('pt-BR')} L</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-500 dark:text-emerald-400 block">Investimento Total</span>
              <span className="text-xl font-black text-amber-600 dark:text-amber-400">{formatCurrency(totalCost)}</span>
            </div>
          </div>
        </div>

        {/* Preview Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b font-bold uppercase text-[10px] text-gray-500 dark:text-emerald-400">
                <th className="p-2">Data/Hora</th>
                <th className="p-2">Placa/Cód.</th>
                <th className="p-2">Equipamento</th>
                <th className="p-2">Motorista</th>
                <th className="p-2">Posto</th>
                <th className="p-2">Combustível</th>
                <th className="p-2">Litros</th>
                <th className="p-2">R$/L</th>
                <th className="p-2">Total R$</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900/30">
              {filteredLogs.map(log => (
                <tr key={log.id}>
                  <td className="p-2">{formatDateTimeBR(log.dateTime)}</td>
                  <td className="p-2 font-bold text-amber-600">{log.equipmentPlateOrCode}</td>
                  <td className="p-2 font-semibold">{log.equipmentName}</td>
                  <td className="p-2">{log.driverOrOperatorName}</td>
                  <td className="p-2">{log.gasStationName}</td>
                  <td className="p-2">{getFuelTypeName(log.fuelType)}</td>
                  <td className="p-2 font-bold">{log.liters} L</td>
                  <td className="p-2">{formatCurrency(log.pricePerLiter)}</td>
                  <td className="p-2 font-black">{formatCurrency(log.totalValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export const ReportsView = React.memo(ReportsViewComponent);
