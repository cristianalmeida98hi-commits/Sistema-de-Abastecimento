export type UserRole = 'ADMIN' | 'FUNCIONARIO';

export interface User {
  id: string;
  name: string;
  email: string;
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

export type FuelType = 'DIESEL_S10' | 'DIESEL_S500' | 'GASOLINA_COMUM' | 'GASOLINA_GRID' | 'ETANOL' | 'ARLA_32';

export type Sector = 'AGRICOLA' | 'LOGISTICA' | 'OFICINA_MANUTENCAO' | 'DIRETORIA' | 'COLHEITA' | 'PULVERIZACAO' | 'PREPARO_SOLO';

export type EquipmentCategory = 'VEICULO' | 'TRATOR' | 'MAQUINA_AGRICOLA' | 'IMPLEMENTO';

export type MachineSubtype = 
  | 'PULVERIZADOR' 
  | 'COLHEITADEIRA' 
  | 'ESCAVADEIRA' 
  | 'RETROESCAVADEIRA' 
  | 'PA_CARREGADEIRA' 
  | 'MOTONIVELADORA' 
  | 'IMPLEMENTO';

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
  currentKm: number;
  currentHourmeter?: number;
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

export type OperationType = 'GRAMA' | 'COLHEITA' | 'PLANTIO' | 'TRANSPORTE' | 'OUTROS';

export type ActivityType = 'CORTE' | 'ROCADA' | 'COLETA_PALHA' | 'APLICACAO' | 'OUTROS';

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

export type AlertType = 'SUSPICIOUS_FUEL' | 'MAINTENANCE_DUE' | 'IDLE_VEHICLE' | 'DOCUMENT_EXPIRING' | 'LOW_TANK_LEVEL';

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
