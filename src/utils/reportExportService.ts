import type { FuelLog, Vehicle } from '../types';
import {
  formatCurrency,
  formatDateTimeBR,
  getFuelTypeName,
  getSectorName,
  getOperationTypeName,
  getOperationTypeLabelOnly,
  getActivityTypeName,
  getEffectiveActivityName,
  getEffectiveCategoryName
} from './calculations';

export type PdfReportVariant = 'OFFICIAL' | 'EXECUTIVE';

export interface ReportExportOptions {
  logs: FuelLog[];
  vehicles: Vehicle[];
  companyInfo: { name: string; slogan: string; cnpj: string };
  dateRangeStr: string;
  canViewFinancial: boolean;
  appliedFiltersDesc?: string;
  reportTitle?: string;
  variant?: PdfReportVariant;
}

export interface GroupedSummaryItem {
  name: string;
  liters: number;
  cost: number;
  count: number;
}

export interface ReportMetrics {
  totalLiters: number;
  totalCost: number;
  totalCount: number;
  avgLitersPerLog: number;
  avgPricePerLiter: number;
  uniqueEquipmentsCount: number;
  uniqueOperatorsCount: number;
  suspiciousCount: number;
  sortedAct: Array<{ name: string; liters: number; cost: number; count: number }>;
  sortedEq: Array<{ name: string; code: string; liters: number; cost: number; count: number }>;
  sortedOp: Array<{ name: string; liters: number; cost: number; count: number }>;
  sortedSec: Array<{ name: string; liters: number; cost: number; count: number }>;
  sortedOper: Array<{ name: string; liters: number; cost: number; count: number }>;
  sortedFuelType: GroupedSummaryItem[];
  sortedStation: GroupedSummaryItem[];
  sortedTime: Array<{ date: string; liters: number; cost: number }>;
  topEquipment?: { name: string; code: string; liters: number; count: number };
  topOperator?: { name: string; liters: number; count: number };
  topActivity?: { name: string; liters: number; count: number };
  topOperation?: { name: string; liters: number; count: number };
  topSector?: { name: string; liters: number; count: number };
}

/**
 * Remove emojis e símbolos fora da codificação padrão Latin-1/WinAnsi do jsPDF (helvetica),
 * preservando integralmente letras acentuadas em português, números e pontuação.
 */
export function sanitizePdfText(text?: string | number | null): string {
  if (text === undefined || text === null) return '';
  return String(text)
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0E\uFE0F\u200D]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function getSortableTimestamp(value?: string): number {
  if (!value) return 0;
  const trimmed = value.trim();
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(trimmed)
    ? `${trimmed}-03:00`
    : trimmed;
  const time = new Date(normalized).getTime();
  return Number.isFinite(time) ? time : 0;
}

/**
 * Retorna uma nova cópia dos abastecimentos ordenada em ordem cronológica crescente,
 * sem mutar o array original utilizado pelas telas ou pelo cache.
 */
export function sortLogsChronologicallyAsc(logs: FuelLog[]): FuelLog[] {
  return [...logs].sort((a, b) => {
    const timeA = getSortableTimestamp(a.dateTime);
    const timeB = getSortableTimestamp(b.dateTime);
    if (timeA !== timeB) return timeA - timeB;

    const createdA = getSortableTimestamp(a.createdAt);
    const createdB = getSortableTimestamp(b.createdAt);
    if (createdA !== createdB) return createdA - createdB;

    const meterA = a.equipmentCategory === 'VEICULO'
      ? (a.kmAtFueling ?? 0)
      : (a.hourmeterAtFueling ?? a.kmAtFueling ?? 0);
    const meterB = b.equipmentCategory === 'VEICULO'
      ? (b.kmAtFueling ?? 0)
      : (b.hourmeterAtFueling ?? b.kmAtFueling ?? 0);
    if (meterA !== meterB) return meterA - meterB;

    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

function formatLitersBR(value: number): string {
  return (Number(value) || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
}

function formatMeterReading(log: FuelLog): string {
  const isKm = log.equipmentCategory === 'VEICULO';
  if (isKm && log.kmAtFueling !== undefined && log.kmAtFueling !== null) {
    return `${Number(log.kmAtFueling).toLocaleString('pt-BR')} km`;
  }
  if (log.hourmeterAtFueling !== undefined && log.hourmeterAtFueling !== null) {
    return `${Number(log.hourmeterAtFueling).toLocaleString('pt-BR')} h`;
  }
  if (log.kmAtFueling !== undefined && log.kmAtFueling !== null) {
    return `${Number(log.kmAtFueling).toLocaleString('pt-BR')} km`;
  }
  return '-';
}

function formatTankFillStatus(log: FuelLog): string {
  if (log.isFullTank === true) return 'Cheio';
  if (log.isFullTank === false) return 'Parcial';
  return '-';
}

/**
 * Agrega e calcula métricas analíticas e gerenciais para os relatórios,
 * consumindo exclusivamente os valores já existentes nos registros.
 */
export function calculateReportMetrics(logs: FuelLog[], vehicles: Vehicle[]): ReportMetrics {
  const totalLiters = logs.reduce((acc, l) => acc + (Number(l.liters) || 0), 0);
  const totalCost = logs.reduce((acc, l) => acc + (Number(l.totalValue) || 0), 0);
  const totalCount = logs.length;
  const avgLitersPerLog = totalCount > 0 ? totalLiters / totalCount : 0;
  const avgPricePerLiter = totalLiters > 0 ? totalCost / totalLiters : 0;

  const vehicleMap = new Map<string, Vehicle>();
  vehicles.forEach(v => {
    if (v.id) vehicleMap.set(v.id, v);
  });

  const eqMap = new Map<string, { name: string; code: string; liters: number; cost: number; count: number }>();
  const opMap = new Map<string, { name: string; liters: number; cost: number; count: number }>();
  const actMap = new Map<string, { name: string; liters: number; cost: number; count: number }>();
  const operMap = new Map<string, { name: string; liters: number; cost: number; count: number }>();
  const secMap = new Map<string, { name: string; liters: number; cost: number; count: number }>();
  const fuelMap = new Map<string, GroupedSummaryItem>();
  const stationMap = new Map<string, GroupedSummaryItem>();
  const timeMap = new Map<string, { date: string; liters: number; cost: number }>();

  let suspiciousCount = 0;

  logs.forEach(l => {
    const liters = Number(l.liters) || 0;
    const cost = Number(l.totalValue) || 0;
    if (l.flaggedSuspicious) suspiciousCount += 1;

    // Equipamento
    const eqKey = l.equipmentId || l.equipmentName || 'OUTRO';
    const eqCur = eqMap.get(eqKey) || {
      name: l.equipmentName || 'Equipamento',
      code: l.equipmentPlateOrCode || '',
      liters: 0,
      cost: 0,
      count: 0
    };
    eqCur.liters += liters;
    eqCur.cost += cost;
    eqCur.count += 1;
    eqMap.set(eqKey, eqCur);

    // Operador
    const opKey = l.driverOrOperatorId || l.driverOrOperatorName || 'NÃO INFORMADO';
    const opCur = opMap.get(opKey) || {
      name: l.driverOrOperatorName || 'Não Informado',
      liters: 0,
      cost: 0,
      count: 0
    };
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

    // Setor
    const veh = vehicleMap.get(l.equipmentId);
    const sectorRaw = veh?.sector || 'AGRICOLA';
    const sectorLabel = getSectorName(sectorRaw);
    const secCur = secMap.get(sectorLabel) || { name: sectorLabel, liters: 0, cost: 0, count: 0 };
    secCur.liters += liters;
    secCur.cost += cost;
    secCur.count += 1;
    secMap.set(sectorLabel, secCur);

    // Tipo de Combustível
    const fuelLabel = getFuelTypeName(l.fuelType);
    const fuelCur = fuelMap.get(fuelLabel) || { name: fuelLabel, liters: 0, cost: 0, count: 0 };
    fuelCur.liters += liters;
    fuelCur.cost += cost;
    fuelCur.count += 1;
    fuelMap.set(fuelLabel, fuelCur);

    // Posto / Tanque
    const stationLabel = l.gasStationName || 'Não Informado';
    const stationCur = stationMap.get(stationLabel) || { name: stationLabel, liters: 0, cost: 0, count: 0 };
    stationCur.liters += liters;
    stationCur.cost += cost;
    stationCur.count += 1;
    stationMap.set(stationLabel, stationCur);

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
  const sortedFuelType = Array.from(fuelMap.values()).sort((a, b) => b.liters - a.liters);
  const sortedStation = Array.from(stationMap.values()).sort((a, b) => b.liters - a.liters);
  const sortedTime = Array.from(timeMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalLiters,
    totalCost,
    totalCount,
    avgLitersPerLog,
    avgPricePerLiter,
    uniqueEquipmentsCount: sortedEq.length,
    uniqueOperatorsCount: sortedOp.length,
    suspiciousCount,
    sortedAct,
    sortedEq,
    sortedOp,
    sortedSec,
    sortedOper,
    sortedFuelType,
    sortedStation,
    sortedTime,
    topEquipment: sortedEq[0],
    topOperator: sortedOp[0],
    topActivity: sortedAct[0],
    topOperation: sortedOper[0],
    topSector: sortedSec[0]
  };
}

/**
 * Gera imagem PNG base64 de gráfico de barras horizontais via HTML Canvas (navegador).
 */
export function createBarChartPng(options: {
  title: string;
  subtitle: string;
  items: Array<{ label: string; value: number; formattedValue: string; percent?: string }>;
  colorHex: string;
  width?: number;
  height?: number;
}): string {
  if (typeof document === 'undefined') return '';
  const { title, subtitle, items, colorHex, width = 760, height = 360 } = options;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Fundo branco e borda
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  // Faixa do Cabeçalho
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(2, 2, width - 4, 48);
  ctx.beginPath();
  ctx.moveTo(2, 50);
  ctx.lineTo(width - 2, 50);
  ctx.strokeStyle = '#e2e8f0';
  ctx.stroke();

  // Título e Subtítulo
  ctx.fillStyle = '#0f3822';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText(title, 16, 30);

  ctx.fillStyle = '#64748b';
  ctx.font = 'normal 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(subtitle, width - 16, 30);
  ctx.textAlign = 'left';

  if (!items || items.length === 0) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'italic 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText('Nenhum dado disponível no período selecionado.', 20, 100);
    return canvas.toDataURL('image/png').split(',')[1];
  }

  const topItems = items.slice(0, 5);
  const maxVal = Math.max(...topItems.map(i => i.value), 1);
  const startY = 68;
  const rowH = 54;
  const barMaxWidth = width - 270;

  topItems.forEach((item, idx) => {
    const y = startY + idx * rowH;

    // Rótulo
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
    const labelText = item.label.length > 22 ? item.label.slice(0, 20) + '...' : item.label;
    ctx.fillText(labelText, 16, y + 16);

    // Barra de fundo
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(170, y, barMaxWidth, 22);

    // Barra preenchida
    const barW = Math.max(5, (item.value / maxVal) * barMaxWidth);
    ctx.fillStyle = colorHex;
    ctx.fillRect(170, y, barW, 22);

    // Valor e porcentagem à direita
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
    const valText = item.percent ? `${item.formattedValue} (${item.percent})` : item.formattedValue;
    ctx.fillText(valText, 170 + barMaxWidth + 10, y + 16);
  });

  return canvas.toDataURL('image/png').split(',')[1];
}

/**
 * Gera imagem PNG base64 de gráfico de evolução temporal via HTML Canvas.
 */
export function createTimelineChartPng(options: {
  title: string;
  subtitle: string;
  items: Array<{ date: string; liters: number }>;
  colorHex: string;
  width?: number;
  height?: number;
}): string {
  if (typeof document === 'undefined') return '';
  const { title, subtitle, items, colorHex, width = 760, height = 360 } = options;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(2, 2, width - 4, 48);
  ctx.beginPath();
  ctx.moveTo(2, 50);
  ctx.lineTo(width - 2, 50);
  ctx.strokeStyle = '#e2e8f0';
  ctx.stroke();

  ctx.fillStyle = '#0f3822';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText(title, 16, 30);

  ctx.fillStyle = '#64748b';
  ctx.font = 'normal 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(subtitle, width - 16, 30);
  ctx.textAlign = 'left';

  if (!items || items.length === 0) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'italic 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText('Nenhum dado disponível no período selecionado.', 20, 100);
    return canvas.toDataURL('image/png').split(',')[1];
  }

  const slice = items.slice(-14);
  const maxLiters = Math.max(...slice.map(s => s.liters), 1);
  const chartX = 26;
  const chartY = 72;
  const chartW = width - 52;
  const chartH = height - 122;
  const colStep = chartW / Math.max(slice.length, 1);
  const colW = Math.min(colStep * 0.65, 34);

  // Linha de base
  ctx.strokeStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(chartX, chartY + chartH);
  ctx.lineTo(chartX + chartW, chartY + chartH);
  ctx.stroke();

  slice.forEach((pt, i) => {
    const x = chartX + i * colStep + (colStep - colW) / 2;
    const barH = Math.max(4, (pt.liters / maxLiters) * chartH);
    const y = chartY + chartH - barH;

    ctx.fillStyle = colorHex;
    ctx.fillRect(x, y, colW, barH);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(pt.liters)}L`, x + colW / 2, y - 4);

    const parts = pt.date.split('-');
    const dateLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}` : pt.date;
    ctx.fillStyle = '#64748b';
    ctx.font = 'normal 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText(dateLabel, x + colW / 2, chartY + chartH + 16);
  });

  return canvas.toDataURL('image/png').split(',')[1];
}

// ============================================================================
// CONSTANTES DE LAYOUT E AUXILIARES VETORIAIS PARA PDF (A4 PAISAGEM 297x210mm)
// ============================================================================
const PDF_PAGE_W = 297;
const PDF_PAGE_H = 210;
const PDF_MARGIN_L = 14;
const PDF_MARGIN_R = 14;
const PDF_CONTENT_W = PDF_PAGE_W - PDF_MARGIN_L - PDF_MARGIN_R; // 269 mm
const PDF_CONTENT_TOP_Y = 30.5;
const PDF_MAX_CONTENT_Y = 194.5;
const PDF_MARGIN_BOTTOM = PDF_PAGE_H - PDF_MAX_CONTENT_Y; // 15.5 mm
const PDF_FOOTER_LINE_Y = 198.5;
const PDF_FOOTER_TEXT_Y = 203.5;

function fitTextWidth(doc: any, text: string, maxWidthMm: number): string {
  const clean = sanitizePdfText(text);
  if (!clean) return '';
  if (doc.getTextWidth(clean) <= maxWidthMm) return clean;
  const ellipsis = '...';
  let end = clean.length;
  while (end > 1 && doc.getTextWidth(clean.slice(0, end) + ellipsis) > maxWidthMm) {
    end -= 1;
  }
  return clean.slice(0, Math.max(1, end)).trimEnd() + ellipsis;
}

function drawSectionHeading(doc: any, title: string, y: number, subtitle?: string) {
  doc.setFillColor(15, 56, 34);
  doc.rect(PDF_MARGIN_L, y - 3.3, 1.8, 4.2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 56, 34);
  doc.text(sanitizePdfText(title).toUpperCase(), PDF_MARGIN_L + 3.6, y);

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(100, 115, 110);
    doc.text(sanitizePdfText(subtitle), PDF_PAGE_W - PDF_MARGIN_R, y, { align: 'right' });
  }
}

function drawPdfHeader(
  doc: any,
  params: {
    companyInfo: { name: string; slogan: string; cnpj: string };
    reportTitle: string;
    dateRangeStr: string;
    appliedFiltersDesc: string;
    issuedAtStr: string;
    totalLogsCount: number;
  }
) {
  const { companyInfo, reportTitle, dateRangeStr, appliedFiltersDesc, issuedAtStr, totalLogsCount } = params;

  // Faixa superior verde institucional
  doc.setFillColor(15, 56, 34);
  doc.rect(0, 0, PDF_PAGE_W, 18.2, 'F');

  // Filete dourado de destaque
  doc.setFillColor(217, 165, 32);
  doc.rect(0, 18.2, PDF_PAGE_W, 0.9, 'F');

  // Empresa e slogan à esquerda
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.text(sanitizePdfText(companyInfo.name || 'AndradeAgro').toUpperCase(), PDF_MARGIN_L, 8.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(215, 236, 223);
  doc.text(
    fitTextWidth(doc, companyInfo.slogan || 'Gestão Inteligente do Agronegócio', 120),
    PDF_MARGIN_L,
    14.0
  );

  // Título do relatório e emissão à direita
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(
    fitTextWidth(doc, reportTitle.toUpperCase(), 138),
    PDF_PAGE_W - PDF_MARGIN_R,
    8.2,
    { align: 'right' }
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(215, 236, 223);
  const cnpjPart = companyInfo.cnpj ? ` | CNPJ: ${sanitizePdfText(companyInfo.cnpj)}` : '';
  doc.text(`Emitido em: ${issuedAtStr}${cnpjPart}`, PDF_PAGE_W - PDF_MARGIN_R, 14.0, { align: 'right' });

  // Faixa de contexto (Período e Filtros) com largura controlada para não colidir
  doc.setFillColor(244, 248, 245);
  doc.setDrawColor(210, 224, 215);
  doc.setLineWidth(0.25);
  doc.rect(PDF_MARGIN_L, 20.6, PDF_CONTENT_W, 6.8, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(20, 60, 40);
  const leftSummary = fitTextWidth(
    doc,
    `Período: ${dateRangeStr}  |  ${totalLogsCount} registro(s)`,
    118
  );
  doc.text(leftSummary, PDF_MARGIN_L + 3, 25.0);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(75, 95, 85);
  const rightFilters = fitTextWidth(doc, appliedFiltersDesc || 'Todos os filtros', 140);
  doc.text(rightFilters, PDF_PAGE_W - PDF_MARGIN_R - 3, 25.0, { align: 'right' });
}

function drawPdfChartBox(
  doc: any,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  subtitle: string,
  accentRgb: [number, number, number]
) {
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(215, 225, 220);
  doc.setLineWidth(0.25);
  doc.rect(x, y, w, h, 'FD');

  doc.setFillColor(246, 249, 247);
  doc.rect(x, y, w, 7.8, 'F');

  // Marcador vetorial de cor no canto esquerdo do título do gráfico
  doc.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
  doc.rect(x, y, 2.0, 7.8, 'F');

  doc.setDrawColor(225, 235, 230);
  doc.line(x, y + 7.8, x + w, y + 7.8);

  doc.setFontSize(7.6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 60, 40);
  doc.text(sanitizePdfText(title), x + 4.2, y + 5.2);

  doc.setFontSize(6.6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 115, 110);
  doc.text(sanitizePdfText(subtitle), x + w - 3, y + 5.2, { align: 'right' });
}

function drawHorizontalBarChartPanel(
  doc: any,
  options: {
    x: number;
    y: number;
    w: number;
    h: number;
    title: string;
    subtitle: string;
    accentRgb: [number, number, number];
    totalLiters: number;
    items: Array<{ label: string; liters: number }>;
  }
) {
  const { x, y, w, h, title, subtitle, accentRgb, totalLiters, items } = options;
  drawPdfChartBox(doc, x, y, w, h, title, subtitle, accentRgb);

  const topItems = items.slice(0, 5);
  if (topItems.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(140, 150, 145);
    doc.text('Nenhum abastecimento no período selecionado.', x + 5, y + h / 2 + 2);
    return;
  }

  const maxLiters = Math.max(...topItems.map(i => i.liters), 1);
  // Geometria dedicada sem sobreposição:
  // Rótulo: [x+3 .. x+45.5] (42.5 mm) | Barra: [x+46.5 .. x+97.5] (51 mm) | Valor/%: [x+99 .. x+w-3] (30.5 mm alinhado à direita)
  const labelMaxW = 42.5;
  const barX = x + 46.5;
  const barMaxW = w - 46.5 - 33.5; // ~52.5 mm em painel de 132.5 mm
  const rowStep = (h - 11.5) / 5;
  const barH = 4.6;

  topItems.forEach((item, idx) => {
    const rowY = y + 10.8 + idx * rowStep;
    const pct = totalLiters > 0 ? ((item.liters / totalLiters) * 100).toFixed(1) : '0.0';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.1);
    doc.setTextColor(35, 45, 40);
    const labelText = fitTextWidth(doc, item.label, labelMaxW);
    doc.text(labelText, x + 3, rowY + 3.4);

    // Fundo da trilha
    doc.setFillColor(240, 244, 242);
    doc.rect(barX, rowY, barMaxW, barH, 'F');

    // Barra preenchida
    const barW = Math.max(1.5, (item.liters / maxLiters) * barMaxW);
    doc.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
    doc.rect(barX, rowY, barW, barH, 'F');

    // Valor e percentual isolados à direita da barra
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(25, 45, 35);
    doc.text(`${formatLitersBR(item.liters)} L (${pct}%)`, x + w - 3, rowY + 3.4, { align: 'right' });
  });
}

function drawTimelineChartPanel(
  doc: any,
  options: {
    x: number;
    y: number;
    w: number;
    h: number;
    sortedTime: Array<{ date: string; liters: number }>;
  }
) {
  const { x, y, w, h, sortedTime } = options;
  const subtitle = sortedTime.length > 31
    ? `Últimos 31 de ${sortedTime.length} dias com registro`
    : sortedTime.length > 0
      ? `${sortedTime.length} dia(s) com registro`
      : 'Litros por Data';

  drawPdfChartBox(doc, x, y, w, h, 'EVOLUÇÃO DO CONSUMO NO PERÍODO', subtitle, [15, 118, 110]);

  if (sortedTime.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(140, 150, 145);
    doc.text('Nenhum abastecimento no período selecionado.', x + 5, y + h / 2 + 2);
    return;
  }

  // Preserva todo o período até 31 pontos; para intervalos longos exibe os últimos 31 dias sinalizando claramente
  const timeSlice = sortedTime.length > 31 ? sortedTime.slice(-31) : sortedTime;
  const maxTimeLiters = Math.max(...timeSlice.map(t => t.liters), 1);

  const axisLeftX = x + 15;
  const chartTopY = y + 13.5;
  const chartInnerW = w - 19;
  const chartInnerH = h - 22.5;
  const baseLineY = chartTopY + chartInnerH;

  // Linhas de referência horizontais (100% e 50%) + rótulos de escala Y
  doc.setDrawColor(232, 238, 235);
  doc.setLineWidth(0.2);
  doc.line(axisLeftX, chartTopY, axisLeftX + chartInnerW, chartTopY);
  doc.line(axisLeftX, chartTopY + chartInnerH / 2, axisLeftX + chartInnerW, chartTopY + chartInnerH / 2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(110, 125, 120);
  doc.text(`${Math.round(maxTimeLiters).toLocaleString('pt-BR')}L`, axisLeftX - 1.5, chartTopY + 1.5, { align: 'right' });
  doc.text(`${Math.round(maxTimeLiters / 2).toLocaleString('pt-BR')}L`, axisLeftX - 1.5, chartTopY + chartInnerH / 2 + 1.5, { align: 'right' });
  doc.text('0L', axisLeftX - 1.5, baseLineY + 1, { align: 'right' });

  // Eixo base
  doc.setDrawColor(195, 210, 202);
  doc.line(axisLeftX, baseLineY, axisLeftX + chartInnerW, baseLineY);

  const colStep = chartInnerW / Math.max(timeSlice.length, 1);
  const barWidth = Math.max(1.6, Math.min(colStep * 0.62, 8.5));
  const labelStep = Math.max(1, Math.ceil(timeSlice.length / 12));

  timeSlice.forEach((pt, idx) => {
    const colX = axisLeftX + idx * colStep + (colStep - barWidth) / 2;
    const barH = Math.max(1.2, (pt.liters / maxTimeLiters) * chartInnerH);
    const barY = baseLineY - barH;

    doc.setFillColor(15, 118, 110);
    doc.rect(colX, barY, barWidth, barH, 'F');

    if (timeSlice.length <= 12) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.7);
      doc.setTextColor(15, 90, 80);
      doc.text(`${Math.round(pt.liters)}`, colX + barWidth / 2, barY - 1.2, { align: 'center' });
    }

    const shouldShowDate = idx === 0 || idx === timeSlice.length - 1 || idx % labelStep === 0;
    if (shouldShowDate) {
      const parts = pt.date.split('-');
      const dateLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}` : pt.date;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.6);
      doc.setTextColor(85, 100, 95);
      doc.text(dateLabel, colX + barWidth / 2, baseLineY + 3.8, { align: 'center' });
    }
  });
}

/**
 * Renderiza os cards de Indicadores Executivos (4 cards sem financeiro, 5 cards com financeiro).
 */
function drawExecutiveKpiCards(
  doc: any,
  metrics: ReportMetrics,
  startY: number,
  canViewFinancial: boolean
) {
  const cardGap = 4;
  const topEq = metrics.topEquipment;
  const topAct = metrics.topActivity;
  const eqPct = metrics.totalLiters > 0 && topEq ? ((topEq.liters / metrics.totalLiters) * 100).toFixed(1) : '0.0';
  const actPct = metrics.totalLiters > 0 && topAct ? ((topAct.liters / metrics.totalLiters) * 100).toFixed(1) : '0.0';

  const kpis: Array<{
    title: string;
    value: string;
    subtitle: string;
    color: [number, number, number];
    compactValueFont?: boolean;
  }> = [
    {
      title: 'VOLUME TOTAL',
      value: `${formatLitersBR(metrics.totalLiters)} L`,
      subtitle: `Média: ${formatLitersBR(metrics.avgLitersPerLog)} L/abast.`,
      color: [16, 110, 60]
    },
    {
      title: 'ABASTECIMENTOS',
      value: `${metrics.totalCount} registro(s)`,
      subtitle: `${metrics.uniqueEquipmentsCount} equip. | ${metrics.uniqueOperatorsCount} oper.`,
      color: [14, 116, 144]
    }
  ];

  if (canViewFinancial) {
    kpis.push({
      title: 'INVESTIMENTO TOTAL',
      value: formatCurrency(metrics.totalCost),
      subtitle: `Preço médio: ${formatCurrency(metrics.avgPricePerLiter)}/L`,
      color: [180, 100, 15]
    });
  }

  kpis.push(
    {
      title: 'MAIOR CONSUMO (MÁQ.)',
      value: topEq ? sanitizePdfText(topEq.name) : 'N/A',
      subtitle: topEq ? `${formatLitersBR(topEq.liters)} L (${eqPct}%)` : 'Sem registros',
      color: [180, 83, 9],
      compactValueFont: true
    },
    {
      title: 'ATIVIDADE PRINCIPAL',
      value: topAct ? sanitizePdfText(topAct.name) : 'N/A',
      subtitle: topAct ? `${formatLitersBR(topAct.liters)} L (${actPct}%)` : 'Sem registros',
      color: [30, 64, 175],
      compactValueFont: true
    }
  );

  const count = kpis.length;
  const cardW = (PDF_CONTENT_W - cardGap * (count - 1)) / count;
  const cardH = 18.5;

  kpis.forEach((kpi, idx) => {
    const x = PDF_MARGIN_L + idx * (cardW + cardGap);
    const y = startY;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(215, 226, 220);
    doc.setLineWidth(0.25);
    doc.rect(x, y, cardW, cardH, 'FD');

    doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.rect(x, y, cardW, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(95, 110, 105);
    doc.text(kpi.title, x + 3, y + 5.2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(kpi.compactValueFont ? 8.3 : 10.5);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(fitTextWidth(doc, kpi.value, cardW - 6), x + 3, y + 11.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.7);
    doc.setTextColor(90, 105, 100);
    doc.text(fitTextWidth(doc, kpi.subtitle, cardW - 6), x + 3, y + 16.0);
  });
}

/**
 * Faixa de resumo operacional para o PDF Oficial / Operacional.
 */
function drawOfficialSummaryStrip(
  doc: any,
  metrics: ReportMetrics,
  startY: number,
  canViewFinancial: boolean
) {
  const stripH = 14.5;
  doc.setFillColor(246, 250, 247);
  doc.setDrawColor(208, 224, 214);
  doc.setLineWidth(0.25);
  doc.rect(PDF_MARGIN_L, startY, PDF_CONTENT_W, stripH, 'FD');

  doc.setFillColor(15, 56, 34);
  doc.rect(PDF_MARGIN_L, startY, 2.0, stripH, 'F');

  const cols: Array<{ label: string; value: string; sub: string }> = [
    {
      label: 'TOTAL DE REGISTROS',
      value: `${metrics.totalCount} lançamento(s)`,
      sub: `${metrics.uniqueEquipmentsCount} equipamento(s)`
    },
    {
      label: 'VOLUME TOTAL ABASTECIDO',
      value: `${formatLitersBR(metrics.totalLiters)} L`,
      sub: `Média de ${formatLitersBR(metrics.avgLitersPerLog)} L por registro`
    },
    {
      label: 'POSTOS / COMBUSTÍVEIS',
      value: `${metrics.sortedStation.length} posto(s) | ${metrics.sortedFuelType.length} comb.`,
      sub: metrics.topEquipment ? `Maior vol.: ${fitTextWidth(doc, metrics.topEquipment.name, 48)}` : '-'
    }
  ];

  if (canViewFinancial) {
    cols.push({
      label: 'INVESTIMENTO TOTAL',
      value: formatCurrency(metrics.totalCost),
      sub: `Preço médio: ${formatCurrency(metrics.avgPricePerLiter)}/L`
    });
  }

  const colW = (PDF_CONTENT_W - 6) / cols.length;
  cols.forEach((col, idx) => {
    const colX = PDF_MARGIN_L + 5 + idx * colW;
    if (idx > 0) {
      doc.setDrawColor(220, 232, 224);
      doc.line(colX - 3, startY + 2.5, colX - 3, startY + stripH - 2.5);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.3);
    doc.setTextColor(90, 110, 100);
    doc.text(col.label, colX, startY + 4.4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(15, 56, 34);
    doc.text(fitTextWidth(doc, col.value, colW - 6), colX, startY + 9.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(95, 110, 105);
    doc.text(fitTextWidth(doc, col.sub, colW - 6), colX, startY + 12.8);
  });
}

function drawDetailedFuelLogsTable(
  doc: any,
  autoTable: any,
  sortedLogs: FuelLog[],
  metrics: ReportMetrics,
  startY: number,
  canViewFinancial: boolean,
  onDrawPageHeader: (pageNumber: number) => void
): number {
  const tableData = sortedLogs.map(log => {
    const opLabel = log.operationType ? getOperationTypeLabelOnly(log.operationType) : '-';
    const actLabel = log.activityType ? getActivityTypeName(log.activityType, log.operationType) : '';
    const opAndActivity = sanitizePdfText(
      actLabel && actLabel !== '-' ? `${opLabel} - ${actLabel}` : opLabel
    );

    const row: string[] = [
      formatDateTimeBR(log.dateTime),
      sanitizePdfText(log.equipmentPlateOrCode || '-'),
      sanitizePdfText(log.equipmentName || '-'),
      formatMeterReading(log),
      formatTankFillStatus(log),
      sanitizePdfText(log.driverOrOperatorName || '-'),
      opAndActivity,
      sanitizePdfText(log.gasStationName || '-'),
      sanitizePdfText(getFuelTypeName(log.fuelType)),
      `${formatLitersBR(log.liters)} L`
    ];

    if (canViewFinancial) {
      row.push(formatCurrency(log.pricePerLiter));
      row.push(formatCurrency(log.totalValue));
    }

    const avgLabel = log.isFullTank && log.calculatedAverageKmPerLiter
      ? `${log.calculatedAverageKmPerLiter} km/L`
      : log.isFullTank && log.calculatedAverageLitersPerHour
        ? `${log.calculatedAverageLitersPerHour} L/h`
        : '-';
    row.push(avgLabel);

    return row;
  });

  const headCols = canViewFinancial
    ? ['Data/Hora', 'Placa/Cód.', 'Equipamento', 'Horím./KM', 'Tanque', 'Operador', 'Operação / Atividade', 'Posto', 'Combustível', 'Litros', 'R$/L', 'Total R$', 'Média']
    : ['Data/Hora', 'Placa/Cód.', 'Equipamento', 'Horím./KM', 'Tanque', 'Operador', 'Operação / Atividade', 'Posto', 'Combustível', 'Litros', 'Média'];

  const footCols = canViewFinancial
    ? ['TOTAL', `${sortedLogs.length} reg.`, '', '', '', '', '', '', '', `${formatLitersBR(metrics.totalLiters)} L`, formatCurrency(metrics.avgPricePerLiter), formatCurrency(metrics.totalCost), '']
    : ['TOTAL', `${sortedLogs.length} reg.`, '', '', '', '', '', '', '', `${formatLitersBR(metrics.totalLiters)} L`, ''];

  // Larguras exatas somando 269 mm para evitar estouro ou desalinhamento
  const columnStyles: Record<number, any> = canViewFinancial
    ? {
        0: { cellWidth: 23, halign: 'left' },
        1: { cellWidth: 16, halign: 'center' },
        2: { cellWidth: 30, halign: 'left' },
        3: { cellWidth: 17, halign: 'right' },
        4: { cellWidth: 12, halign: 'center' },
        5: { cellWidth: 24, halign: 'left' },
        6: { cellWidth: 34, halign: 'left' },
        7: { cellWidth: 26, halign: 'left' },
        8: { cellWidth: 20, halign: 'left' },
        9: { cellWidth: 18, halign: 'right', fontStyle: 'bold' },
        10: { cellWidth: 14, halign: 'right' },
        11: { cellWidth: 19, halign: 'right', fontStyle: 'bold' },
        12: { cellWidth: 16, halign: 'right' }
      }
    : {
        0: { cellWidth: 24, halign: 'left' },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 37, halign: 'left' },
        3: { cellWidth: 20, halign: 'right' },
        4: { cellWidth: 14, halign: 'center' },
        5: { cellWidth: 30, halign: 'left' },
        6: { cellWidth: 40, halign: 'left' },
        7: { cellWidth: 30, halign: 'left' },
        8: { cellWidth: 22, halign: 'left' },
        9: { cellWidth: 18, halign: 'right', fontStyle: 'bold' },
        10: { cellWidth: 16, halign: 'right' }
      };

  autoTable(doc, {
    startY,
    head: [headCols],
    body: tableData,
    foot: [footCols],
    showHead: 'everyPage',
    showFoot: 'lastPage',
    rowPageBreak: 'avoid',
    theme: 'grid',
    headStyles: {
      fillColor: [20, 78, 46],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.0,
      cellPadding: 1.6,
      valign: 'middle'
    },
    footStyles: {
      fillColor: [228, 240, 233],
      textColor: [15, 56, 34],
      fontStyle: 'bold',
      fontSize: 7.2,
      cellPadding: 1.8
    },
    styles: {
      font: 'helvetica',
      fontSize: 6.9,
      cellPadding: 1.45,
      textColor: [30, 41, 59],
      lineColor: [222, 232, 226],
      lineWidth: 0.2,
      overflow: 'linebreak',
      valign: 'middle'
    },
    alternateRowStyles: {
      fillColor: [248, 251, 249]
    },
    columnStyles,
    margin: { top: PDF_CONTENT_TOP_Y, left: PDF_MARGIN_L, right: PDF_MARGIN_R, bottom: PDF_MARGIN_BOTTOM },
    didDrawPage: (data: any) => {
      onDrawPageHeader(data.pageNumber);
    }
  });

  return (doc as any).lastAutoTable?.finalY || startY;
}

function drawFuelAndStationClosingTables(
  doc: any,
  autoTable: any,
  metrics: ReportMetrics,
  startY: number,
  canViewFinancial: boolean,
  onDrawPageHeader: (pageNumber: number) => void
): number {
  const buildRows = (items: GroupedSummaryItem[]) =>
    items.map(item => {
      const pct = metrics.totalLiters > 0 ? ((item.liters / metrics.totalLiters) * 100).toFixed(1) : '0.0';
      const row: string[] = [
        sanitizePdfText(item.name),
        String(item.count),
        `${formatLitersBR(item.liters)} L`,
        `${pct}%`
      ];
      if (canViewFinancial) {
        row.push(formatCurrency(item.cost));
      }
      return row;
    });

  const fuelHead = canViewFinancial
    ? ['Tipo de Combustível', 'Qtd.', 'Litros', '%', 'Total R$']
    : ['Tipo de Combustível', 'Qtd.', 'Litros', '%'];
  const stationHead = canViewFinancial
    ? ['Posto / Tanque', 'Qtd.', 'Litros', '%', 'Total R$']
    : ['Posto / Tanque', 'Qtd.', 'Litros', '%'];

  const fuelFoot = canViewFinancial
    ? ['TOTAL', String(metrics.totalCount), `${formatLitersBR(metrics.totalLiters)} L`, '100%', formatCurrency(metrics.totalCost)]
    : ['TOTAL', String(metrics.totalCount), `${formatLitersBR(metrics.totalLiters)} L`, '100%'];
  const stationFoot = [...fuelFoot];

  const halfW = 131.5; // 131.5 + 6 gap + 131.5 = 269 mm
  const colStylesSide: Record<number, any> = canViewFinancial
    ? {
        0: { cellWidth: 53.5, halign: 'left' },
        1: { cellWidth: 13, halign: 'center' },
        2: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
        3: { cellWidth: 15, halign: 'right' },
        4: { cellWidth: 26, halign: 'right', fontStyle: 'bold' }
      }
    : {
        0: { cellWidth: 74.5, halign: 'left' },
        1: { cellWidth: 15, halign: 'center' },
        2: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
        3: { cellWidth: 16, halign: 'right' }
      };

  const canPlaceSideBySide = metrics.sortedFuelType.length <= 10 && metrics.sortedStation.length <= 10;

  if (canPlaceSideBySide) {
    const startPage = (doc as any).internal.getCurrentPageInfo().pageNumber;

    autoTable(doc, {
      startY,
      head: [fuelHead],
      body: buildRows(metrics.sortedFuelType),
      foot: [fuelFoot],
      showHead: 'everyPage',
      showFoot: 'lastPage',
      rowPageBreak: 'avoid',
      theme: 'grid',
      headStyles: { fillColor: [20, 78, 46], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.0, cellPadding: 1.5 },
      footStyles: { fillColor: [230, 240, 234], textColor: [15, 56, 34], fontStyle: 'bold', fontSize: 7.0, cellPadding: 1.5 },
      styles: { font: 'helvetica', fontSize: 6.9, cellPadding: 1.4, lineColor: [222, 232, 226], lineWidth: 0.2 },
      alternateRowStyles: { fillColor: [248, 251, 249] },
      columnStyles: colStylesSide,
      margin: { top: PDF_CONTENT_TOP_Y, left: PDF_MARGIN_L, right: PDF_MARGIN_R + halfW + 6, bottom: PDF_MARGIN_BOTTOM },
      didDrawPage: (data: any) => onDrawPageHeader(data.pageNumber)
    });
    const leftFinalY = (doc as any).lastAutoTable?.finalY || startY;
    const leftEndPage = (doc as any).internal.getCurrentPageInfo().pageNumber;

    // Volta à página inicial do bloco para desenhar a tabela da direita alinhada ao topo
    doc.setPage(startPage);
    autoTable(doc, {
      startY,
      head: [stationHead],
      body: buildRows(metrics.sortedStation),
      foot: [stationFoot],
      showHead: 'everyPage',
      showFoot: 'lastPage',
      rowPageBreak: 'avoid',
      theme: 'grid',
      headStyles: { fillColor: [20, 78, 46], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.0, cellPadding: 1.5 },
      footStyles: { fillColor: [230, 240, 234], textColor: [15, 56, 34], fontStyle: 'bold', fontSize: 7.0, cellPadding: 1.5 },
      styles: { font: 'helvetica', fontSize: 6.9, cellPadding: 1.4, lineColor: [222, 232, 226], lineWidth: 0.2 },
      alternateRowStyles: { fillColor: [248, 251, 249] },
      columnStyles: colStylesSide,
      margin: { top: PDF_CONTENT_TOP_Y, left: PDF_MARGIN_L + halfW + 6, right: PDF_MARGIN_R, bottom: PDF_MARGIN_BOTTOM },
      didDrawPage: (data: any) => onDrawPageHeader(data.pageNumber)
    });
    const rightFinalY = (doc as any).lastAutoTable?.finalY || startY;
    const rightEndPage = (doc as any).internal.getCurrentPageInfo().pageNumber;

    const maxPage = Math.max(leftEndPage, rightEndPage);
    doc.setPage(maxPage);
    if (leftEndPage > rightEndPage) return leftFinalY;
    if (rightEndPage > leftEndPage) return rightFinalY;
    return Math.max(leftFinalY, rightFinalY);
  }

  // Fallback empilhado largura total quando houver muitos postos/combustíveis
  const colStylesFull: Record<number, any> = canViewFinancial
    ? {
        0: { cellWidth: 149, halign: 'left' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 40, halign: 'right', fontStyle: 'bold' }
      }
    : {
        0: { cellWidth: 179, halign: 'left' },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 40, halign: 'right', fontStyle: 'bold' },
        3: { cellWidth: 25, halign: 'right' }
      };

  autoTable(doc, {
    startY,
    head: [fuelHead],
    body: buildRows(metrics.sortedFuelType),
    foot: [fuelFoot],
    showHead: 'everyPage',
    showFoot: 'lastPage',
    rowPageBreak: 'avoid',
    theme: 'grid',
    headStyles: { fillColor: [20, 78, 46], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.2, cellPadding: 1.6 },
    footStyles: { fillColor: [230, 240, 234], textColor: [15, 56, 34], fontStyle: 'bold', fontSize: 7.2, cellPadding: 1.6 },
    styles: { font: 'helvetica', fontSize: 7.0, cellPadding: 1.5, lineColor: [222, 232, 226], lineWidth: 0.2 },
    alternateRowStyles: { fillColor: [248, 251, 249] },
    columnStyles: colStylesFull,
    margin: { top: PDF_CONTENT_TOP_Y, left: PDF_MARGIN_L, right: PDF_MARGIN_R, bottom: PDF_MARGIN_BOTTOM },
    didDrawPage: (data: any) => onDrawPageHeader(data.pageNumber)
  });

  let nextY = ((doc as any).lastAutoTable?.finalY || startY) + 6;
  if (nextY > PDF_MAX_CONTENT_Y - 28) {
    doc.addPage('a4', 'landscape');
    const pageNum = (doc as any).internal.getCurrentPageInfo().pageNumber;
    onDrawPageHeader(pageNum);
    nextY = PDF_CONTENT_TOP_Y + 2;
  }

  autoTable(doc, {
    startY: nextY,
    head: [stationHead],
    body: buildRows(metrics.sortedStation),
    foot: [stationFoot],
    showHead: 'everyPage',
    showFoot: 'lastPage',
    rowPageBreak: 'avoid',
    theme: 'grid',
    headStyles: { fillColor: [20, 78, 46], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.2, cellPadding: 1.6 },
    footStyles: { fillColor: [230, 240, 234], textColor: [15, 56, 34], fontStyle: 'bold', fontSize: 7.2, cellPadding: 1.6 },
    styles: { font: 'helvetica', fontSize: 7.0, cellPadding: 1.5, lineColor: [222, 232, 226], lineWidth: 0.2 },
    alternateRowStyles: { fillColor: [248, 251, 249] },
    columnStyles: colStylesFull,
    margin: { top: PDF_CONTENT_TOP_Y, left: PDF_MARGIN_L, right: PDF_MARGIN_R, bottom: PDF_MARGIN_BOTTOM },
    didDrawPage: (data: any) => onDrawPageHeader(data.pageNumber)
  });

  return (doc as any).lastAutoTable?.finalY || nextY;
}

function drawChartsGridSection(
  doc: any,
  metrics: ReportMetrics,
  options: {
    headingTitle: string;
    headingSubtitle: string;
    headingY: number;
    panelH: number;
    rowGap?: number;
  }
): number {
  const { headingTitle, headingSubtitle, headingY, panelH, rowGap = 4 } = options;

  drawSectionHeading(doc, headingTitle, headingY, headingSubtitle);

  const panelW = 132.5;
  const row1Y = headingY + 3.0;
  const row2Y = row1Y + panelH + rowGap;

  drawHorizontalBarChartPanel(doc, {
    x: PDF_MARGIN_L,
    y: row1Y,
    w: panelW,
    h: panelH,
    title: 'CONSUMO POR EQUIPAMENTO / MÁQUINA',
    subtitle: 'Top 5 Máquinas',
    accentRgb: [217, 119, 6],
    totalLiters: metrics.totalLiters,
    items: metrics.sortedEq.map(e => ({
      label: e.code ? `${e.name} (${e.code})` : e.name,
      liters: e.liters
    }))
  });

  drawHorizontalBarChartPanel(doc, {
    x: PDF_MARGIN_L + panelW + 4,
    y: row1Y,
    w: panelW,
    h: panelH,
    title: 'CONSUMO POR ATIVIDADE',
    subtitle: 'Top 5 Atividades',
    accentRgb: [16, 140, 75],
    totalLiters: metrics.totalLiters,
    items: metrics.sortedAct.map(a => ({
      label: a.name,
      liters: a.liters
    }))
  });

  drawHorizontalBarChartPanel(doc, {
    x: PDF_MARGIN_L,
    y: row2Y,
    w: panelW,
    h: panelH,
    title: 'CONSUMO POR OPERADOR / MOTORISTA',
    subtitle: 'Top 5 Operadores',
    accentRgb: [37, 99, 235],
    totalLiters: metrics.totalLiters,
    items: metrics.sortedOp.map(o => ({
      label: o.name,
      liters: o.liters
    }))
  });

  drawTimelineChartPanel(doc, {
    x: PDF_MARGIN_L + panelW + 4,
    y: row2Y,
    w: panelW,
    h: panelH,
    sortedTime: metrics.sortedTime
  });

  return row2Y + panelH;
}

/**
 * EXPORTAÇÃO EM PDF — DUAL VARIANT:
 * - 'OFFICIAL' (Relatório Oficial / Operacional): Foco em conferência e auditoria cronológica crescente + fechamento por combustível/posto + Resumo Gráfico do Período ao final.
 * - 'EXECUTIVE' (Relatório Executivo Gerencial): Foco em análise gerencial com KPIs e gráficos na abertura, seguido de resumo por combustível/posto e detalhamento cronológico.
 */
export async function exportReportPDF(options: ReportExportOptions) {
  const {
    logs,
    vehicles,
    companyInfo,
    dateRangeStr,
    canViewFinancial,
    appliedFiltersDesc = 'Filtros aplicados: Período selecionado',
    variant = 'OFFICIAL',
    reportTitle = variant === 'EXECUTIVE'
      ? 'RELATÓRIO EXECUTIVO GERENCIAL DE ABASTECIMENTOS'
      : 'RELATÓRIO OFICIAL DE ABASTECIMENTOS'
  } = options;

  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  // Ordenação cronológica crescente sobre uma cópia sem alterar estado da UI
  const sortedLogs = sortLogsChronologicallyAsc(logs || []);
  const metrics = calculateReportMetrics(sortedLogs, vehicles || []);
  const issuedAtStr = formatDateTimeBR(new Date().toISOString());

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const headerDrawnPages = new Set<number>();
  const ensureHeaderOnPage = (pageNum?: number) => {
    const targetPage = pageNum || (doc as any).internal.getCurrentPageInfo().pageNumber;
    if (headerDrawnPages.has(targetPage)) return;
    doc.setPage(targetPage);
    drawPdfHeader(doc, {
      companyInfo,
      reportTitle,
      dateRangeStr,
      appliedFiltersDesc,
      issuedAtStr,
      totalLogsCount: sortedLogs.length
    });
    headerDrawnPages.add(targetPage);
  };

  // Cabeçalho garantido na Página 1
  ensureHeaderOnPage(1);

  if (sortedLogs.length === 0) {
    // Tratamento limpo para relatórios sem registros
    doc.setFillColor(248, 250, 249);
    doc.setDrawColor(210, 224, 215);
    doc.rect(PDF_MARGIN_L, 38, PDF_CONTENT_W, 32, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 56, 34);
    doc.text('Nenhum abastecimento localizado para os filtros aplicados.', PDF_PAGE_W / 2, 51, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(95, 110, 105);
    doc.text(
      `Período consultado: ${sanitizePdfText(dateRangeStr)}  |  Ajuste as datas ou filtros e tente exportar novamente.`,
      PDF_PAGE_W / 2,
      59,
      { align: 'center' }
    );
  } else if (variant === 'EXECUTIVE') {
    // =========================================================================
    // MODELO 1: PDF EXECUTIVO (GERENCIAL)
    // =========================================================================
    // Página 1: KPIs + 4 Gráficos Analíticos equilibrados
    drawSectionHeading(doc, 'Indicadores Gerais de Consumo e Abastecimento', 34.5);
    drawExecutiveKpiCards(doc, metrics, 37.5, canViewFinancial);

    drawChartsGridSection(doc, metrics, {
      headingTitle: 'Análise Gráfica do Consumo no Período',
      headingSubtitle: 'Top 5 categorias em volume e evolução diária',
      headingY: 62.5,
      panelH: 62,
      rowGap: 4
    });

    // Página 2: Resumo por Combustível e Posto/Tanque + Detalhamento Cronológico
    doc.addPage('a4', 'landscape');
    ensureHeaderOnPage();

    drawSectionHeading(
      doc,
      'Resumo por Combustível e Posto / Tanque',
      34.5,
      canViewFinancial ? 'Consolidado físico e financeiro' : 'Consolidado volumétrico'
    );

    const closingEndY = drawFuelAndStationClosingTables(
      doc,
      autoTable,
      metrics,
      37.5,
      canViewFinancial,
      ensureHeaderOnPage
    );

    const remainingForDetails = PDF_MAX_CONTENT_Y - (closingEndY + 8);
    let detailsStartY: number;

    if (remainingForDetails >= 46) {
      drawSectionHeading(
        doc,
        'Detalhamento dos Abastecimentos',
        closingEndY + 9,
        'Ordem cronológica crescente'
      );
      detailsStartY = closingEndY + 12;
    } else {
      doc.addPage('a4', 'landscape');
      ensureHeaderOnPage();
      drawSectionHeading(
        doc,
        'Detalhamento dos Abastecimentos',
        34.5,
        'Ordem cronológica crescente'
      );
      detailsStartY = 37.5;
    }

    drawDetailedFuelLogsTable(
      doc,
      autoTable,
      sortedLogs,
      metrics,
      detailsStartY,
      canViewFinancial,
      ensureHeaderOnPage
    );
  } else {
    // =========================================================================
    // MODELO 2: PDF OFICIAL / OPERACIONAL (CONFERÊNCIA, AUDITORIA E RESUMO GRÁFICO)
    // =========================================================================
    drawOfficialSummaryStrip(doc, metrics, 30.5, canViewFinancial);

    drawSectionHeading(
      doc,
      'Relação Cronológica de Abastecimentos',
      50.0,
      'Ordem cronológica crescente'
    );

    const tableFinalY = drawDetailedFuelLogsTable(
      doc,
      autoTable,
      sortedLogs,
      metrics,
      53.0,
      canViewFinancial,
      ensureHeaderOnPage
    );

    // Fechamento por combustível e posto/tanque ao final da tabela
    const maxClosingRows = Math.max(metrics.sortedFuelType.length, metrics.sortedStation.length, 1);
    const estimatedClosingH = 18 + maxClosingRows * 6.5;
    const availableAfterTable = PDF_MAX_CONTENT_Y - (tableFinalY + 8);

    let closingTitleY: number;
    if (
      metrics.sortedFuelType.length <= 10 &&
      metrics.sortedStation.length <= 10 &&
      availableAfterTable >= estimatedClosingH
    ) {
      closingTitleY = tableFinalY + 9;
    } else {
      doc.addPage('a4', 'landscape');
      ensureHeaderOnPage();
      closingTitleY = 34.5;
    }

    drawSectionHeading(
      doc,
      'Fechamento por Tipo de Combustível e Posto / Tanque',
      closingTitleY,
      'Conferência consolidada do período'
    );

    const closingEndY = drawFuelAndStationClosingTables(
      doc,
      autoTable,
      metrics,
      closingTitleY + 3.5,
      canViewFinancial,
      ensureHeaderOnPage
    );

    let lastOperationalY = closingEndY;
    if (metrics.suspiciousCount > 0 && closingEndY + 8 <= PDF_MAX_CONTENT_Y) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.0);
      doc.setTextColor(145, 75, 15);
      doc.text(
        `Nota de auditoria: ${metrics.suspiciousCount} lançamento(s) no período possuem sinalização de consumo anômalo registrada no sistema.`,
        PDF_MARGIN_L,
        closingEndY + 6
      );
      lastOperationalY = closingEndY + 8;
    }

    // Seção Final: Resumo Gráfico do Período (4 gráficos analíticos preservados no Oficial)
    const minChartsBlockH = 118; // heading (3mm) + 2*55mm + gap (4mm)
    const availableForCharts = PDF_MAX_CONTENT_Y - (lastOperationalY + 9);

    if (availableForCharts >= minChartsBlockH) {
      const fittedPanelH = Math.min(72, Math.floor((availableForCharts - 8) / 2));
      drawChartsGridSection(doc, metrics, {
        headingTitle: 'Resumo Gráfico do Período',
        headingSubtitle: 'Top 5 categorias em volume e evolução diária',
        headingY: lastOperationalY + 9,
        panelH: fittedPanelH,
        rowGap: 4
      });
    } else {
      doc.addPage('a4', 'landscape');
      ensureHeaderOnPage();
      drawChartsGridSection(doc, metrics, {
        headingTitle: 'Resumo Gráfico do Período',
        headingSubtitle: 'Top 5 categorias em volume e evolução diária',
        headingY: 34.5,
        panelH: 72,
        rowGap: 5
      });
    }
  }

  // Padronizar cabeçalho (garantia) e rodapé em TODAS as páginas com numeração dinâmica
  const totalPages = (doc as any).internal.getNumberOfPages();
  const variantFooterLabel = variant === 'EXECUTIVE' ? 'Relatório Executivo' : 'Relatório Oficial';

  for (let p = 1; p <= totalPages; p++) {
    ensureHeaderOnPage(p);
    doc.setPage(p);

    doc.setDrawColor(215, 225, 220);
    doc.setLineWidth(0.25);
    doc.line(PDF_MARGIN_L, PDF_FOOTER_LINE_Y, PDF_PAGE_W - PDF_MARGIN_R, PDF_FOOTER_LINE_Y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.0);
    doc.setTextColor(105, 120, 115);
    doc.text(
      fitTextWidth(
        doc,
        `${companyInfo.name || 'AndradeAgro'}  |  ${variantFooterLabel}  |  Período: ${dateRangeStr}`,
        215
      ),
      PDF_MARGIN_L,
      PDF_FOOTER_TEXT_Y
    );
    doc.setFont('helvetica', 'bold');
    doc.text(`Página ${p} de ${totalPages}`, PDF_PAGE_W - PDF_MARGIN_R, PDF_FOOTER_TEXT_Y, { align: 'right' });
  }

  const filePrefix = variant === 'EXECUTIVE' ? 'AndradeAgro_Executivo' : 'AndradeAgro_Oficial';
  const cleanFileName = `${filePrefix}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(cleanFileName);
}

/**
 * EXPORTAÇÃO OFICIAL EM EXCEL (.xlsx com Gráficos Incorporados):
 * 1. Cabeçalho Oficial no Topo da Planilha
 * 2. Tabela Principal com Todos os Lançamentos e Colunas
 * 3. Totalizadores ao final da tabela
 * 4. Resumo Gerencial / Indicadores em células formatadas
 * 5. Gráficos Analíticos Incorporados Diretamente na Mesma Planilha Abaixo da Última Linha
 */
export async function exportReportExcel(options: ReportExportOptions) {
  const {
    logs,
    vehicles,
    companyInfo,
    dateRangeStr,
    canViewFinancial,
    appliedFiltersDesc = 'Filtros aplicados: Período selecionado'
  } = options;

  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = companyInfo.name || 'AndradeAgro';
  wb.created = new Date();

  const ws = wb.addWorksheet('Relatório de Abastecimentos', {
    views: [{ showGridLines: true }]
  });

  const metrics = calculateReportMetrics(logs, vehicles);

  // 1. CABEÇALHO DO RELATÓRIO
  ws.mergeCells(1, 1, 1, canViewFinancial ? 21 : 17);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `${companyInfo.name.toUpperCase()} - GESTÃO INTELIGENTE DO AGRONEGÓCIO`;
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3822' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 26;

  ws.mergeCells(2, 1, 2, canViewFinancial ? 21 : 17);
  const subCell = ws.getCell(2, 1);
  subCell.value = `Relatório de Abastecimentos e Gestão de Frotas • Período: ${dateRangeStr} • Filtros: ${appliedFiltersDesc}`;
  subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF2D3748' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(2).height = 19;

  ws.mergeCells(3, 1, 3, canViewFinancial ? 21 : 17);
  const metaCell = ws.getCell(3, 1);
  metaCell.value = `Emitido em: ${formatDateTimeBR(new Date().toISOString())} • CNPJ: ${companyInfo.cnpj} • Total de Lançamentos: ${logs.length}`;
  metaCell.font = { name: 'Arial', size: 9, color: { argb: 'FF4A5568' } };
  metaCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(3).height = 18;

  // 2. TABELA PRINCIPAL
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
    headers.push('Valor por Litro (R$)', 'Valor Total (R$)');
  }

  headers.push('KM no Abastecimento', 'Horímetro no Abastecimento', 'Média km/L', 'Média L/h');

  if (canViewFinancial) {
    headers.push('Custo por KM (R$)', 'Custo por Hora (R$)');
  }

  headers.push('Observações');

  const headerRow = ws.getRow(5);
  headerRow.values = headers;
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF154C2E' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF0F3822' } },
      bottom: { style: 'thin', color: { argb: 'FF0F3822' } },
      left: { style: 'thin', color: { argb: 'FF0F3822' } },
      right: { style: 'thin', color: { argb: 'FF0F3822' } }
    };
  });

  // Linhas de dados da tabela principal
  logs.forEach((log, index) => {
    const rowNum = 6 + index;
    const r = ws.getRow(rowNum);

    const values: any[] = [
      formatDateTimeBR(log.dateTime),
      log.equipmentId || '',
      log.equipmentCategory || '',
      log.equipmentPlateOrCode || '',
      log.equipmentName || '',
      getOperationTypeName(log.operationType),
      log.activityType ? getActivityTypeName(log.activityType, log.operationType) : '',
      log.driverOrOperatorName || '',
      log.attendantName || '',
      log.gasStationName || '',
      getFuelTypeName(log.fuelType),
      log.liters || 0
    ];

    if (canViewFinancial) {
      values.push(log.pricePerLiter || 0);
      values.push(log.totalValue || 0);
    }

    values.push(
      log.kmAtFueling ?? '',
      log.hourmeterAtFueling ?? '',
      log.isFullTank ? (log.calculatedAverageKmPerLiter ?? '') : '',
      log.isFullTank ? (log.calculatedAverageLitersPerHour ?? '') : ''
    );

    if (canViewFinancial) {
      values.push(log.costPerKm ?? '', log.costPerHour ?? '');
    }

    values.push(log.observations || '');

    r.values = values;
    r.height = 19;

    const isEven = index % 2 === 0;
    r.eachCell((cell, colIndex) => {
      cell.font = { name: 'Arial', size: 9 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF9FBF9' }
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      // Alinhamentos numéricos
      if (colIndex === 12 || colIndex === 13 || colIndex === 14) {
        cell.alignment = { horizontal: 'right' };
      }
    });
  });

  const lastTableRow = 5 + logs.length;

  // Linha de Totalização
  const totalRow = ws.getRow(lastTableRow + 1);
  const totalValues: any[] = [
    'TOTAL',
    `${logs.length} reg.`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    metrics.totalLiters
  ];

  if (canViewFinancial) {
    totalValues.push('', metrics.totalCost);
  }

  totalRow.values = totalValues;
  totalRow.height = 22;
  totalRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F3822' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F0EA' } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF154C2E' } },
      bottom: { style: 'medium', color: { argb: 'FF154C2E' } }
    };
  });

  // 3. RESUMO GERENCIAL / INDICADORES EM CÉLULAS DA PLANILHA (POSICIONAMENTO DINÂMICO APÓS A TABELA)
  const summaryStartRow = lastTableRow + 3;

  ws.mergeCells(summaryStartRow, 1, summaryStartRow, canViewFinancial ? 14 : 12);
  const sumHeader = ws.getCell(summaryStartRow, 1);
  sumHeader.value = '📊 RESUMO GERENCIAL E INDICADORES OPERACIONAIS';
  sumHeader.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  sumHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF154C2E' } };
  ws.getRow(summaryStartRow).height = 22;

  const kpiData = [
    ['Total de Abastecimentos', logs.length, 'Máquina com Maior Consumo', metrics.topEquipment ? `${metrics.topEquipment.name} (${metrics.topEquipment.liters.toLocaleString('pt-BR')} L)` : '-'],
    ['Volume Total Abastecido', `${metrics.totalLiters.toLocaleString('pt-BR')} L`, 'Operador com Maior Volume', metrics.topOperator ? `${metrics.topOperator.name} (${metrics.topOperator.liters.toLocaleString('pt-BR')} L)` : '-'],
    ['Média por Abastecimento', `${metrics.avgLitersPerLog.toFixed(1)} L`, 'Atividade com Maior Consumo', metrics.topActivity ? `${metrics.topActivity.name} (${metrics.topActivity.liters.toLocaleString('pt-BR')} L)` : '-'],
    [
      canViewFinancial ? 'Investimento Total (R$)' : 'Perfil Operacional',
      canViewFinancial ? formatCurrency(metrics.totalCost) : 'Restrito',
      'Setor com Maior Consumo',
      metrics.topSector ? `${metrics.topSector.name} (${metrics.topSector.liters.toLocaleString('pt-BR')} L)` : '-'
    ]
  ];

  kpiData.forEach((row, idx) => {
    const r = ws.getRow(summaryStartRow + 1 + idx);
    r.values = row;
    r.height = 19;
    r.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF2D3748' } };
    r.getCell(2).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF154C2E' } };
    r.getCell(3).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF2D3748' } };
    r.getCell(4).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF154C2E' } };
  });

  // 4. GRÁFICOS ANALÍTICOS INCORPORADOS NA MESMA PLANILHA ABAIXO DA TABELA
  const chartsStartRow = summaryStartRow + 6;

  // Gerar os 4 gráficos em PNG via Canvas
  const totalLit = metrics.totalLiters;

  const chart1Png = createBarChartPng({
    title: 'CONSUMO POR ATIVIDADE (LITROS E %)',
    subtitle: 'Top 5 Atividades',
    colorHex: '#108c4b',
    items: metrics.sortedAct.map(a => ({
      label: a.name,
      value: a.liters,
      formattedValue: `${a.liters.toLocaleString('pt-BR')} L`,
      percent: totalLit > 0 ? `${((a.liters / totalLit) * 100).toFixed(1)}%` : '0%'
    }))
  });

  const chart2Png = createBarChartPng({
    title: 'CONSUMO POR EQUIPAMENTO / MÁQUINA',
    subtitle: 'Top 5 Máquinas',
    colorHex: '#d97706',
    items: metrics.sortedEq.map(e => ({
      label: e.code ? `${e.name} (${e.code})` : e.name,
      value: e.liters,
      formattedValue: `${e.liters.toLocaleString('pt-BR')} L`,
      percent: totalLit > 0 ? `${((e.liters / totalLit) * 100).toFixed(1)}%` : '0%'
    }))
  });

  const chart3Png = createBarChartPng({
    title: 'CONSUMO POR OPERADOR / MOTORISTA',
    subtitle: 'Top 5 Operadores',
    colorHex: '#2563eb',
    items: metrics.sortedOp.map(o => ({
      label: o.name,
      value: o.liters,
      formattedValue: `${o.liters.toLocaleString('pt-BR')} L`,
      percent: totalLit > 0 ? `${((o.liters / totalLit) * 100).toFixed(1)}%` : '0%'
    }))
  });

  const chart4Png = createTimelineChartPng({
    title: 'EVOLUÇÃO DOS ABASTECIMENTOS NO PERÍODO',
    subtitle: 'Litros Abastecidos por Data',
    colorHex: '#0f766e',
    items: metrics.sortedTime
  });

  if (chart1Png) {
    const img1 = wb.addImage({ base64: chart1Png, extension: 'png' });
    ws.addImage(img1, {
      tl: { col: 0, row: chartsStartRow },
      ext: { width: 500, height: 245 }
    });
  }

  if (chart2Png) {
    const img2 = wb.addImage({ base64: chart2Png, extension: 'png' });
    ws.addImage(img2, {
      tl: { col: 7, row: chartsStartRow },
      ext: { width: 500, height: 245 }
    });
  }

  if (chart3Png) {
    const img3 = wb.addImage({ base64: chart3Png, extension: 'png' });
    ws.addImage(img3, {
      tl: { col: 0, row: chartsStartRow + 13 },
      ext: { width: 500, height: 245 }
    });
  }

  if (chart4Png) {
    const img4 = wb.addImage({ base64: chart4Png, extension: 'png' });
    ws.addImage(img4, {
      tl: { col: 7, row: chartsStartRow + 13 },
      ext: { width: 500, height: 245 }
    });
  }

  // Larguras adequadas para as colunas da planilha
  ws.columns = [
    { width: 18 }, // Data/Hora
    { width: 14 }, // ID
    { width: 14 }, // Categoria
    { width: 14 }, // Placa
    { width: 24 }, // Equipamento
    { width: 16 }, // Operação
    { width: 18 }, // Atividade
    { width: 20 }, // Operador
    { width: 18 }, // Frentista
    { width: 18 }, // Posto
    { width: 16 }, // Combustível
    { width: 14 }, // Litros
    ...(canViewFinancial ? [{ width: 13 }, { width: 15 }] : []),
    { width: 14 }, // KM
    { width: 14 }, // Horímetro
    { width: 13 }, // km/L
    { width: 13 }, // L/h
    ...(canViewFinancial ? [{ width: 14 }, { width: 14 }] : []),
    { width: 26 }  // Obs
  ];

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `AndradeAgro_Relatorio_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
