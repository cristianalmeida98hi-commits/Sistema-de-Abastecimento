import { FuelLog, Vehicle, FuelType, Sector } from '../types';

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

export function formatDateBR(dateString: string): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return dateString;
  }
}

export function formatDateTimeBR(dateTimeString: string): string {
  if (!dateTimeString) return '-';
  try {
    const d = new Date(dateTimeString);
    if (isNaN(d.getTime())) return dateTimeString;
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateTimeString;
  }
}

export function getFuelTypeName(fuelType: FuelType): string {
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
    head: [['Data/Hora', 'Placa/Cód.', 'Equipamento', 'Motorista/Operador', 'Posto', 'Combustível', 'Litros', 'R$/L', 'Total R$', 'Média']],
    body: tableData,
    foot: [['TOTAL', `${logs.length} reg.`, '-', '-', '-', '-', `${totalLiters.toLocaleString('pt-BR')} L`, '-', formatCurrency(totalCost), '-']],
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
      fontSize: 7.5,
      cellPadding: 2
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
