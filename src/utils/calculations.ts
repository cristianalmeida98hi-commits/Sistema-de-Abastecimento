import { FuelLog, Vehicle, FuelType, Sector, GasStation } from '../types';
import { getOperationTypeName, getActivityTypeName } from './operations';

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

// PDF Export Function
export async function exportFuelLogsPDF(
  logs: FuelLog[],
  title: string = 'Relatório de Abastecimentos',
  companyInfo: { name: string; slogan: string; cnpj: string }
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
  const tableData = logs.map(log => [
    formatDateTimeBR(log.dateTime),
    log.equipmentPlateOrCode,
    log.equipmentName,
    log.driverOrOperatorName,
    `${getOperationTypeName(log.operationType)}${log.activityType ? ' - ' + getActivityTypeName(log.activityType, log.operationType) : ''}`,
    log.gasStationName,
    getFuelTypeName(log.fuelType),
    `${log.liters} L`,
    formatCurrency(log.pricePerLiter),
    formatCurrency(log.totalValue),
    log.calculatedAverageKmPerLiter ? `${log.calculatedAverageKmPerLiter} km/L` : log.calculatedAverageLitersPerHour ? `${log.calculatedAverageLitersPerHour} L/h` : '-'
  ]);

  const totalLiters = logs.reduce((acc, l) => acc + l.liters, 0);
  const totalCost = logs.reduce((acc, l) => acc + l.totalValue, 0);

  autoTable(doc, {
    startY: 38,
    head: [['Data/Hora', 'Placa/Cód.', 'Equipamento', 'Motorista/Operador', 'Operação / Atividade', 'Posto', 'Combustível', 'Litros', 'R$/L', 'Total R$', 'Média']],
    body: tableData,
    foot: [['TOTAL', `${logs.length} reg.`, '-', '-', '-', '-', '-', `${totalLiters.toLocaleString('pt-BR')} L`, '-', formatCurrency(totalCost), '-']],
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

  doc.save(`AndradeAgro_Relatorio_Abastecimentos_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// Excel / CSV Export Function
export function exportFuelLogsCSV(logs: FuelLog[], fileName: string = 'Abastecimentos_AndradeAgro') {
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
    'Litros',
    'Valor por Litro (R$)',
    'Valor Total (R$)',
    'KM no Abastecimento',
    'Horímetro no Abastecimento',
    'Média km/L',
    'Média L/h',
    'Custo por KM (R$)',
    'Custo por Hora (R$)',
    'Observações'
  ];

  const rows = logs.map(l => [
    `"${formatDateTimeBR(l.dateTime)}"`,
    `"${l.equipmentId}"`,
    `"${l.equipmentCategory}"`,
    `"${l.equipmentPlateOrCode}"`,
    `"${l.equipmentName.replace(/"/g, '""')}"`,
    `"${getOperationTypeName(l.operationType)}"`,
    `"${l.activityType ? getActivityTypeName(l.activityType, l.operationType) : ''}"`,
    `"${l.driverOrOperatorName.replace(/"/g, '""')}"`,
    `"${l.attendantName.replace(/"/g, '""')}"`,
    `"${l.gasStationName.replace(/"/g, '""')}"`,
    `"${getFuelTypeName(l.fuelType)}"`,
    l.liters,
    l.pricePerLiter,
    l.totalValue,
    l.kmAtFueling ?? '',
    l.hourmeterAtFueling ?? '',
    l.calculatedAverageKmPerLiter ?? '',
    l.calculatedAverageLitersPerHour ?? '',
    l.costPerKm ?? '',
    l.costPerHour ?? '',
    `"${(l.observations || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `${fileName}_${new Date().toISOString().slice(0, 10)}.csv`);
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
