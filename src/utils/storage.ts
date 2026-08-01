import { 
  User, Vehicle, GasStation, FuelLog, MaintenanceLog, SmartAlert, AuditLog, SystemSettings 
} from '../types';
import { 
  INITIAL_USERS, INITIAL_VEHICLES, INITIAL_GAS_STATIONS, 
  INITIAL_FUEL_LOGS, INITIAL_MAINTENANCE_LOGS, INITIAL_ALERTS, 
  INITIAL_AUDIT_LOGS, INITIAL_SETTINGS 
} from '../data/seedData';

const STORAGE_KEYS = {
  USERS: 'andradeagro_users_v1',
  CURRENT_USER: 'andradeagro_current_user_v1',
  VEHICLES: 'andradeagro_vehicles_v1',
  GAS_STATIONS: 'andradeagro_gas_stations_v1',
  FUEL_LOGS: 'andradeagro_fuel_logs_v1',
  MAINTENANCE_LOGS: 'andradeagro_maintenance_logs_v1',
  ALERTS: 'andradeagro_alerts_v1',
  AUDIT_LOGS: 'andradeagro_audit_logs_v1',
  SETTINGS: 'andradeagro_settings_v1',
  THEME: 'andradeagro_theme_v1'
};

function getStored<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (err) {
    console.error(`Error reading ${key} from localStorage:`, err);
    return defaultValue;
  }
}

function setStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event('andradeagro_data_updated'));
  } catch (err) {
    console.error(`Error writing ${key} to localStorage:`, err);
  }
}

// Initializer
export function initStorage() {
  const CLEAN_KEY = 'andradeagro_zero_state_v4';
  if (!localStorage.getItem(CLEAN_KEY)) {
    localStorage.removeItem(STORAGE_KEYS.FUEL_LOGS);
    localStorage.removeItem(STORAGE_KEYS.MAINTENANCE_LOGS);
    localStorage.removeItem(STORAGE_KEYS.ALERTS);
    localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
    localStorage.setItem(CLEAN_KEY, 'true');
  }

  if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
    setStored(STORAGE_KEYS.USERS, INITIAL_USERS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.CURRENT_USER)) {
    setStored(STORAGE_KEYS.CURRENT_USER, INITIAL_USERS[0]); // Default Admin Carlos Andrade
  }
  if (!localStorage.getItem(STORAGE_KEYS.VEHICLES)) {
    setStored(STORAGE_KEYS.VEHICLES, INITIAL_VEHICLES);
  }
  if (!localStorage.getItem(STORAGE_KEYS.GAS_STATIONS)) {
    setStored(STORAGE_KEYS.GAS_STATIONS, INITIAL_GAS_STATIONS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.FUEL_LOGS)) {
    setStored(STORAGE_KEYS.FUEL_LOGS, INITIAL_FUEL_LOGS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.MAINTENANCE_LOGS)) {
    setStored(STORAGE_KEYS.MAINTENANCE_LOGS, INITIAL_MAINTENANCE_LOGS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.ALERTS)) {
    setStored(STORAGE_KEYS.ALERTS, INITIAL_ALERTS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS)) {
    setStored(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
    setStored(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
  }
}

// Getters
export function getUsers(): User[] {
  return getStored(STORAGE_KEYS.USERS, INITIAL_USERS);
}

export function getCurrentUser(): User {
  return getStored(STORAGE_KEYS.CURRENT_USER, INITIAL_USERS[0]);
}

export function setCurrentUser(user: User): void {
  setStored(STORAGE_KEYS.CURRENT_USER, user);
}

export function getVehicles(): Vehicle[] {
  return getStored(STORAGE_KEYS.VEHICLES, INITIAL_VEHICLES);
}

export function getGasStations(): GasStation[] {
  return getStored(STORAGE_KEYS.GAS_STATIONS, INITIAL_GAS_STATIONS);
}

export function getFuelLogs(): FuelLog[] {
  return getStored(STORAGE_KEYS.FUEL_LOGS, INITIAL_FUEL_LOGS);
}

export function getMaintenanceLogs(): MaintenanceLog[] {
  return getStored(STORAGE_KEYS.MAINTENANCE_LOGS, INITIAL_MAINTENANCE_LOGS);
}

export function getAlerts(): SmartAlert[] {
  return getStored(STORAGE_KEYS.ALERTS, INITIAL_ALERTS);
}

export function getAuditLogs(): AuditLog[] {
  return getStored(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
}

export function getSettings(): SystemSettings {
  return getStored(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
}

// Audit Helper
export function logAuditEvent(action: AuditLog['action'], entity: string, details: string) {
  const user = getCurrentUser();
  const logs = getAuditLogs();
  const newLog: AuditLog = {
    id: `aud-${Date.now()}`,
    dateTime: new Date().toISOString(),
    userId: user.id,
    userName: user.name,
    action,
    entity,
    details
  };
  setStored(STORAGE_KEYS.AUDIT_LOGS, [newLog, ...logs]);
}

// Mutators
export function addFuelLog(log: Omit<FuelLog, 'id' | 'createdAt'>): FuelLog {
  const currentLogs = getFuelLogs();
  const newLog: FuelLog = {
    ...log,
    id: `log-${Date.now()}`,
    createdAt: new Date().toISOString()
  };

  // Update Equipment current KM / Hourmeter
  const vehicles = getVehicles();
  const updatedVehicles = vehicles.map(v => {
    if (v.id === log.equipmentId) {
      const isKm = v.category === 'VEICULO';
      const updatedKm = isKm ? Math.max(v.currentKm, log.kmAtFueling || v.currentKm) : v.currentKm;
      const updatedHour = !isKm ? Math.max(v.currentHourmeter || 0, log.hourmeterAtFueling || v.currentHourmeter || 0) : v.currentHourmeter;
      return {
        ...v,
        currentKm: updatedKm,
        currentHourmeter: updatedHour,
        lastFuelingDate: log.dateTime.slice(0, 10)
      };
    }
    return v;
  });
  setStored(STORAGE_KEYS.VEHICLES, updatedVehicles);

  // If flagged suspicious, create automated Alert
  if (log.flaggedSuspicious) {
    const alerts = getAlerts();
    const newAlert: SmartAlert = {
      id: `alt-${Date.now()}`,
      type: 'SUSPICIOUS_FUEL',
      severity: 'ALTA',
      title: 'Consumo Anômalo no Abastecimento',
      description: `${log.equipmentName} (${log.equipmentPlateOrCode}): ${log.suspiciousReason || 'Consumo fora do padrão registrado.'}`,
      equipmentId: log.equipmentId,
      equipmentName: log.equipmentName,
      fuelLogId: newLog.id,
      date: log.dateTime.slice(0, 10),
      resolved: false
    };
    setStored(STORAGE_KEYS.ALERTS, [newAlert, ...alerts]);
  }

  setStored(STORAGE_KEYS.FUEL_LOGS, [newLog, ...currentLogs]);
  logAuditEvent('CRIAR', 'Abastecimento', `Registrou ${newLog.liters}L em ${newLog.equipmentName} (${newLog.equipmentPlateOrCode}).`);
  return newLog;
}

export function updateFuelLog(id: string, updatedFields: Partial<FuelLog>): void {
  const logs = getFuelLogs();
  const updated = logs.map(l => l.id === id ? { ...l, ...updatedFields, updatedAt: new Date().toISOString() } : l);
  setStored(STORAGE_KEYS.FUEL_LOGS, updated);
  logAuditEvent('EDITAR', 'Abastecimento', `Atualizou o registro de abastecimento ID ${id}.`);
}

export function deleteFuelLog(id: string): void {
  const logs = getFuelLogs();
  const filtered = logs.filter(l => l.id !== id);
  setStored(STORAGE_KEYS.FUEL_LOGS, filtered);
  logAuditEvent('EXCLUIR', 'Abastecimento', `Removeu o abastecimento ID ${id}.`);
}

// Vehicle Mutators
export function addVehicle(v: Omit<Vehicle, 'id'>): Vehicle {
  const vehicles = getVehicles();
  const newVehicle: Vehicle = {
    ...v,
    id: `veh-${Date.now()}`
  };
  setStored(STORAGE_KEYS.VEHICLES, [newVehicle, ...vehicles]);
  logAuditEvent('CRIAR', 'Equipamento', `Cadastrou ${newVehicle.model} (${newVehicle.licensePlate || newVehicle.patrimonyCode}).`);
  return newVehicle;
}

export function updateVehicle(id: string, updatedFields: Partial<Vehicle>): void {
  const vehicles = getVehicles();
  const updated = vehicles.map(v => v.id === id ? { ...v, ...updatedFields } : v);
  setStored(STORAGE_KEYS.VEHICLES, updated);
  logAuditEvent('EDITAR', 'Equipamento', `Atualizou equipamento ID ${id}.`);
}

export function deleteVehicle(id: string): void {
  const vehicles = getVehicles();
  setStored(STORAGE_KEYS.VEHICLES, vehicles.filter(v => v.id !== id));
  logAuditEvent('EXCLUIR', 'Equipamento', `Excluiu equipamento ID ${id}.`);
}

// Maintenance Mutators
export function addMaintenance(m: Omit<MaintenanceLog, 'id'>): MaintenanceLog {
  const logs = getMaintenanceLogs();
  const newMnt: MaintenanceLog = {
    ...m,
    id: `mnt-${Date.now()}`
  };
  setStored(STORAGE_KEYS.MAINTENANCE_LOGS, [newMnt, ...logs]);
  logAuditEvent('CRIAR', 'Manutenção', `Agendou/Registrou manutenção "${m.title}" em ${m.equipmentName}.`);
  return newMnt;
}

export function updateMaintenance(id: string, fields: Partial<MaintenanceLog>): void {
  const logs = getMaintenanceLogs();
  setStored(STORAGE_KEYS.MAINTENANCE_LOGS, logs.map(m => m.id === id ? { ...m, ...fields } : m));
  logAuditEvent('EDITAR', 'Manutenção', `Atualizou registro de manutenção ID ${id}.`);
}

// Gas Stations Mutators
export function addGasStation(stn: Omit<GasStation, 'id'>): GasStation {
  const stations = getGasStations();
  const newStn: GasStation = {
    ...stn,
    id: `stn-${Date.now()}`
  };
  setStored(STORAGE_KEYS.GAS_STATIONS, [...stations, newStn]);
  logAuditEvent('CRIAR', 'Posto', `Cadastrou posto ${newStn.name}.`);
  return newStn;
}

export function updateGasStation(id: string, fields: Partial<GasStation>): void {
  const stations = getGasStations();
  setStored(STORAGE_KEYS.GAS_STATIONS, stations.map(s => s.id === id ? { ...s, ...fields } : s));
  logAuditEvent('EDITAR', 'Posto', `Atualizou tabela de preços/dados do posto ID ${id}.`);
}

// User Mutators
export function addUser(user: Omit<User, 'id'>): User {
  const users = getUsers();
  const newUser: User = {
    ...user,
    id: `usr-${Date.now()}`
  };
  setStored(STORAGE_KEYS.USERS, [...users, newUser]);
  logAuditEvent('CRIAR', 'Usuário', `Cadastrou funcionário/usuário ${newUser.name}.`);
  return newUser;
}

export function updateUser(id: string, fields: Partial<User>): void {
  const users = getUsers();
  setStored(STORAGE_KEYS.USERS, users.map(u => u.id === id ? { ...u, ...fields } : u));
  logAuditEvent('EDITAR', 'Usuário', `Atualizou dados do usuário ID ${id}.`);
}

// Alerts Mutator
export function resolveAlert(id: string): void {
  const alerts = getAlerts();
  const currentUser = getCurrentUser();
  const updated = alerts.map(a => a.id === id ? {
    ...a,
    resolved: true,
    resolvedAt: new Date().toISOString(),
    resolvedBy: currentUser.name
  } : a);
  setStored(STORAGE_KEYS.ALERTS, updated);
  logAuditEvent('EDITAR', 'Alerta', `Marcou alerta ID ${id} como resolvido.`);
}

// Settings Mutator
export function updateSettings(newSettings: Partial<SystemSettings>): void {
  const current = getSettings();
  const updated = { ...current, ...newSettings };
  setStored(STORAGE_KEYS.SETTINGS, updated);
  logAuditEvent('CONFIGURACAO', 'Sistema', 'Atualizou as configurações gerais do AndradeAgro.');
}

// Reset data to default seed
export function resetSystemData(): void {
  localStorage.clear();
  initStorage();
  window.dispatchEvent(new Event('andradeagro_data_updated'));
}
