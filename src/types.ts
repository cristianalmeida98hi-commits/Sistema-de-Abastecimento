export type UserRole = 'ADMIN' | 'FUNCIONARIO';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  avatar?: string;
  department: string;
  phone?: string;
  cpf?: string;
  cnh?: string;
  cnhCategory?: string;
  cnhExpiration?: string;
  active: boolean;
}

export type FuelType = 'DIESEL_S10' | 'DIESEL_S500' | 'GASOLINA_COMUM' | 'GASOLINA_GRID' | 'ETANOL' | 'ARLA_32' | 'NENHUM';

export type Sector = 'AGRICOLA' | 'LOGISTICA' | 'OFICINA_MANUTENCAO' | 'DIRETORIA' | 'COLHEITA' | 'PULVERIZACAO' | 'PREPARO_SOLO';

export type EquipmentCategory = 'VEICULO' | 'TRATOR' | 'MAQUINA_AGRICOLA' | 'IMPLEMENTO';

export type MachineSubtype = 
  | 'PULVERIZADOR' 
  | 'COLHEITADEIRA' 
  | 'DISTRIBUIDOR_ADUBO'
  | 'PLANTADEIRA_SEMEADORA'
  | 'ESCAVADEIRA' 
  | 'RETROESCAVADEIRA' 
  | 'PA_CARREGADEIRA' 
  | 'MOTONIVELADORA' 
  | 'IMPLEMENTO'
  | 'CARRETA_AGRICOLA'
  | 'OUTRO';

export type OperationalCapacityType = 
  | 'COMBUSTIVEL'    // Tanque de Combustível (L)
  | 'PULVERIZACAO'   // Tanque de Pulverização / Calda (L)
  | 'ADUBO'          // Tanque / Depósito / Caçamba de Adubo (kg, t, L, m³)
  | 'SEMENTE'        // Depósito de Sementes / Graneleiro (kg, t, L, sacas)
  | 'CACAMBA'        // Caçamba de Carga / Basculante (kg, t, m³)
  | 'RESERVATORIO'   // Reservatório de Água / Óleo / Outros Fluidos (L, m³)
  | 'CARGA'          // Capacidade de Carga Operacional / Tração (kg, t)
  | 'OUTRO';         // Capacidade Personalizada

export interface OperationalCapacity {
  id: string;
  type: OperationalCapacityType;
  name: string; // Nome descritivo (ex: 'Tanque de Pulverização', 'Depósito de Adubo')
  value: number; // Valor numérico da capacidade
  unit: string; // Unidade de medida (L, kg, t, m³, sacas, etc.)
  notes?: string; // Observações opcionais (ex: 'Barra 36m', 'Granulado', 'Coroada')
}

export interface Vehicle {
  id: string;
  category: EquipmentCategory;
  licensePlate: string; // Placa (para veículos)
  patrimonyCode?: string; // Patrimônio (para tratores e máquinas)
  model: string;
  manufacturer: string;
  year: number;
  color: string;
  sector: Sector;
  fuelType: FuelType;
  tankCapacityLiters: number;
  sprayingTankCapacityLiters?: number; // Capacidade do tanque de pulverização / calda (L) para máquinas agrícolas e tratores
  hasSprayingTank?: boolean;          // Indicador se possui tanque de pulverização
  operationalCapacities?: OperationalCapacity[]; // Lista detalhada de capacidades operacionais da máquina
  currentKm: number;
  currentHourmeter?: number;
  lastOilChangeHourmeter?: number; // Horímetro no momento da última troca de óleo
  lastOilChangeDate?: string;      // Data da última troca de óleo
  nextOilChangeHourmeter?: number; // Próximo limite (ex: última + 300h)
  oilChangeIntervalHours?: number; // Intervalo padrão: 300h
  photoUrl?: string;
  status: 'ATIVO' | 'EM_MANUTENCAO' | 'INATIVO';
  assignedOperatorId?: string;
  assignedOperatorName?: string;
  machineSubtype?: MachineSubtype;
  qrCodeUrl?: string;
  lastFuelingDate?: string;
  nextRevisionKmOrHour?: number;
  documentsExpiration?: string;
  notes?: string;
}

export interface GasStation {
  id: string;
  name: string;
  type: 'INTERNO' | 'EXTERNO';
  supplierName: string;
  cnpj?: string;
  location: string;
  pricePerLiter: Record<FuelType, number>;
  active: boolean;
}

export type OperationType = 'GRAMA' | 'COLHEITA' | 'PLANTIO' | 'TRANSPORTE' | 'CANA' | 'OUTROS';

export type ActivityType =
  // Grama
  | 'CORTE'
  | 'ROCADA'
  | 'APLICACAO'
  | 'COLETA_PALHA'
  // Colheita
  | 'COLHEITA'
  | 'CARREGAMENTO'
  | 'TRANSBORDO'
  // Plantio
  | 'PLANTIO'
  | 'PREPARO_SOLO'
  | 'SULCACAO'
  | 'ADUBACAO'
  // Transporte
  | 'TRANSPORTE_CANA'
  | 'TRANSPORTE_INSUMOS'
  | 'TRANSPORTE_MAQUINAS'
  | 'TRANSPORTE_MATERIAIS'
  // Cana
  | 'CORTE_CANA'
  | 'CARREGAMENTO_CANA'
  | 'PLANTIO_CANA'
  // Fallbacks
  | 'OUTRAS'
  | 'OUTROS'
  | string;

export interface FuelLog {
  id: string;
  dateTime: string;
  equipmentId: string;
  equipmentName: string;
  equipmentCategory: EquipmentCategory;
  equipmentPlateOrCode: string;
  driverOrOperatorId: string;
  driverOrOperatorName: string;
  attendantId: string;
  attendantName: string;
  gasStationId: string;
  gasStationName: string;
  fuelType: FuelType;
  liters: number;
  pricePerLiter: number;
  totalValue: number;
  operationType?: OperationType;
  activityType?: ActivityType;
  kmAtFueling?: number;
  hourmeterAtFueling?: number;
  previousKmOrHour?: number;
  calculatedAverageKmPerLiter?: number; // km/L
  calculatedAverageLitersPerHour?: number; // L/h
  costPerKm?: number; // R$/km
  costPerHour?: number; // R$/h
  estimatedAutonomyKmOrHours?: number; // Autonomia estimada
  dashboardPhotoUrl?: string;
  invoicePhotoUrl?: string;
  observations?: string;
  flaggedSuspicious?: boolean;
  suspiciousReason?: string;
  createdAt: string;
  createdById: string;
  createdByName: string;
  updatedAt?: string;
}

export type MaintenanceType = 'REVISAO' | 'TROCA_OLEO' | 'TROCA_FILTROS' | 'PNEUS' | 'PECAS' | 'SERVICO_CORRETIVO' | 'OUTROS';

export interface MaintenanceLog {
  id: string;
  equipmentId: string;
  equipmentName: string;
  equipmentPlateOrCode: string;
  date: string;
  type: MaintenanceType;
  title: string;
  description: string;
  kmOrHourAtService: number;
  nextServiceKmOrHour?: number;
  cost: number;
  supplierOrWorkshop: string;
  performedBy: string;
  status: 'AGENDADO' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'CANCELADO';
  attachments?: string[];
  notes?: string;
}

export type AlertType = 'SUSPICIOUS_FUEL' | 'MAINTENANCE_DUE' | 'IDLE_VEHICLE' | 'DOCUMENT_EXPIRING' | 'LOW_TANK_LEVEL' | 'OIL_CHANGE_DUE' | 'MACHINE_ISSUE';

export interface FuelRefill {
  id: string;
  dateTime: string;
  liters: number;
  fuelType: FuelType;
  supplierName: string;
  invoiceNumber?: string;
  costPerLiter?: number;
  totalCost?: number;
  gasStationId?: string; // ID do posto/tanque de destino (ex: stn-001)
  gasStationName?: string;
  registeredByUserId: string;
  registeredByUserName: string;
  notes?: string;
  createdAt?: string;
}

export interface MachineIssue {
  id: string;
  equipmentId: string;
  equipmentName: string;
  equipmentPlateOrCode: string;
  reportedByUserId: string;
  reportedByUserName: string;
  description: string;
  photoUrl?: string;
  dateTime: string;
  status: 'ABERTO' | 'EM_ANALISE' | 'RESOLVIDO';
  resolvedAt?: string;
  resolvedBy?: string;
  notes?: string;
}

export type PreventiveItemKey = 
  | 'TROCA_OLEO_MOTOR' 
  | 'FILTRO_OLEO' 
  | 'FILTRO_COMBUSTIVEL' 
  | 'FILTRO_AR' 
  | 'LUBRIFICACAO' 
  | 'REVISAO_GERAL' 
  | 'PNEUS_ESTEIRAS';

export interface PreventiveMaintenanceItem {
  id: string;
  equipmentId: string;
  itemKey: PreventiveItemKey;
  itemName: string;
  lastServiceDate: string;
  lastServiceHourmeter: number;
  nextScheduledHourmeter: number;
  intervalHours: number;
  notes?: string;
}

export interface SmartAlert {
  id: string;
  type: AlertType;
  severity: 'BAIXA' | 'MEDIA' | 'ALTA';
  title: string;
  description: string;
  equipmentId?: string;
  equipmentName?: string;
  fuelLogId?: string;
  date: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  cycleTargetHourmeter?: number;
  lastOilChangeHourmeter?: number;
}

export interface AuditLog {
  id: string;
  dateTime: string;
  userId: string;
  userName: string;
  action: 'CRIAR' | 'EDITAR' | 'EXCLUIR' | 'EXPORTAR' | 'LOGIN' | 'CONFIGURACAO';
  entity: string;
  details: string;
  ipAddress?: string;
}

export interface SystemSettings {
  companyName: string;
  slogan: string;
  cnpj: string;
  address: string;
  phone: string;
  contactEmail: string;
  employeeEditTimeLimitHours: number; // Ex: 24 horas para edicao recente
  suspiciousFuelMarginPercentage: number; // Ex: 25% acima da media
  autoAlertsEnabled: boolean;
  themeMode: 'LIGHT' | 'DARK' | 'SYSTEM';
  tankCapacityLiters: number; // Capacidade total do tanque principal (ex: 20000)
  tankInitialStockLiters?: number; // Saldo base atual configurado (ex: 15000)
  tankStockBaseUpdatedAt?: string; // Data e hora da última calibração manual de estoque
  quickAccessUserIds?: string[]; // IDs dos usuários exibidos nos Atalhos de Acesso Rápido na tela de login
}

export interface ReportFilter {
  startDate: string;
  endDate: string;
  equipmentId?: string;
  category?: string;
  sector?: Sector;
  staffId?: string;
  gasStationId?: string;
  fuelType?: FuelType;
  operationType?: OperationType;
  activityType?: ActivityType;
}
