import { FuelLog, Vehicle, FuelType, Sector, GasStation } from '../types';
import { getOperationTypeName, getActivityTypeName, getEffectiveActivityName, getEffectiveCategoryName } from './operations';

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

export function formatNumber(value: number, decimals: number = 1): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value || 0);
}

const TIMEZONE_BR = 'America/Sao_Paulo';

/**
 * Retorna a data de hoje (YYYY-MM-DD) no fuso horário do Brasil (America/Sao_Paulo).
 * Garante que em horários noturnos a data local não pule incorretamente para o dia seguinte.
 */
export function getTodayDateSaoPaulo(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE_BR,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Retorna o horário atual (HH:mm) no fuso horário do Brasil (America/Sao_Paulo).
 */
export function getCurrentTimeSaoPaulo(): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: TIMEZONE_BR,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());
  } catch {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}

/**
 * Retorna a data e hora atual no fuso de Brasília em formato ISO com offset -03:00.
 */
export function getNowSaoPauloISO(): string {
  const today = getTodayDateSaoPaulo();
  const time = getCurrentTimeSaoPaulo();
  const now = new Date();
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${today}T${time}:${seconds}-03:00`;
}

/**
 * Gera um timestamp ISO com offset correto do Brasil (-03:00) para uma data (YYYY-MM-DD)
 * e hora opcional (HH:mm ou atual).
 */
export function createTimestampForDateSaoPaulo(dateStr: string, timeStr?: string): string {
  if (!dateStr) return getNowSaoPauloISO();
  const cleanDate = dateStr.trim().slice(0, 10);
  let hours = '12';
  let minutes = '00';
  let seconds = '00';

  if (timeStr && /^\d{2}:\d{2}(:\d{2})?$/.test(timeStr.trim())) {
    const parts = timeStr.trim().split(':');
    hours = parts[0];
    minutes = parts[1];
    seconds = parts[2] || '00';
  } else {
    try {
      const timeFmt = new Intl.DateTimeFormat('pt-BR', {
        timeZone: TIMEZONE_BR,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      const parts = timeFmt.formatToParts(new Date());
      hours = parts.find(p => p.type === 'hour')?.value || '12';
      minutes = parts.find(p => p.type === 'minute')?.value || '00';
      seconds = parts.find(p => p.type === 'second')?.value || '00';
    } catch {
      const d = new Date();
      hours = String(d.getHours()).padStart(2, '0');
      minutes = String(d.getMinutes()).padStart(2, '0');
      seconds = String(d.getSeconds()).padStart(2, '0');
    }
  }

  return `${cleanDate}T${hours}:${minutes}:${seconds}-03:00`;
}

/**
 * Formata qualquer data para DD/MM/AAAA no fuso horário do Brasil (America/Sao_Paulo).
 * Se a data de entrada for pura (YYYY-MM-DD) ou vier com falso UTC meia-noite,
 * garante que NUNCA retroceda um dia.
 */
export function formatDateBR(dateInput: string | number | Date | any): string {
  if (!dateInput) return '-';
  
  // Suporte a Firestore Timestamp
  if (typeof dateInput === 'object' && dateInput !== null && !(dateInput instanceof Date)) {
    if (typeof dateInput.toDate === 'function') {
      dateInput = dateInput.toDate();
    } else if (typeof dateInput.seconds === 'number') {
      dateInput = new Date(dateInput.seconds * 1000);
    }
  }

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (!trimmed) return '-';

    // Formato puro YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-');
      return `${day}/${month}/${year}`;
    }
    // Já formatado como DD/MM/AAAA
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      return trimmed;
    }
    // Falso UTC da meia-noite YYYY-MM-DDT00:00:00...
    if (/^\d{4}-\d{2}-\d{2}T00:00(:00)?(\.000)?(Z|[+-]\d{2}:\d{2})?$/i.test(trimmed)) {
      const [datePart] = trimmed.split('T');
      const [year, month, day] = datePart.split('-');
      return `${day}/${month}/${year}`;
    }
  }

  try {
    let d: Date;
    if (typeof dateInput === 'number') {
      d = new Date(dateInput);
    } else if (typeof dateInput === 'string') {
      const trimmed = dateInput.trim();
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(trimmed)) {
        d = new Date(`${trimmed}-03:00`);
      } else {
        d = new Date(trimmed);
      }
    } else {
      d = dateInput;
    }

    if (isNaN(d.getTime())) return typeof dateInput === 'string' ? dateInput : '-';

    const dateStr = new Intl.DateTimeFormat('pt-BR', {
      timeZone: TIMEZONE_BR,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);

    // Proteção rigorosa contra recuo indevido de dia por meia-noite UTC
    if (typeof dateInput === 'string') {
      const m = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) {
        const [, y, mo, da] = m;
        const expectedDateStr = `${da}/${mo}/${y}`;
        if (expectedDateStr !== dateStr && (dateInput.includes('T00:00:00') || dateInput.includes('T01:00:00') || dateInput.includes('T02:00:00') || dateInput.includes('T03:00:00'))) {
          return expectedDateStr;
        }
      }
    }

    return dateStr;
  } catch {
    return String(dateInput);
  }
}

export const formatDateSaoPaulo = formatDateBR;

/**
 * Formata data e horário para DD/MM/AAAA HH:mm no fuso horário do Brasil (America/Sao_Paulo).
 * Garante que:
 * 1. Strings sem horário (YYYY-MM-DD) ou com meia-noite UTC NÃO exibam o falso "21:00".
 * 2. Strings com data e hora reais mantenham a data intacta (nunca volte 1 dia) e preservem
 *    o horário exato em que o evento ocorreu.
 */
export function formatDateTimeBR(dateTimeInput: string | number | Date | any): string {
  if (!dateTimeInput) return '-';

  // Suporte a Firestore Timestamp
  if (typeof dateTimeInput === 'object' && dateTimeInput !== null && !(dateTimeInput instanceof Date)) {
    if (typeof dateTimeInput.toDate === 'function') {
      dateTimeInput = dateTimeInput.toDate();
    } else if (typeof dateTimeInput.seconds === 'number') {
      dateTimeInput = new Date(dateTimeInput.seconds * 1000);
    }
  }

  if (typeof dateTimeInput === 'string') {
    const trimmed = dateTimeInput.trim();
    if (!trimmed) return '-';

    // 1. Formato puro YYYY-MM-DD -> não há horário gravado, não inventar 21:00
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-');
      return `${day}/${month}/${year}`;
    }

    // 2. Falso UTC da meia-noite gerado por serialização UTC de data pura -> não exibir 21:00!
    if (/^\d{4}-\d{2}-\d{2}T00:00(:00)?(\.000)?(Z|[+-]\d{2}:\d{2})?$/i.test(trimmed)) {
      const [datePart] = trimmed.split('T');
      const [year, month, day] = datePart.split('-');
      return `${day}/${month}/${year}`;
    }

    // 3. String de datetime-local sem timezone (ex: "2026-09-07T14:30"):
    // Como foi digitada no Brasil, os valores de data e hora já estão em horário local de Brasília!
    const noOffsetMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (noOffsetMatch) {
      const [, y, m, d, hh, mm] = noOffsetMatch;
      if (hh === '00' && mm === '00') {
        return `${d}/${m}/${y}`;
      }
      return `${d}/${m}/${y} ${hh}:${mm}`;
    }
  }

  try {
    let d: Date;
    if (typeof dateTimeInput === 'number') {
      d = new Date(dateTimeInput);
    } else if (typeof dateTimeInput === 'string') {
      const trimmed = dateTimeInput.trim();
      // Se string sem offset, assume fuso de Brasília (-03:00)
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(trimmed)) {
        d = new Date(`${trimmed}-03:00`);
      } else {
        d = new Date(trimmed);
      }
    } else {
      d = dateTimeInput;
    }

    if (isNaN(d.getTime())) return typeof dateTimeInput === 'string' ? dateTimeInput : '-';

    const dateStr = new Intl.DateTimeFormat('pt-BR', {
      timeZone: TIMEZONE_BR,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);

    const timeStr = new Intl.DateTimeFormat('pt-BR', {
      timeZone: TIMEZONE_BR,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);

    // Proteção contra offset UTC que converte 00:00 UTC para 21:00 do dia anterior
    if (typeof dateTimeInput === 'string') {
      const m = dateTimeInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) {
        const [, y, mo, da] = m;
        const expectedDateStr = `${da}/${mo}/${y}`;
        if (expectedDateStr !== dateStr && (timeStr === '21:00' || timeStr === '20:00' || timeStr === '22:00')) {
          // O dia voltou para trás devido à conversão de meia-noite UTC! Preserva a data real sem o falso 21:00.
          return expectedDateStr;
        }
      }
    }

    return `${dateStr} ${timeStr}`;
  } catch {
    return String(dateTimeInput);
  }
}

export const formatDateTimeSaoPaulo = formatDateTimeBR;

export function getFuelTypeName(fuelType: FuelType | string | undefined | null): string {
  if (!fuelType || fuelType === 'NENHUM') return 'Nenhum (Não se aplica)';
  switch (fuelType) {
    case 'DIESEL_S10': return 'Diesel S10';
    case 'DIESEL_S500': return 'Diesel S500';
    case 'GASOLINA_COMUM': return 'Gasolina Comum';
    case 'GASOLINA_GRID': return 'Gasolina Aditivada';
    case 'ETANOL': return 'Etanol Hidratado';
    case 'ARLA_32': return 'Arla 32';
    default: return fuelType;
  }
}

/**
 * Resolves the precise price per liter for a given fuel type and gas station.
 * Strictly respects gasoline, ethanol, arla, and diesel categories without cross-contamination.
 */
export function getStationFuelPrice(station?: GasStation, fuelType?: FuelType | string | null): number {
  if (!fuelType || fuelType === 'NENHUM') {
    return 0;
  }

  const rawType = String(fuelType).toUpperCase();
  const prices = station?.pricePerLiter;

  // 1. Direct match in station's price map
  if (prices && typeof (prices as any)[rawType] === 'number' && (prices as any)[rawType] > 0) {
    return (prices as any)[rawType];
  }

  // 2. Category-based resolution
  if (rawType.includes('GASOLINA')) {
    if (rawType.includes('GRID') || rawType.includes('ADITIVADA')) {
      return prices?.GASOLINA_GRID || prices?.GASOLINA_COMUM || 6.29;
    }
    return prices?.GASOLINA_COMUM || prices?.GASOLINA_GRID || 5.99;
  }

  if (rawType.includes('ETANOL') || rawType.includes('ALCOOL')) {
    return prices?.ETANOL || 3.89;
  }

  if (rawType.includes('ARLA')) {
    return prices?.ARLA_32 || 2.50;
  }

  if (rawType.includes('S500')) {
    return prices?.DIESEL_S500 || prices?.DIESEL_S10 || 5.59;
  }

  if (rawType.includes('DIESEL')) {
    return prices?.DIESEL_S10 || prices?.DIESEL_S500 || 5.79;
  }

  // Default fallback according to station diesel
  return prices?.DIESEL_S10 || 5.79;
}

export function getSectorName(sector: Sector): string {
  switch (sector) {
    case 'AGRICOLA': return 'Agrícola';
    case 'LOGISTICA': return 'Logística / Transportes';
    case 'OFICINA_MANUTENCAO': return 'Oficina & Manutenção';
    case 'DIRETORIA': return 'Diretoria Executiva';
    case 'COLHEITA': return 'Colheita';
    case 'PULVERIZACAO': return 'Pulverização';
    case 'PREPARO_SOLO': return 'Preparo de Solo';
    default: return sector;
  }
}

export function getCategoryLabel(category?: string | null): string {
  switch (category) {
    case 'TRATOR': return 'Trator';
    case 'VEICULO': return 'Veículo';
    case 'MAQUINA_AGRICOLA': return 'Máquina Agrícola';
    case 'IMPLEMENTO': return 'Implemento';
    default: return category || 'Equipamento';
  }
}

export const getCategoryName = getCategoryLabel;

export function calculateFuelLogMetrics(
  liters: number,
  pricePerLiter: number,
  equipment: Vehicle,
  currentKmOrHour: number,
  previousLogsForEquipment: FuelLog[],
  suspiciousMarginPercent: number = 25
): {
  totalValue: number;
  calculatedAverageKmPerLiter?: number;
  calculatedAverageLitersPerHour?: number;
  costPerKm?: number;
  costPerHour?: number;
  estimatedAutonomyKmOrHours?: number;
  previousKmOrHour?: number;
  flaggedSuspicious: boolean;
  suspiciousReason?: string;
} {
  const totalValue = Number((liters * pricePerLiter).toFixed(2));
  
  // Find last previous fuel log for this equipment
  const sortedLogs = [...previousLogsForEquipment].sort(
    (a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()
  );
  
  const lastLog = sortedLogs[0];
  const isKmBased = equipment.category === 'VEICULO';
  let previousKmOrHour = lastLog 
    ? (isKmBased ? lastLog.kmAtFueling : lastLog.hourmeterAtFueling)
    : (isKmBased ? equipment.currentKm : equipment.currentHourmeter);

  let calculatedAverageKmPerLiter: number | undefined;
  let calculatedAverageLitersPerHour: number | undefined;
  let costPerKm: number | undefined;
  let costPerHour: number | undefined;
  let estimatedAutonomyKmOrHours: number | undefined;
  let flaggedSuspicious = false;
  let suspiciousReason: string | undefined;

  if (previousKmOrHour !== undefined && currentKmOrHour > previousKmOrHour && liters > 0) {
    const diff = currentKmOrHour - previousKmOrHour;

    if (isKmBased) {
      // km per Liter
      calculatedAverageKmPerLiter = Number((diff / liters).toFixed(2));
      costPerKm = Number((totalValue / diff).toFixed(3));
      estimatedAutonomyKmOrHours = Number((equipment.tankCapacityLiters * calculatedAverageKmPerLiter).toFixed(0));

      // Historical average
      const prevAverages = sortedLogs
        .map(l => l.calculatedAverageKmPerLiter)
        .filter((val): val is number => val !== undefined && val > 0);

      if (prevAverages.length > 0) {
        const avgKmL = prevAverages.reduce((acc, v) => acc + v, 0) / prevAverages.length;
        // If km/L dropped significantly (e.g. consuming way more fuel per km)
        if (calculatedAverageKmPerLiter < avgKmL * (1 - suspiciousMarginPercent / 100)) {
          flaggedSuspicious = true;
          suspiciousReason = `Rendimento de ${calculatedAverageKmPerLiter} km/L está ${suspiciousMarginPercent}% abaixo da média histórica (${avgKmL.toFixed(2)} km/L).`;
        }
      }
    } else {
      // Liters per Hour
      calculatedAverageLitersPerHour = Number((liters / diff).toFixed(2));
      costPerHour = Number((totalValue / diff).toFixed(2));
      if (calculatedAverageLitersPerHour > 0) {
        estimatedAutonomyKmOrHours = Number((equipment.tankCapacityLiters / calculatedAverageLitersPerHour).toFixed(1));
      }

      // Historical average
      const prevAverages = sortedLogs
        .map(l => l.calculatedAverageLitersPerHour)
        .filter((val): val is number => val !== undefined && val > 0);

      if (prevAverages.length > 0) {
        const avgLh = prevAverages.reduce((acc, v) => acc + v, 0) / prevAverages.length;
        // If Liters per hour spiked
        if (calculatedAverageLitersPerHour > avgLh * (1 + suspiciousMarginPercent / 100)) {
          flaggedSuspicious = true;
          suspiciousReason = `Consumo de ${calculatedAverageLitersPerHour} L/h está ${suspiciousMarginPercent}% acima da média histórica (${avgLh.toFixed(1)} L/h).`;
        }
      }
    }
  }

  return {
    totalValue,
    calculatedAverageKmPerLiter,
    calculatedAverageLitersPerHour,
    costPerKm,
    costPerHour,
    estimatedAutonomyKmOrHours,
    previousKmOrHour,
    flaggedSuspicious,
    suspiciousReason
  };
}

// PDF Export Function - Relatório Oficial Tradicional (Tabela)
export async function exportFuelLogsPDF(
  logs: FuelLog[],
  title: string = 'Relatório de Abastecimentos',
  companyInfo: { name: string; slogan: string; cnpj: string },
  canViewFinancial: boolean = true
) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // Header Design
  doc.setFillColor(15, 56, 34); // Forest Agro Green
  doc.rect(0, 0, 297, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(companyInfo.name.toUpperCase(), 14, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(companyInfo.slogan, 14, 18);

  doc.text(`Emitido em: ${formatDateTimeBR(new Date().toISOString())}`, 220, 12);
  doc.text(`CNPJ: ${companyInfo.cnpj}`, 220, 18);

  // Document Title
  doc.setTextColor(20, 40, 25);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 33);

  // Table Data
  const tableData = logs.map(log => {
    const baseCols = [
      formatDateTimeBR(log.dateTime),
      log.equipmentPlateOrCode,
      log.equipmentName,
      log.driverOrOperatorName,
      `${getOperationTypeName(log.operationType)}${log.activityType ? ' - ' + getActivityTypeName(log.activityType, log.operationType) : ''}`,
      log.gasStationName,
      getFuelTypeName(log.fuelType),
      `${log.liters} L`
    ];

    if (canViewFinancial) {
      baseCols.push(formatCurrency(log.pricePerLiter));
      baseCols.push(formatCurrency(log.totalValue));
    }

    baseCols.push(log.calculatedAverageKmPerLiter ? `${log.calculatedAverageKmPerLiter} km/L` : log.calculatedAverageLitersPerHour ? `${log.calculatedAverageLitersPerHour} L/h` : '-');
    return baseCols;
  });

  const totalLiters = logs.reduce((acc, l) => acc + (l.liters || 0), 0);
  const totalCost = logs.reduce((acc, l) => acc + (l.totalValue || 0), 0);

  const headCols = canViewFinancial
    ? ['Data/Hora', 'Placa/Cód.', 'Equipamento', 'Motorista/Operador', 'Operação / Atividade', 'Posto', 'Combustível', 'Litros', 'R$/L', 'Total R$', 'Média']
    : ['Data/Hora', 'Placa/Cód.', 'Equipamento', 'Motorista/Operador', 'Operação / Atividade', 'Posto', 'Combustível', 'Litros', 'Média'];

  const footCols = canViewFinancial
    ? ['TOTAL', `${logs.length} reg.`, '-', '-', '-', '-', '-', `${totalLiters.toLocaleString('pt-BR')} L`, '-', formatCurrency(totalCost), '-']
    : ['TOTAL', `${logs.length} reg.`, '-', '-', '-', '-', '-', `${totalLiters.toLocaleString('pt-BR')} L`, '-'];

  autoTable(doc, {
    startY: 38,
    head: [headCols],
    body: tableData,
    foot: [footCols],
    theme: 'grid',
    headStyles: {
      fillColor: [20, 78, 46],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8
    },
    footStyles: {
      fillColor: [230, 240, 234],
      textColor: [15, 56, 34],
      fontStyle: 'bold',
      fontSize: 8
    },
    styles: {
      fontSize: 7,
      cellPadding: 1.5
    },
    alternateRowStyles: {
      fillColor: [248, 250, 248]
    }
  });

  doc.save(`AndradeAgro_Relatorio_Oficial_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export interface ExecutiveReportOptions {
  logs: FuelLog[];
  vehicles: Vehicle[];
  companyInfo: { name: string; slogan: string; cnpj: string };
  dateRangeStr: string;
  canViewFinancial: boolean;
  appliedFiltersDesc?: string;
}

// PDF Export Function - Relatório Executivo Completo com Resumo Gerencial e Gráficos Vetoriais
export async function exportExecutiveReportPDF(options: ExecutiveReportOptions) {
  const {
    logs,
    vehicles,
    companyInfo,
    dateRangeStr,
    canViewFinancial,
    appliedFiltersDesc = 'Filtros aplicados: Período padrão'
  } = options;

  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // 1. Cálculos do Resumo Gerencial
  const totalLiters = logs.reduce((acc, l) => acc + (l.liters || 0), 0);
  const totalCost = logs.reduce((acc, l) => acc + (l.totalValue || 0), 0);
  const totalCount = logs.length;
  const avgLitersPerLog = totalCount > 0 ? (totalLiters / totalCount) : 0;

  // Mapa de setores dos veículos
  const vehicleMap = new Map<string, Vehicle>();
  vehicles.forEach(v => {
    if (v.id) vehicleMap.set(v.id, v);
  });

  // Top Máquinas
  const eqMap = new Map<string, { name: string; code: string; liters: number; cost: number; count: number }>();
  // Top Operadores
  const opMap = new Map<string, { name: string; liters: number; cost: number; count: number }>();
  // Top Atividades
  const actMap = new Map<string, { name: string; liters: number; cost: number; count: number }>();
  // Top Operações
  const operMap = new Map<string, { name: string; liters: number; cost: number; count: number }>();
  // Consumo por Setor
  const secMap = new Map<string, { name: string; liters: number; cost: number; count: number }>();
  // Consumo Temporal (por data YYYY-MM-DD)
  const timeMap = new Map<string, { date: string; liters: number; cost: number }>();

  logs.forEach(l => {
    const liters = l.liters || 0;
    const cost = l.totalValue || 0;

    // Equipamento
    const eqKey = l.equipmentId || l.equipmentName || 'OUTRO';
    const eqCur = eqMap.get(eqKey) || { name: l.equipmentName || 'Equipamento', code: l.equipmentPlateOrCode || '', liters: 0, cost: 0, count: 0 };
    eqCur.liters += liters;
    eqCur.cost += cost;
    eqCur.count += 1;
    eqMap.set(eqKey, eqCur);

    // Operador
    const opKey = l.driverOrOperatorId || l.driverOrOperatorName || 'NÃO INFORMADO';
    const opCur = opMap.get(opKey) || { name: l.driverOrOperatorName || 'Não Informado', liters: 0, cost: 0, count: 0 };
    opCur.liters += liters;
    opCur.cost += cost;
    opCur.count += 1;
    opMap.set(opKey, opCur);

    // Atividade
    const actName = getEffectiveActivityName(l);
    const actCur = actMap.get(actName) || { name: actName, liters: 0, cost: 0, count: 0 };
    actCur.liters += liters;
    actCur.cost += cost;
    actCur.count += 1;
    actMap.set(actName, actCur);

    // Operação
    const operName = getEffectiveCategoryName(l);
    const operCur = operMap.get(operName) || { name: operName, liters: 0, cost: 0, count: 0 };
    operCur.liters += liters;
    operCur.cost += cost;
    operCur.count += 1;
    operMap.set(operName, operCur);

    // Setor (via cruzamento com veículos)
    const veh = vehicleMap.get(l.equipmentId);
    const sectorRaw = veh?.sector || 'AGRICOLA';
    const sectorLabel = getSectorName(sectorRaw);
    const secCur = secMap.get(sectorLabel) || { name: sectorLabel, liters: 0, cost: 0, count: 0 };
    secCur.liters += liters;
    secCur.cost += cost;
    secCur.count += 1;
    secMap.set(sectorLabel, secCur);

    // Temporal
    const dateKey = (l.dateTime || '').slice(0, 10);
    if (dateKey) {
      const tCur = timeMap.get(dateKey) || { date: dateKey, liters: 0, cost: 0 };
      tCur.liters += liters;
      tCur.cost += cost;
      timeMap.set(dateKey, tCur);
    }
  });

  const sortedEq = Array.from(eqMap.values()).sort((a, b) => b.liters - a.liters);
  const sortedOp = Array.from(opMap.values()).sort((a, b) => b.liters - a.liters);
  const sortedAct = Array.from(actMap.values()).sort((a, b) => b.liters - a.liters);
  const sortedOper = Array.from(operMap.values()).sort((a, b) => b.liters - a.liters);
  const sortedSec = Array.from(secMap.values()).sort((a, b) => b.liters - a.liters);
  const sortedTime = Array.from(timeMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  const topEquipment = sortedEq[0];
  const topOperator = sortedOp[0];
  const topActivity = sortedAct[0];
  const topOperation = sortedOper[0];
  const topSector = sortedSec[0];

  // ==========================================
  // PÁGINA 1: DASHBOARD EXECUTIVO & GRÁFICOS
  // ==========================================

  // Cabeçalho Principal Verde Floresta
  doc.setFillColor(15, 56, 34);
  doc.rect(0, 0, 297, 23, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(companyInfo.name.toUpperCase(), 14, 11);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(companyInfo.slogan, 14, 17);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO EXECUTIVO GERENCIAL', 283, 10, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Emissão: ${formatDateTimeBR(new Date().toISOString())} • CNPJ: ${companyInfo.cnpj}`, 283, 17, { align: 'right' });

  // Faixa de Contexto e Período
  doc.setFillColor(243, 247, 244);
  doc.setDrawColor(210, 225, 215);
  doc.rect(14, 26, 269, 9, 'FD');

  doc.setTextColor(20, 50, 30);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`Período Selecionado: ${dateRangeStr}`, 18, 32);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 100, 90);
  doc.text(`${totalCount} abastecimentos filtrados • ${appliedFiltersDesc}`, 280, 32, { align: 'right' });

  // ------------------------------------------
  // CARDS DE RESUMO GERENCIAL (Grid 4x2)
  // ------------------------------------------
  const cardsStartY = 38;
  const cardW = 64.5;
  const cardH = 15;
  const cardGap = 4;

  const kpiList = [
    {
      title: 'VOLUME TOTAL',
      value: `${totalLiters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`,
      sub: `${totalCount} abastecimentos`,
      color: [16, 110, 60]
    },
    {
      title: 'INVESTIMENTO TOTAL',
      value: canViewFinancial ? formatCurrency(totalCost) : 'Restrito (Admin)',
      sub: canViewFinancial && totalLiters > 0 ? `Méd: ${formatCurrency(totalCost / totalLiters)}/L` : 'Perfil Operacional',
      color: canViewFinancial ? [180, 100, 15] : [100, 110, 120]
    },
    {
      title: 'MÉDIA POR ABASTECIMENTO',
      value: `${avgLitersPerLog.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`,
      sub: totalCount > 0 ? 'Média por operação' : 'Sem registros',
      color: [14, 116, 144]
    },
    {
      title: 'MÁQUINA MAIOR CONSUMO',
      value: topEquipment ? `${topEquipment.name.slice(0, 18)}` : 'N/A',
      sub: topEquipment ? `${topEquipment.liters.toLocaleString('pt-BR')} L (${totalLiters > 0 ? Math.round((topEquipment.liters / totalLiters) * 100) : 0}%)` : '-',
      color: [120, 53, 15]
    },
    {
      title: 'OPERADOR MAIOR VOLUME',
      value: topOperator ? `${topOperator.name.slice(0, 18)}` : 'N/A',
      sub: topOperator ? `${topOperator.liters.toLocaleString('pt-BR')} L (${topOperator.count} abastec.)` : '-',
      color: [30, 64, 175]
    },
    {
      title: 'ATIVIDADE COM MAIOR CONSUMO',
      value: topActivity ? `${topActivity.name.slice(0, 18)}` : 'N/A',
      sub: topActivity ? `${topActivity.liters.toLocaleString('pt-BR')} L (${totalLiters > 0 ? Math.round((topActivity.liters / totalLiters) * 100) : 0}%)` : '-',
      color: [13, 148, 136]
    },
    {
      title: 'OPERAÇÃO COM MAIOR CONSUMO',
      value: topOperation ? `${topOperation.name.slice(0, 18)}` : 'N/A',
      sub: topOperation ? `${topOperation.liters.toLocaleString('pt-BR')} L` : '-',
      color: [109, 40, 217]
    },
    {
      title: 'SETOR COM MAIOR CONSUMO',
      value: topSector ? `${topSector.name.slice(0, 18)}` : 'N/A',
      sub: topSector ? `${topSector.liters.toLocaleString('pt-BR')} L` : '-',
      color: [157, 23, 77]
    }
  ];

  kpiList.forEach((kpi, idx) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const x = 14 + col * (cardW + cardGap);
    const y = cardsStartY + row * (cardH + 3);

    // Fundo do card
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(220, 230, 225);
    doc.rect(x, y, cardW, cardH, 'FD');

    // Borda superior colorida indicativa
    doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.rect(x, y, cardW, 1.4, 'F');

    // Título
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 115, 110);
    doc.text(kpi.title, x + 2.5, y + 4.5);

    // Valor Principal
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.value, x + 2.5, y + 9.5);

    // Subtítulo
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(110, 125, 120);
    doc.text(kpi.sub, x + 2.5, y + 13.5);
  });

  // ------------------------------------------
  // SEÇÃO DE GRÁFICOS VETORIAIS NATIVOS JSPDF
  // ------------------------------------------
  const chartSectionY = 74;
  const panelW = 132.5;
  const panelH = 59;

  // Função auxiliar para desenhar quadro de gráfico
  const drawChartBox = (x: number, y: number, w: number, h: number, title: string, subtitle: string) => {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(215, 225, 220);
    doc.rect(x, y, w, h, 'FD');

    // Header do painel
    doc.setFillColor(246, 249, 247);
    doc.rect(x, y, w, 7.5, 'F');
    doc.setDrawColor(225, 235, 230);
    doc.line(x, y + 7.5, x + w, y + 7.5);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 60, 40);
    doc.text(title, x + 3, y + 5);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 115, 110);
    doc.text(subtitle, x + w - 3, y + 5, { align: 'right' });
  };

  // 1. Gráfico Top Atividades (Top Left)
  const g1X = 14;
  const g1Y = chartSectionY;
  drawChartBox(g1X, g1Y, panelW, panelH, '📊 CONSUMO POR ATIVIDADE (LITROS)', 'Top 5 Atividades');
  const top5Activities = sortedAct.slice(0, 5);
  const maxActLiters = top5Activities.length > 0 ? Math.max(...top5Activities.map(a => a.liters), 1) : 1;

  if (top5Activities.length === 0) {
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Sem abastecimentos no período selecionado.', g1X + 15, g1Y + 25);
  } else {
    top5Activities.forEach((act, idx) => {
      const itemY = g1Y + 11.5 + idx * 9.2;
      const barMaxWidth = panelW - 54;
      const barW = Math.max(2, (act.liters / maxActLiters) * barMaxWidth);
      const pct = totalLiters > 0 ? ((act.liters / totalLiters) * 100).toFixed(1) : '0';

      // Nome da Atividade
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 50, 45);
      doc.text(act.name.length > 18 ? `${act.name.slice(0, 16)}..` : act.name, g1X + 3, itemY + 3.2);

      // Barra de fundo cinza
      doc.setFillColor(240, 244, 242);
      doc.rect(g1X + 34, itemY, barMaxWidth, 4.5, 'F');

      // Barra preenchida verde esmeralda
      doc.setFillColor(16, 140, 75);
      doc.rect(g1X + 34, itemY, barW, 4.5, 'F');

      // Valor à direita
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20, 60, 40);
      doc.text(`${act.liters.toLocaleString('pt-BR')} L (${pct}%)`, g1X + panelW - 3, itemY + 3.3, { align: 'right' });
    });
  }

  // 2. Gráfico Top Equipamentos (Top Right)
  const g2X = 150.5;
  const g2Y = chartSectionY;
  drawChartBox(g2X, g2Y, panelW, panelH, '🚜 CONSUMO POR EQUIPAMENTO / MÁQUINA', 'Top 5 Máquinas');
  const top5Equipments = sortedEq.slice(0, 5);
  const maxEqLiters = top5Equipments.length > 0 ? Math.max(...top5Equipments.map(e => e.liters), 1) : 1;

  if (top5Equipments.length === 0) {
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Sem abastecimentos no período selecionado.', g2X + 15, g2Y + 25);
  } else {
    top5Equipments.forEach((eq, idx) => {
      const itemY = g2Y + 11.5 + idx * 9.2;
      const barMaxWidth = panelW - 54;
      const barW = Math.max(2, (eq.liters / maxEqLiters) * barMaxWidth);
      const pct = totalLiters > 0 ? ((eq.liters / totalLiters) * 100).toFixed(1) : '0';

      // Nome e Placa
      const label = eq.code ? `${eq.name.slice(0, 14)} (${eq.code.slice(0, 7)})` : eq.name.slice(0, 18);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 50, 45);
      doc.text(label, g2X + 3, itemY + 3.2);

      // Barra de fundo
      doc.setFillColor(240, 244, 242);
      doc.rect(g2X + 44, itemY, barMaxWidth - 10, 4.5, 'F');

      // Barra âmbar / amarelo agro
      doc.setFillColor(217, 119, 6);
      doc.rect(g2X + 44, itemY, (barW / barMaxWidth) * (barMaxWidth - 10), 4.5, 'F');

      // Valor à direita
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(140, 60, 10);
      doc.text(`${eq.liters.toLocaleString('pt-BR')} L (${pct}%)`, g2X + panelW - 3, itemY + 3.3, { align: 'right' });
    });
  }

  // 3. Gráfico Consumo por Setor (Bottom Left)
  const g3X = 14;
  const g3Y = chartSectionY + panelH + 4;
  drawChartBox(g3X, g3Y, panelW, panelH, '🏷️ CONSUMO POR SETOR (CRUZAMENTO VEÍCULOS)', 'Distribuição por Setor');
  const maxSecLiters = sortedSec.length > 0 ? Math.max(...sortedSec.map(s => s.liters), 1) : 1;

  if (sortedSec.length === 0) {
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Sem abastecimentos no período selecionado.', g3X + 15, g3Y + 25);
  } else {
    sortedSec.slice(0, 5).forEach((sec, idx) => {
      const itemY = g3Y + 11.5 + idx * 9.2;
      const barMaxWidth = panelW - 54;
      const barW = Math.max(2, (sec.liters / maxSecLiters) * barMaxWidth);
      const pct = totalLiters > 0 ? ((sec.liters / totalLiters) * 100).toFixed(1) : '0';

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 50, 45);
      doc.text(sec.name.length > 18 ? `${sec.name.slice(0, 16)}..` : sec.name, g3X + 3, itemY + 3.2);

      // Barra de fundo
      doc.setFillColor(240, 244, 242);
      doc.rect(g3X + 34, itemY, barMaxWidth, 4.5, 'F');

      // Barra azul petróleo / ciano agro
      doc.setFillColor(2, 132, 199);
      doc.rect(g3X + 34, itemY, barW, 4.5, 'F');

      // Valor à direita
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(2, 100, 160);
      doc.text(`${sec.liters.toLocaleString('pt-BR')} L (${pct}%)`, g3X + panelW - 3, itemY + 3.3, { align: 'right' });
    });
  }

  // 4. Gráfico Consumo Temporal por Período (Bottom Right)
  const g4X = 150.5;
  const g4Y = chartSectionY + panelH + 4;
  drawChartBox(g4X, g4Y, panelW, panelH, '📅 CONSUMO TEMPORAL NO PERÍODO', 'Litros por Dia / Lançamento');

  if (sortedTime.length === 0) {
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Sem abastecimentos no período selecionado.', g4X + 15, g4Y + 25);
  } else {
    // Amostragem de até 14 pontos para caber perfeitamente no painel
    const timeSlice = sortedTime.slice(-14);
    const maxTimeLiters = Math.max(...timeSlice.map(t => t.liters), 1);
    const chartInnerW = panelW - 20;
    const chartInnerH = panelH - 22;
    const colStep = chartInnerW / Math.max(timeSlice.length, 1);
    const barWidth = Math.min(colStep * 0.65, 8);

    // Linha base
    doc.setDrawColor(210, 220, 215);
    doc.line(g4X + 10, g4Y + 14 + chartInnerH, g4X + 10 + chartInnerW, g4Y + 14 + chartInnerH);

    timeSlice.forEach((pt, idx) => {
      const colX = g4X + 10 + idx * colStep + (colStep - barWidth) / 2;
      const barH = Math.max(1.5, (pt.liters / maxTimeLiters) * chartInnerH);
      const barY = g4Y + 14 + chartInnerH - barH;

      // Coluna vertical
      doc.setFillColor(15, 118, 110);
      doc.rect(colX, barY, barWidth, barH, 'F');

      // Valor no topo se houver espaço
      if (timeSlice.length <= 10) {
        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 90, 80);
        doc.text(`${Math.round(pt.liters)}`, colX + barWidth / 2, barY - 1, { align: 'center' });
      }

      // Rótulo da data (DD/MM) abaixo
      const [, m, d] = pt.date.split('-');
      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(90, 105, 100);
      doc.text(`${d}/${m}`, colX + barWidth / 2, g4Y + 17 + chartInnerH, { align: 'center' });
    });
  }

  // Rodapé da Página 1
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 135, 130);
  doc.text('AndradeAgro • Sistema de Gestão de Abastecimento e Frotas • Relatório Executivo Gerencial', 14, 203);
  doc.text('Página 1 (Resumo & Gráficos)', 283, 203, { align: 'right' });

  // ==========================================
  // PÁGINA 2 EM DIANTE: TABELA DETALHADA
  // ==========================================
  doc.addPage('a4', 'landscape');

  // Cabeçalho resumido para páginas de dados
  doc.setFillColor(15, 56, 34);
  doc.rect(0, 0, 297, 16, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(companyInfo.name.toUpperCase(), 14, 9);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Tabela Detalhada de Lançamentos • Período: ${dateRangeStr} • Total: ${logs.length} registros`, 14, 13.5);

  doc.text(`Emitido em: ${formatDateTimeBR(new Date().toISOString())}`, 283, 10, { align: 'right' });

  // Tabela com ou sem colunas financeiras
  const tableData = logs.map(log => {
    const row = [
      formatDateTimeBR(log.dateTime),
      log.equipmentPlateOrCode || '-',
      log.equipmentName,
      log.driverOrOperatorName,
      `${getOperationTypeName(log.operationType)}${log.activityType ? ' - ' + getActivityTypeName(log.activityType, log.operationType) : ''}`,
      log.gasStationName,
      getFuelTypeName(log.fuelType),
      `${log.liters} L`
    ];

    if (canViewFinancial) {
      row.push(formatCurrency(log.pricePerLiter));
      row.push(formatCurrency(log.totalValue));
    }

    row.push(log.calculatedAverageKmPerLiter ? `${log.calculatedAverageKmPerLiter} km/L` : log.calculatedAverageLitersPerHour ? `${log.calculatedAverageLitersPerHour} L/h` : '-');
    return row;
  });

  const headCols = canViewFinancial
    ? ['Data/Hora', 'Placa/Cód.', 'Equipamento', 'Motorista/Operador', 'Operação / Atividade', 'Posto', 'Combustível', 'Litros', 'R$/L', 'Total R$', 'Média']
    : ['Data/Hora', 'Placa/Cód.', 'Equipamento', 'Motorista/Operador', 'Operação / Atividade', 'Posto', 'Combustível', 'Litros', 'Média'];

  const footCols = canViewFinancial
    ? ['TOTAL', `${logs.length} reg.`, '-', '-', '-', '-', '-', `${totalLiters.toLocaleString('pt-BR')} L`, '-', formatCurrency(totalCost), '-']
    : ['TOTAL', `${logs.length} reg.`, '-', '-', '-', '-', '-', `${totalLiters.toLocaleString('pt-BR')} L`, '-'];

  autoTable(doc, {
    startY: 21,
    head: [headCols],
    body: tableData,
    foot: [footCols],
    showHead: 'everyPage',
    theme: 'grid',
    headStyles: {
      fillColor: [20, 78, 46],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5
    },
    footStyles: {
      fillColor: [230, 240, 234],
      textColor: [15, 56, 34],
      fontStyle: 'bold',
      fontSize: 8
    },
    styles: {
      fontSize: 6.8,
      cellPadding: 1.4
    },
    alternateRowStyles: {
      fillColor: [248, 250, 248]
    },
    didDrawPage: (data) => {
      // Rodapé em cada página adicional
      const pageNumber = (doc as any).internal.getCurrentPageInfo().pageNumber;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 135, 130);
      doc.text(`AndradeAgro • Relatório Executivo Gerencial • ${dateRangeStr}`, 14, 203);
      doc.text(`Página ${pageNumber}`, 283, 203, { align: 'right' });
    }
  });

  doc.save(`AndradeAgro_Relatorio_Executivo_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// Excel / CSV Export Function - Tradicional
export function exportFuelLogsCSV(logs: FuelLog[], fileName: string = 'Abastecimentos_AndradeAgro', canViewFinancial: boolean = true) {
  const headers = [
    'Data/Hora',
    'ID Equipamento',
    'Categoria',
    'Placa / Código',
    'Nome Equipamento',
    'Tipo de Operação',
    'Atividade',
    'Motorista / Operador',
    'Frentista / Atendente',
    'Posto',
    'Tipo de Combustível',
    'Litros'
  ];

  if (canViewFinancial) {
    headers.push('Valor por Litro (R$)');
    headers.push('Valor Total (R$)');
  }

  headers.push(
    'KM no Abastecimento',
    'Horímetro no Abastecimento',
    'Média km/L',
    'Média L/h'
  );

  if (canViewFinancial) {
    headers.push('Custo por KM (R$)');
    headers.push('Custo por Hora (R$)');
  }

  headers.push('Observações');

  const rows = logs.map(l => {
    const row = [
      `"${formatDateTimeBR(l.dateTime)}"`,
      `"${l.equipmentId}"`,
      `"${l.equipmentCategory}"`,
      `"${l.equipmentPlateOrCode}"`,
      `"${(l.equipmentName || '').replace(/"/g, '""')}"`,
      `"${getOperationTypeName(l.operationType)}"`,
      `"${l.activityType ? getActivityTypeName(l.activityType, l.operationType) : ''}"`,
      `"${(l.driverOrOperatorName || '').replace(/"/g, '""')}"`,
      `"${(l.attendantName || '').replace(/"/g, '""')}"`,
      `"${(l.gasStationName || '').replace(/"/g, '""')}"`,
      `"${getFuelTypeName(l.fuelType)}"`,
      l.liters
    ];

    if (canViewFinancial) {
      row.push(l.pricePerLiter as any);
      row.push(l.totalValue as any);
    }

    row.push(
      l.kmAtFueling ?? '' as any,
      l.hourmeterAtFueling ?? '' as any,
      l.calculatedAverageKmPerLiter ?? '' as any,
      l.calculatedAverageLitersPerHour ?? '' as any
    );

    if (canViewFinancial) {
      row.push(l.costPerKm ?? '' as any);
      row.push(l.costPerHour ?? '' as any);
    }

    row.push(`"${(l.observations || '').replace(/"/g, '""')}"`);
    return row;
  });

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `${fileName}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Exportação Completa e Estruturada: Relatório Gerencial
export function exportManagerialCSV(options: {
  logs: FuelLog[];
  vehicles: Vehicle[];
  dateRangeStr: string;
  canViewFinancial: boolean;
  companyName: string;
}) {
  const { logs, vehicles, dateRangeStr, canViewFinancial, companyName } = options;

  const totalLiters = logs.reduce((acc, l) => acc + (l.liters || 0), 0);
  const totalCost = logs.reduce((acc, l) => acc + (l.totalValue || 0), 0);
  const totalCount = logs.length;
  const avgLiters = totalCount > 0 ? totalLiters / totalCount : 0;

  // Mapa de setores dos veículos
  const vehicleMap = new Map<string, Vehicle>();
  vehicles.forEach(v => {
    if (v.id) vehicleMap.set(v.id, v);
  });

  // Agrupamentos
  const actMap = new Map<string, { liters: number; cost: number; count: number }>();
  const operMap = new Map<string, { liters: number; cost: number; count: number }>();
  const eqMap = new Map<string, { name: string; code: string; sector: string; liters: number; cost: number; count: number }>();
  const secMap = new Map<string, { liters: number; cost: number; count: number }>();

  logs.forEach(l => {
    const liters = l.liters || 0;
    const cost = l.totalValue || 0;
    const act = getEffectiveActivityName(l);
    const oper = getEffectiveCategoryName(l);
    const veh = vehicleMap.get(l.equipmentId);
    const sector = getSectorName(veh?.sector || 'AGRICOLA');

    // Atividade
    const a = actMap.get(act) || { liters: 0, cost: 0, count: 0 };
    a.liters += liters; a.cost += cost; a.count += 1;
    actMap.set(act, a);

    // Operação
    const o = operMap.get(oper) || { liters: 0, cost: 0, count: 0 };
    o.liters += liters; o.cost += cost; o.count += 1;
    operMap.set(oper, o);

    // Equipamento
    const eqKey = l.equipmentId || l.equipmentName;
    const eq = eqMap.get(eqKey) || { name: l.equipmentName, code: l.equipmentPlateOrCode, sector, liters: 0, cost: 0, count: 0 };
    eq.liters += liters; eq.cost += cost; eq.count += 1;
    eqMap.set(eqKey, eq);

    // Setor
    const s = secMap.get(sector) || { liters: 0, cost: 0, count: 0 };
    s.liters += liters; s.cost += cost; s.count += 1;
    secMap.set(sector, s);
  });

  const lines: string[] = [];

  // Seção 1: Cabeçalho
  lines.push(`"# RELATÓRIO GERENCIAL DE ABASTECIMENTOS - ${companyName.toUpperCase()}"`);
  lines.push(`"# Período: ${dateRangeStr} | Gerado em: ${formatDateTimeBR(new Date().toISOString())}"`);
  lines.push('');

  // Seção 2: Resumo Gerencial
  lines.push('"# --- RESUMO GERENCIAL ---"');
  lines.push('Indicador;Valor');
  lines.push(`"Total de Abastecimentos";${totalCount}`);
  lines.push(`"Volume Total Abastecido (Litros)";${totalLiters.toFixed(1)}`);
  lines.push(`"Média de Litros por Abastecimento";${avgLiters.toFixed(1)}`);
  if (canViewFinancial) {
    lines.push(`"Investimento Total (R$)";${totalCost.toFixed(2)}`);
    lines.push(`"Custo Médio por Litro (R$)";${totalLiters > 0 ? (totalCost / totalLiters).toFixed(2) : '0.00'}`);
  }
  lines.push('');

  // Seção 3: Consumo por Atividade
  lines.push('"# --- CONSUMO POR ATIVIDADE ---"');
  lines.push(canViewFinancial ? 'Atividade;Litros;Percentual;Qtd Abastecimentos;Valor Total (R$)' : 'Atividade;Litros;Percentual;Qtd Abastecimentos');
  Array.from(actMap.entries())
    .sort((a, b) => b[1].liters - a[1].liters)
    .forEach(([name, data]) => {
      const pct = totalLiters > 0 ? ((data.liters / totalLiters) * 100).toFixed(1) + '%' : '0%';
      if (canViewFinancial) {
        lines.push(`"${name}";${data.liters.toFixed(1)};${pct};${data.count};${data.cost.toFixed(2)}`);
      } else {
        lines.push(`"${name}";${data.liters.toFixed(1)};${pct};${data.count}`);
      }
    });
  lines.push('');

  // Seção 4: Consumo por Operação
  lines.push('"# --- CONSUMO POR OPERAÇÃO ---"');
  lines.push(canViewFinancial ? 'Operação;Litros;Percentual;Qtd Abastecimentos;Valor Total (R$)' : 'Operação;Litros;Percentual;Qtd Abastecimentos');
  Array.from(operMap.entries())
    .sort((a, b) => b[1].liters - a[1].liters)
    .forEach(([name, data]) => {
      const pct = totalLiters > 0 ? ((data.liters / totalLiters) * 100).toFixed(1) + '%' : '0%';
      if (canViewFinancial) {
        lines.push(`"${name}";${data.liters.toFixed(1)};${pct};${data.count};${data.cost.toFixed(2)}`);
      } else {
        lines.push(`"${name}";${data.liters.toFixed(1)};${pct};${data.count}`);
      }
    });
  lines.push('');

  // Seção 5: Consumo por Equipamento (Top Máquinas)
  lines.push('"# --- CONSUMO POR EQUIPAMENTO ---"');
  lines.push(canViewFinancial ? 'Equipamento;Placa/Código;Setor;Litros;Percentual;Qtd Abastecimentos;Valor Total (R$)' : 'Equipamento;Placa/Código;Setor;Litros;Percentual;Qtd Abastecimentos');
  Array.from(eqMap.values())
    .sort((a, b) => b.liters - a.liters)
    .forEach(e => {
      const pct = totalLiters > 0 ? ((e.liters / totalLiters) * 100).toFixed(1) + '%' : '0%';
      if (canViewFinancial) {
        lines.push(`"${e.name}";"${e.code}";"${e.sector}";${e.liters.toFixed(1)};${pct};${e.count};${e.cost.toFixed(2)}`);
      } else {
        lines.push(`"${e.name}";"${e.code}";"${e.sector}";${e.liters.toFixed(1)};${pct};${e.count}`);
      }
    });
  lines.push('');

  // Seção 6: Consumo por Setor
  lines.push('"# --- CONSUMO POR SETOR ---"');
  lines.push(canViewFinancial ? 'Setor;Litros;Percentual;Qtd Abastecimentos;Valor Total (R$)' : 'Setor;Litros;Percentual;Qtd Abastecimentos');
  Array.from(secMap.entries())
    .sort((a, b) => b[1].liters - a[1].liters)
    .forEach(([name, data]) => {
      const pct = totalLiters > 0 ? ((data.liters / totalLiters) * 100).toFixed(1) + '%' : '0%';
      if (canViewFinancial) {
        lines.push(`"${name}";${data.liters.toFixed(1)};${pct};${data.count};${data.cost.toFixed(2)}`);
      } else {
        lines.push(`"${name}";${data.liters.toFixed(1)};${pct};${data.count}`);
      }
    });
  lines.push('');

  // Seção 7: Lançamentos Detalhados
  lines.push('"# --- LANÇAMENTOS DETALHADOS ---"');
  const headers = [
    'Data/Hora',
    'ID Equipamento',
    'Placa / Código',
    'Nome Equipamento',
    'Tipo de Operação',
    'Atividade',
    'Motorista / Operador',
    'Posto',
    'Combustível',
    'Litros'
  ];
  if (canViewFinancial) {
    headers.push('R$/L', 'Total R$');
  }
  headers.push('KM', 'Horímetro', 'Média');
  lines.push(headers.join(';'));

  logs.forEach(l => {
    const row = [
      `"${formatDateTimeBR(l.dateTime)}"`,
      `"${l.equipmentId}"`,
      `"${l.equipmentPlateOrCode}"`,
      `"${(l.equipmentName || '').replace(/"/g, '""')}"`,
      `"${getOperationTypeName(l.operationType)}"`,
      `"${l.activityType ? getActivityTypeName(l.activityType, l.operationType) : ''}"`,
      `"${(l.driverOrOperatorName || '').replace(/"/g, '""')}"`,
      `"${(l.gasStationName || '').replace(/"/g, '""')}"`,
      `"${getFuelTypeName(l.fuelType)}"`,
      l.liters
    ];

    if (canViewFinancial) {
      row.push(l.pricePerLiter as any, l.totalValue as any);
    }

    row.push(
      l.kmAtFueling ?? '' as any,
      l.hourmeterAtFueling ?? '' as any,
      (l.calculatedAverageKmPerLiter ? `${l.calculatedAverageKmPerLiter} km/L` : l.calculatedAverageLitersPerHour ? `${l.calculatedAverageLitersPerHour} L/h` : '-') as any
    );

    lines.push(row.join(';'));
  });

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + lines.join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `AndradeAgro_Relatorio_Gerencial_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export { 
  OPERATIONS_CONFIG, 
  OPERATION_OPTIONS, 
  getActivitiesForOperation, 
  getOperationTypeName, 
  getOperationTypeLabelOnly, 
  getActivityTypeName,
  getEffectiveActivityName,
  getEffectiveCategoryName,
  getConsumptionByCategory,
  getConsumptionByActivity,
  CATEGORY_PALETTE
} from './operations';
