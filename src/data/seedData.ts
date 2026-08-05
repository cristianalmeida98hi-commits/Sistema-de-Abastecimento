import { User, Vehicle, GasStation, FuelLog, MaintenanceLog, SmartAlert, AuditLog, SystemSettings, MachineIssue, PreventiveMaintenanceItem } from '../types';

export const INITIAL_USERS: User[] = [
  {
    id: 'usr-001',
    name: 'Carlos Eduardo Andrade',
    email: 'admin@andradeagro.com.br',
    password: '123456',
    role: 'ADMIN',
    department: 'Diretoria Executiva',
    phone: '(66) 99988-1234',
    cpf: '123.456.789-00',
    cnh: '01234567890',
    cnhCategory: 'AE',
    cnhExpiration: '2028-11-15',
    active: true,
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr-002',
    name: 'Patrícia Lima',
    email: 'patricia.gestao@andradeagro.com.br',
    password: '123456',
    role: 'ADMIN',
    department: 'Gestão de Frotas',
    phone: '(66) 99877-4321',
    cpf: '234.567.890-11',
    cnh: '09876543210',
    cnhCategory: 'B',
    cnhExpiration: '2027-05-20',
    active: true,
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr-003',
    name: 'João Silva',
    email: 'joao.silva@andradeagro.com.br',
    password: '123456',
    role: 'FUNCIONARIO',
    department: 'Agrícola',
    phone: '(66) 99655-8822',
    cpf: '345.678.901-22',
    cnh: '04561237890',
    cnhCategory: 'D',
    cnhExpiration: '2026-10-30',
    active: true,
    avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr-004',
    name: 'Marcos Oliveira',
    email: 'marcos.operador@andradeagro.com.br',
    password: '123456',
    role: 'FUNCIONARIO',
    department: 'Colheita',
    phone: '(66) 99711-3344',
    cpf: '456.789.012-33',
    cnh: '08901234567',
    cnhCategory: 'C',
    cnhExpiration: '2029-02-14',
    active: true,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr-005',
    name: 'Roberto Santos',
    email: 'roberto.frentista@andradeagro.com.br',
    password: '123456',
    role: 'FUNCIONARIO',
    department: 'Oficina / Posto Interno',
    phone: '(66) 99822-6677',
    cpf: '567.890.123-44',
    cnh: '01122334455',
    cnhCategory: 'B',
    cnhExpiration: '2028-08-01',
    active: true,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'
  }
];

export const INITIAL_VEHICLES: Vehicle[] = [
  {
    id: 'veh-001',
    category: 'VEICULO',
    licensePlate: 'QAA-8J90',
    model: 'Hilux SRX 4x4 2.8 Turbo',
    manufacturer: 'Toyota',
    year: 2024,
    color: 'Branco Polar',
    sector: 'DIRETORIA',
    fuelType: 'DIESEL_S10',
    tankCapacityLiters: 80,
    currentKm: 42350,
    status: 'ATIVO',
    assignedOperatorId: 'usr-001',
    assignedOperatorName: 'Carlos Eduardo Andrade',
    photoUrl: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=600&auto=format&fit=crop&q=80',
    lastFuelingDate: '2026-07-31',
    nextRevisionKmOrHour: 50000,
    documentsExpiration: '2026-11-20',
    notes: 'Veículo de uso da diretoria e visitas técnicas às fazendas.'
  },
  {
    id: 'veh-002',
    category: 'VEICULO',
    licensePlate: 'RST-4F12',
    model: 'Strada Freedom 1.3 Flex',
    manufacturer: 'Fiat',
    year: 2023,
    color: 'Prata',
    sector: 'AGRICOLA',
    fuelType: 'ETANOL',
    tankCapacityLiters: 55,
    currentKm: 68100,
    status: 'ATIVO',
    assignedOperatorId: 'usr-003',
    assignedOperatorName: 'João Silva',
    photoUrl: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=600&auto=format&fit=crop&q=80',
    lastFuelingDate: '2026-08-01',
    nextRevisionKmOrHour: 70000,
    documentsExpiration: '2026-09-15',
    notes: 'Uso no manejo de lavoura e fiscalização de talhões.'
  },
  {
    id: 'veh-003',
    category: 'VEICULO',
    licensePlate: 'MTO-2299',
    model: 'Axor 3131 6x4 Basculante',
    manufacturer: 'Mercedes-Benz',
    year: 2022,
    color: 'Verde Agrícola',
    sector: 'LOGISTICA',
    fuelType: 'DIESEL_S10',
    tankCapacityLiters: 500,
    currentKm: 124800,
    status: 'ATIVO',
    assignedOperatorId: 'usr-003',
    assignedOperatorName: 'João Silva',
    photoUrl: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=600&auto=format&fit=crop&q=80',
    lastFuelingDate: '2026-07-30',
    nextRevisionKmOrHour: 130000,
    documentsExpiration: '2026-12-10',
    notes: 'Transporte de grãos da lavoura para o armazém central.'
  },
  {
    id: 'veh-004',
    category: 'TRATOR',
    licensePlate: 'AGRO-JD8370',
    patrimonyCode: 'TRAT-001',
    model: '8370R 370CV Heavy Duty',
    manufacturer: 'John Deere',
    year: 2023,
    color: 'Verde John Deere',
    sector: 'PREPARO_SOLO',
    fuelType: 'DIESEL_S10',
    tankCapacityLiters: 680,
    currentKm: 0,
    currentHourmeter: 3420,
    status: 'ATIVO',
    assignedOperatorId: 'usr-004',
    assignedOperatorName: 'Marcos Oliveira',
    photoUrl: 'https://images.unsplash.com/photo-1592861956120-e524fc739696?w=600&auto=format&fit=crop&q=80',
    lastFuelingDate: '2026-08-01',
    nextRevisionKmOrHour: 3500,
    documentsExpiration: '2027-01-01',
    notes: 'Trator principal de preparo de solo e subsolagem pesada.'
  },
  {
    id: 'veh-005',
    category: 'TRATOR',
    licensePlate: 'AGRO-CASE340',
    patrimonyCode: 'TRAT-002',
    model: 'Magnum 340 AFS Connect',
    manufacturer: 'Case IH',
    year: 2022,
    color: 'Vermelho Case',
    sector: 'PREPARO_SOLO',
    fuelType: 'DIESEL_S500',
    tankCapacityLiters: 635,
    currentKm: 0,
    currentHourmeter: 4890,
    status: 'ATIVO',
    assignedOperatorId: 'usr-004',
    assignedOperatorName: 'Marcos Oliveira',
    photoUrl: 'https://images.unsplash.com/photo-1589758438368-0ad531db3366?w=600&auto=format&fit=crop&q=80',
    lastFuelingDate: '2026-07-29',
    nextRevisionKmOrHour: 5000,
    notes: 'Operação de gradagem e plantio direto.'
  },
  {
    id: 'veh-006',
    category: 'MAQUINA_AGRICOLA',
    licensePlate: 'AGRO-JD-S790',
    patrimonyCode: 'MAQ-001',
    machineSubtype: 'COLHEITADEIRA',
    model: 'S790 Axial-Flow com Plataforma 45 pés',
    manufacturer: 'John Deere',
    year: 2023,
    color: 'Verde / Amarelo',
    sector: 'COLHEITA',
    fuelType: 'DIESEL_S10',
    tankCapacityLiters: 1250,
    currentKm: 0,
    currentHourmeter: 2150,
    status: 'ATIVO',
    assignedOperatorId: 'usr-004',
    assignedOperatorName: 'Marcos Oliveira',
    photoUrl: 'https://images.unsplash.com/photo-1595246140625-573b715d11dc?w=600&auto=format&fit=crop&q=80',
    lastFuelingDate: '2026-07-31',
    nextRevisionKmOrHour: 2200,
    notes: 'Colheitadeira de alta produtividade para soja e milho.'
  },
  {
    id: 'veh-007',
    category: 'MAQUINA_AGRICOLA',
    licensePlate: 'AGRO-IMP4000',
    patrimonyCode: 'MAQ-002',
    machineSubtype: 'PULVERIZADOR',
    model: 'Imperador 4000 Autopropelido 36m',
    manufacturer: 'Stara',
    year: 2024,
    color: 'Laranja Stara',
    sector: 'PULVERIZACAO',
    fuelType: 'DIESEL_S10',
    tankCapacityLiters: 400,
    currentKm: 0,
    currentHourmeter: 1180,
    status: 'ATIVO',
    assignedOperatorId: 'usr-003',
    assignedOperatorName: 'João Silva',
    photoUrl: 'https://images.unsplash.com/photo-1530267981600-70f443b74305?w=600&auto=format&fit=crop&q=80',
    lastFuelingDate: '2026-08-01',
    nextRevisionKmOrHour: 1250,
    notes: 'Pulverização de defensivos com sistema barra dupla.'
  },
  {
    id: 'veh-008',
    category: 'MAQUINA_AGRICOLA',
    licensePlate: 'AGRO-CAT320',
    patrimonyCode: 'MAQ-003',
    machineSubtype: 'ESCAVADEIRA',
    model: '320 Next Gen Hydraulics',
    manufacturer: 'Caterpillar',
    year: 2021,
    color: 'Amarelo CAT',
    sector: 'OFICINA_MANUTENCAO',
    fuelType: 'DIESEL_S500',
    tankCapacityLiters: 345,
    currentKm: 0,
    currentHourmeter: 6120,
    status: 'EM_MANUTENCAO',
    assignedOperatorId: 'usr-005',
    assignedOperatorName: 'Roberto Santos',
    photoUrl: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=600&auto=format&fit=crop&q=80',
    lastFuelingDate: '2026-07-25',
    nextRevisionKmOrHour: 6200,
    notes: 'Abertura de curvas de nível e drenagem de talhões.'
  },
  {
    id: 'veh-009',
    category: 'IMPLEMENTO',
    licensePlate: 'AGRO-IMP-32',
    patrimonyCode: 'IMP-001',
    machineSubtype: 'IMPLEMENTO',
    model: 'Grade Aradora Controle Remoto 32 Discos',
    manufacturer: 'Tatu Marchesan',
    year: 2023,
    color: 'Vermelho / Preto',
    sector: 'PREPARO_SOLO',
    fuelType: 'NENHUM',
    tankCapacityLiters: 0,
    currentKm: 0,
    currentHourmeter: 850,
    status: 'ATIVO',
    assignedOperatorId: 'usr-004',
    assignedOperatorName: 'Marcos Oliveira',
    photoUrl: 'https://images.unsplash.com/photo-1592861956120-e524fc739696?w=600&auto=format&fit=crop&q=80',
    nextRevisionKmOrHour: 1000,
    notes: 'Implemento agrícola rebocado sem motor/combustível próprio.'
  }
];

export const INITIAL_GAS_STATIONS: GasStation[] = [
  {
    id: 'stn-001',
    name: 'Posto Interno Fazenda Andrade (Sede)',
    type: 'INTERNO',
    supplierName: 'BR Distribuidora - Vibra',
    cnpj: '01.234.567/0001-89',
    location: 'Fazenda Andrade - Sede (Sorriso/MT)',
    pricePerLiter: {
      DIESEL_S10: 5.79,
      DIESEL_S500: 5.59,
      GASOLINA_COMUM: 5.99,
      GASOLINA_GRID: 6.29,
      ETANOL: 3.89,
      ARLA_32: 2.50,
      NENHUM: 0
    },
    active: true
  },
  {
    id: 'stn-002',
    name: 'Posto Shell BR-163 Km 740',
    type: 'EXTERNO',
    supplierName: 'Posto Shell Rota do Oeste',
    cnpj: '12.345.678/0001-90',
    location: 'BR-163, Sorriso - MT',
    pricePerLiter: {
      DIESEL_S10: 6.09,
      DIESEL_S500: 5.89,
      GASOLINA_COMUM: 6.25,
      GASOLINA_GRID: 6.55,
      ETANOL: 4.19,
      ARLA_32: 2.90,
      NENHUM: 0
    },
    active: true
  },
  {
    id: 'stn-003',
    name: 'Posto Ipiranga Ouro Verde',
    type: 'EXTERNO',
    supplierName: 'Ipiranga Produtos de Petróleo',
    cnpj: '23.456.789/0001-01',
    location: 'Av. Brasil, Lucas do Rio Verde - MT',
    pricePerLiter: {
      DIESEL_S10: 6.15,
      DIESEL_S500: 5.95,
      GASOLINA_COMUM: 6.30,
      GASOLINA_GRID: 6.60,
      ETANOL: 4.25,
      ARLA_32: 3.00,
      NENHUM: 0
    },
    active: true
  }
];

export const INITIAL_FUEL_LOGS: FuelLog[] = [];

export const INITIAL_MAINTENANCE_LOGS: MaintenanceLog[] = [];

export const INITIAL_ALERTS: SmartAlert[] = [];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'aud-001',
    dateTime: new Date().toISOString(),
    userId: 'usr-001',
    userName: 'Carlos Eduardo Andrade',
    action: 'CRIAR',
    entity: 'Empresa',
    details: 'Inicialização do sistema de gestão para nova empresa. Histórico de gastos zerado para simulação de abastecimentos.'
  }
];

export const INITIAL_SETTINGS: SystemSettings = {
  companyName: 'AndradeAgro',
  slogan: 'Tecnologia para gestão inteligente do agronegócio.',
  cnpj: '04.582.910/0001-42',
  address: 'Rodovia BR-163, Km 745, Sorriso - MT, CEP 78890-000',
  phone: '(66) 3545-9000',
  contactEmail: 'suporte@andradeagro.com.br',
  employeeEditTimeLimitHours: 24,
  suspiciousFuelMarginPercentage: 25,
  autoAlertsEnabled: true,
  themeMode: 'LIGHT'
};

export const INITIAL_MACHINE_ISSUES: MachineIssue[] = [
  {
    id: 'iss-001',
    equipmentId: 'veh-002',
    equipmentName: 'John Deere 7230J',
    equipmentPlateOrCode: 'PAT-TR-002',
    reportedByUserId: 'usr-003',
    reportedByUserName: 'João Silva',
    description: 'Vazamento leve de óleo hidráulico no engate rápido traseiro do comando.',
    dateTime: '2026-07-30T10:15:00.000Z',
    status: 'ABERTO',
    photoUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80'
  }
];

export const INITIAL_PREVENTIVE_ITEMS: PreventiveMaintenanceItem[] = [
  // veh-002: John Deere 7230J (Horímetro 1840)
  {
    id: 'prev-002-1',
    equipmentId: 'veh-002',
    itemKey: 'TROCA_OLEO_MOTOR',
    itemName: 'Troca de Óleo do Motor',
    lastServiceDate: '2026-06-15',
    lastServiceHourmeter: 1600,
    nextScheduledHourmeter: 1850, // 10h restantes -> Amarelo
    intervalHours: 250
  },
  {
    id: 'prev-002-2',
    equipmentId: 'veh-002',
    itemKey: 'FILTRO_OLEO',
    itemName: 'Filtro de Óleo Lubrificante',
    lastServiceDate: '2026-06-15',
    lastServiceHourmeter: 1600,
    nextScheduledHourmeter: 1850,
    intervalHours: 250
  },
  {
    id: 'prev-002-3',
    equipmentId: 'veh-002',
    itemKey: 'FILTRO_COMBUSTIVEL',
    itemName: 'Filtro de Combustível / Separador',
    lastServiceDate: '2026-05-10',
    lastServiceHourmeter: 1400,
    nextScheduledHourmeter: 1900,
    intervalHours: 500
  },
  {
    id: 'prev-002-4',
    equipmentId: 'veh-002',
    itemKey: 'FILTRO_AR',
    itemName: 'Filtro de Ar do Motor',
    lastServiceDate: '2026-06-01',
    lastServiceHourmeter: 1500,
    nextScheduledHourmeter: 2000,
    intervalHours: 500
  },
  {
    id: 'prev-002-5',
    equipmentId: 'veh-002',
    itemKey: 'LUBRIFICACAO',
    itemName: 'Lubrificação Geral (Graxa)',
    lastServiceDate: '2026-07-25',
    lastServiceHourmeter: 1800,
    nextScheduledHourmeter: 1850,
    intervalHours: 50
  },
  {
    id: 'prev-002-6',
    equipmentId: 'veh-002',
    itemKey: 'REVISAO_GERAL',
    itemName: 'Revisões Gerais do Trator',
    lastServiceDate: '2026-03-10',
    lastServiceHourmeter: 1000,
    nextScheduledHourmeter: 2000,
    intervalHours: 1000
  },
  {
    id: 'prev-002-7',
    equipmentId: 'veh-002',
    itemKey: 'PNEUS_ESTEIRAS',
    itemName: 'Calibragem & Inspeção de Pneus/Esteiras',
    lastServiceDate: '2026-07-20',
    lastServiceHourmeter: 1780,
    nextScheduledHourmeter: 1880,
    intervalHours: 100
  },

  // veh-003: Colheitadeira Case 8250 (Horímetro 950)
  {
    id: 'prev-003-1',
    equipmentId: 'veh-003',
    itemKey: 'TROCA_OLEO_MOTOR',
    itemName: 'Troca de Óleo do Motor',
    lastServiceDate: '2026-07-01',
    lastServiceHourmeter: 700,
    nextScheduledHourmeter: 950, // 0h restantes -> Vermelho (Atrasado/Exato)
    intervalHours: 250
  },
  {
    id: 'prev-003-2',
    equipmentId: 'veh-003',
    itemKey: 'FILTRO_OLEO',
    itemName: 'Filtro de Óleo Lubrificante',
    lastServiceDate: '2026-07-01',
    lastServiceHourmeter: 700,
    nextScheduledHourmeter: 950,
    intervalHours: 250
  },
  {
    id: 'prev-003-3',
    equipmentId: 'veh-003',
    itemKey: 'FILTRO_COMBUSTIVEL',
    itemName: 'Filtro de Combustível / Separador',
    lastServiceDate: '2026-04-10',
    lastServiceHourmeter: 500,
    nextScheduledHourmeter: 1000,
    intervalHours: 500
  },
  {
    id: 'prev-003-4',
    equipmentId: 'veh-003',
    itemKey: 'FILTRO_AR',
    itemName: 'Filtro de Ar do Motor',
    lastServiceDate: '2026-06-10',
    lastServiceHourmeter: 650,
    nextScheduledHourmeter: 1150,
    intervalHours: 500
  },
  {
    id: 'prev-003-5',
    equipmentId: 'veh-003',
    itemKey: 'LUBRIFICACAO',
    itemName: 'Lubrificação Geral (Graxa)',
    lastServiceDate: '2026-07-28',
    lastServiceHourmeter: 920,
    nextScheduledHourmeter: 970,
    intervalHours: 50
  },
  {
    id: 'prev-003-6',
    equipmentId: 'veh-003',
    itemKey: 'REVISAO_GERAL',
    itemName: 'Revisões Gerais da Colheitadeira',
    lastServiceDate: '2026-01-15',
    lastServiceHourmeter: 400,
    nextScheduledHourmeter: 1400,
    intervalHours: 1000
  },
  {
    id: 'prev-003-7',
    equipmentId: 'veh-003',
    itemKey: 'PNEUS_ESTEIRAS',
    itemName: 'Calibragem & Inspeção de Pneus/Esteiras',
    lastServiceDate: '2026-07-15',
    lastServiceHourmeter: 880,
    nextScheduledHourmeter: 980,
    intervalHours: 100
  }
];
