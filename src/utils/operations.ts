import { OperationType, ActivityType } from '../types';

export interface ActivityOption {
  id: string;
  label: string;
  description?: string;
}

export interface OperationOption {
  id: OperationType;
  label: string;
  emoji: string;
  activities: ActivityOption[];
}

/**
 * Tabela mestra de Operações e Atividades do AndradeAgro.
 * Estruturada centralizadamente para permitir fácil adição de novas operações ou atividades.
 */
export const OPERATIONS_CONFIG: Record<OperationType, { label: string; emoji: string; activities: ActivityOption[] }> = {
  GRAMA: {
    label: 'Grama',
    emoji: '🌱',
    activities: [
      { id: 'CORTE', label: 'Corte' },
      { id: 'ROCADA', label: 'Roçada' },
      { id: 'APLICACAO', label: 'Aplicação' },
      { id: 'COLETA_PALHA', label: 'Coleta de palha' },
      { id: 'OUTRAS', label: 'Outras' },
    ],
  },
  COLHEITA: {
    label: 'Colheita',
    emoji: '🌾',
    activities: [
      { id: 'COLHEITA', label: 'Colheita' },
      { id: 'CORTE', label: 'Corte' },
      { id: 'CARREGAMENTO', label: 'Carregamento' },
      { id: 'TRANSBORDO', label: 'Transbordo' },
      { id: 'OUTRAS', label: 'Outras' },
    ],
  },
  PLANTIO: {
    label: 'Plantio',
    emoji: '🚜',
    activities: [
      { id: 'PLANTIO', label: 'Plantio' },
      { id: 'PREPARO_SOLO', label: 'Preparo de solo' },
      { id: 'SULCACAO', label: 'Sulcação' },
      { id: 'ADUBACAO', label: 'Adubação' },
      { id: 'APLICACAO', label: 'Aplicação' },
      { id: 'OUTRAS', label: 'Outras' },
    ],
  },
  TRANSPORTE: {
    label: 'Transporte',
    emoji: '🚚',
    activities: [
      { id: 'TRANSPORTE_CANA', label: 'Transporte de cana' },
      { id: 'TRANSPORTE_INSUMOS', label: 'Transporte de insumos' },
      { id: 'TRANSPORTE_MAQUINAS', label: 'Transporte de máquinas' },
      { id: 'TRANSPORTE_MATERIAIS', label: 'Transporte de materiais' },
      { id: 'OUTRAS', label: 'Outras' },
    ],
  },
  CANA: {
    label: 'Cana',
    emoji: '🎋',
    activities: [
      { id: 'CORTE_CANA', label: 'Corte de cana' },
      { id: 'CARREGAMENTO_CANA', label: 'Carregamento de cana' },
      { id: 'TRANSPORTE_CANA', label: 'Transporte de cana' },
      { id: 'TRANSBORDO', label: 'Transbordo' },
      { id: 'APLICACAO', label: 'Aplicação' },
      { id: 'PLANTIO_CANA', label: 'Plantio de cana' },
      { id: 'OUTRAS', label: 'Outras' },
    ],
  },
  OUTROS: {
    label: 'Outros',
    emoji: '🔧',
    activities: [
      { id: 'OUTRAS', label: 'Outras' },
    ],
  },
};

export const OPERATION_OPTIONS: Array<{ id: OperationType; label: string; emoji: string }> = [
  { id: 'GRAMA', label: 'Grama', emoji: '🌱' },
  { id: 'COLHEITA', label: 'Colheita', emoji: '🌾' },
  { id: 'PLANTIO', label: 'Plantio', emoji: '🚜' },
  { id: 'TRANSPORTE', label: 'Transporte', emoji: '🚚' },
  { id: 'CANA', label: 'Cana', emoji: '🎋' },
  { id: 'OUTROS', label: 'Outros', emoji: '🔧' },
];

export function getActivitiesForOperation(operationType?: OperationType | string | null): ActivityOption[] {
  if (!operationType) return [];
  const opKey = operationType.toUpperCase() as OperationType;
  const op = OPERATIONS_CONFIG[opKey];
  if (op && Array.isArray(op.activities)) {
    return op.activities;
  }
  return [{ id: 'OUTRAS', label: 'Outras' }];
}

export function getOperationTypeName(operationType?: OperationType | string | null): string {
  if (!operationType) return '-';
  const opKey = operationType.toUpperCase() as OperationType;
  const op = OPERATIONS_CONFIG[opKey];
  return op ? `${op.emoji} ${op.label}` : String(operationType);
}

export function getOperationTypeLabelOnly(operationType?: OperationType | string | null): string {
  if (!operationType) return '-';
  const opKey = operationType.toUpperCase() as OperationType;
  const op = OPERATIONS_CONFIG[opKey];
  return op ? op.label : String(operationType);
}

export function getActivityTypeName(activityType?: ActivityType | string | null, operationType?: OperationType | string | null): string {
  if (!activityType) return '-';
  const actKey = String(activityType).toUpperCase();
  
  if (operationType) {
    const list = getActivitiesForOperation(operationType);
    const found = list.find(a => a.id.toUpperCase() === actKey || a.label.toLowerCase() === String(activityType).toLowerCase());
    if (found) return found.label;
  }
  
  // Search in all operations
  for (const key of Object.keys(OPERATIONS_CONFIG) as OperationType[]) {
    const found = OPERATIONS_CONFIG[key].activities.find(
      a => a.id.toUpperCase() === actKey || a.label.toLowerCase() === String(activityType).toLowerCase()
    );
    if (found) return found.label;
  }
  
  if (actKey === 'OUTROS' || actKey === 'OUTRAS') return 'Outras';
  return String(activityType);
}
