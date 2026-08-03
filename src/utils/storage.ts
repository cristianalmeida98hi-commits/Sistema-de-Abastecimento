import { 
  User, Vehicle, GasStation, FuelLog, MaintenanceLog, SmartAlert, AuditLog, SystemSettings, MachineIssue, PreventiveMaintenanceItem, PreventiveItemKey 
} from '../types';
import { 
  INITIAL_USERS, INITIAL_VEHICLES, INITIAL_GAS_STATIONS, 
  INITIAL_FUEL_LOGS, INITIAL_MAINTENANCE_LOGS, INITIAL_ALERTS, 
  INITIAL_AUDIT_LOGS, INITIAL_SETTINGS, INITIAL_MACHINE_ISSUES, INITIAL_PREVENTIVE_ITEMS 
} from '../data/seedData';

const STORAGE_KEYS = {
  USERS: 'andradeagro_users_v1',
  REMEMBERED_USER: 'andradeagro_remembered_user_v1',
  SESSION_USER: 'andradeagro_session_user_v1',
  VEHICLES: 'andradeagro_vehicles_v1',
  GAS_STATIONS: 'andradeagro_gas_stations_v1',
  FUEL_LOGS: 'andradeagro_fuel_logs_v1',
  MAINTENANCE_LOGS: 'andradeagro_maintenance_logs_v1',
  MACHINE_ISSUES: 'andradeagro_machine_issues_v1',
  PREVENTIVE_ITEMS: 'andradeagro_preventive_items_v1',
  ALERTS: 'andradeagro_alerts_v1',
  AUDIT_LOGS: 'andradeagro_audit_logs_v1',
  SETTINGS: 'andradeagro_settings_v1',
  THEME: 'andradeagro_theme_v1'
};

let syncChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    syncChannel = new BroadcastChannel('andradeagro_realtime_sync');
    syncChannel.onmessage = () => {
      window.dispatchEvent(new Event('andradeagro_data_updated'));
    };
  } catch (e) {
    console.error('BroadcastChannel sync init error:', e);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('andradeagro_')) {
      window.dispatchEvent(new Event('andradeagro_data_updated'));
    }
  });
}

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
    if (syncChannel) {
      syncChannel.postMessage({ key, timestamp: Date.now() });
    }
    // Push update to central cloud database
    fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value })
    }).catch(err => console.error('[AndradeAgro Realtime] Error pushing update to server:', err));
  } catch (err) {
    console.error(`Error writing ${key} to localStorage:`, err);
  }
}

let isSyncing = false;

export async function syncWithServer(): Promise<boolean> {
  if (typeof window === 'undefined' || isSyncing) return false;
  isSyncing = true;
  try {
    const res = await fetch('/api/db');
    if (!res.ok) {
      isSyncing = false;
      return false;
    }
    const { version, data } = await res.json();
    let hasChanges = false;

    if (data && typeof data === 'object') {
      for (const [key, val] of Object.entries(data)) {
        if (typeof key === 'string' && key.startsWith('andradeagro_')) {
          const currentLocal = localStorage.getItem(key);
          const serverValStr = JSON.stringify(val);
          if (currentLocal !== serverValStr) {
            localStorage.setItem(key, serverValStr);
            hasChanges = true;
          }
        }
      }
    }

    // Check if local has keys missing from server and upload them
    const localMissingKeys: Record<string, any> = {};
    for (const keyVal of Object.values(STORAGE_KEYS)) {
      if (data && data[keyVal] === undefined) {
        const item = localStorage.getItem(keyVal);
        if (item) {
          try {
            localMissingKeys[keyVal] = JSON.parse(item);
          } catch (e) {}
        }
      }
    }

    if (Object.keys(localMissingKeys).length > 0) {
      fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullData: localMissingKeys })
      }).catch(e => console.error('[AndradeAgro Sync] Upload missing keys error:', e));
    }

    if (hasChanges) {
      window.dispatchEvent(new Event('andradeagro_data_updated'));
    }
    isSyncing = false;
    return hasChanges;
  } catch (err) {
    isSyncing = false;
    return false;
  }
}

// Background sync loop for real multi-device synchronization
if (typeof window !== 'undefined') {
  setInterval(() => {
    syncWithServer();
  }, 2000);

  window.addEventListener('focus', () => {
    syncWithServer();
  });
  window.addEventListener('online', () => {
    syncWithServer();
  });
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
  if (!localStorage.getItem(STORAGE_KEYS.MACHINE_ISSUES)) {
    setStored(STORAGE_KEYS.MACHINE_ISSUES, INITIAL_MACHINE_ISSUES);
  }
  if (!localStorage.getItem(STORAGE_KEYS.PREVENTIVE_ITEMS)) {
    setStored(STORAGE_KEYS.PREVENTIVE_ITEMS, INITIAL_PREVENTIVE_ITEMS);
  }

  // Trigger immediate initial sync with central database
  syncWithServer();
}

// Getters
export function getUsers(): User[] {
  return getStored(STORAGE_KEYS.USERS, INITIAL_USERS);
}

export function getCurrentUser(): User | null {
  try {
    // Check active session first
    const sessionStr = sessionStorage.getItem(STORAGE_KEYS.SESSION_USER);
    if (sessionStr) {
      return JSON.parse(sessionStr);
    }
    // Then check remembered user in localStorage
    const rememberedStr = localStorage.getItem(STORAGE_KEYS.REMEMBERED_USER);
    if (rememberedStr) {
      return JSON.parse(rememberedStr);
    }
  } catch (err) {
    console.error('Error reading current user session:', err);
  }
  return null;
}

export function loginUser(email: string, password: string, rememberMe: boolean): { success: boolean; user?: User; error?: string } {
  const users = getUsers();
  const targetEmail = email.trim().toLowerCase();
  
  const user = users.find(u => u.email.toLowerCase() === targetEmail);

  if (!user) {
    return { success: false, error: 'E-mail não cadastrado no sistema AndradeAgro.' };
  }

  if (!user.active) {
    return { success: false, error: 'Este usuário está inativo no sistema. Fale com a administração.' };
  }

  const expectedPassword = user.password || '123456';
  if (password !== expectedPassword) {
    return { success: false, error: 'Senha incorreta. Verifique e tente novamente.' };
  }

  try {
    sessionStorage.setItem(STORAGE_KEYS.SESSION_USER, JSON.stringify(user));
    if (rememberMe) {
      localStorage.setItem(STORAGE_KEYS.REMEMBERED_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.REMEMBERED_USER);
    }

    // Add Audit Log
    logAuditEvent('LOGIN', 'Acesso', `Login realizado com sucesso (${user.role === 'ADMIN' ? 'Administrador' : 'Funcionário'})`);

    window.dispatchEvent(new Event('andradeagro_data_updated'));
    return { success: true, user };
  } catch (err) {
    return { success: false, error: 'Erro ao salvar sessão de login.' };
  }
}

export function logoutUser(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.SESSION_USER);
    localStorage.removeItem(STORAGE_KEYS.REMEMBERED_USER);
    window.dispatchEvent(new Event('andradeagro_data_updated'));
  } catch (err) {
    console.error('Error logging out:', err);
  }
}

export function setCurrentUser(user: User): void {
  try {
    sessionStorage.setItem(STORAGE_KEYS.SESSION_USER, JSON.stringify(user));
    window.dispatchEvent(new Event('andradeagro_data_updated'));
  } catch (err) {
    console.error('Error setting current user:', err);
  }
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

export function getMachineIssues(): MachineIssue[] {
  return getStored(STORAGE_KEYS.MACHINE_ISSUES, INITIAL_MACHINE_ISSUES);
}

export function getPreventiveItems(equipmentId?: string): PreventiveMaintenanceItem[] {
  const all = getStored<PreventiveMaintenanceItem[]>(STORAGE_KEYS.PREVENTIVE_ITEMS, INITIAL_PREVENTIVE_ITEMS);
  if (!equipmentId) return all;
  
  // Filter for equipment
  const items = all.filter(item => item.equipmentId === equipmentId);
  if (items.length > 0) return items;

  // Default fallback generator if machine has no preventive items yet
  const defaultKeys: { key: PreventiveItemKey; name: string; interval: number }[] = [
    { key: 'TROCA_OLEO_MOTOR', name: 'Troca de Óleo do Motor', interval: 250 },
    { key: 'FILTRO_OLEO', name: 'Filtro de Óleo Lubrificante', interval: 250 },
    { key: 'FILTRO_COMBUSTIVEL', name: 'Filtro de Combustível / Separador', interval: 500 },
    { key: 'FILTRO_AR', name: 'Filtro de Ar do Motor', interval: 500 },
    { key: 'LUBRIFICACAO', name: 'Lubrificação Geral (Graxa)', interval: 50 },
    { key: 'REVISAO_GERAL', name: 'Revisões Gerais do Equipamento', interval: 1000 },
    { key: 'PNEUS_ESTEIRAS', name: 'Calibragem & Inspeção de Pneus/Esteiras', interval: 100 }
  ];

  const vehicles = getVehicles();
  const target = vehicles.find(v => v.id === equipmentId);
  const curHour = target?.currentHourmeter || 1000;

  const generated: PreventiveMaintenanceItem[] = defaultKeys.map((def, idx) => ({
    id: `prev-${equipmentId}-${idx + 1}`,
    equipmentId,
    itemKey: def.key,
    itemName: def.name,
    lastServiceDate: new Date().toISOString().slice(0, 10),
    lastServiceHourmeter: Math.max(0, curHour - (def.interval / 2)),
    nextScheduledHourmeter: curHour + (def.interval / 2),
    intervalHours: def.interval
  }));

  setStored(STORAGE_KEYS.PREVENTIVE_ITEMS, [...all, ...generated]);
  return generated;
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

export function deleteMaintenance(id: string): void {
  const logs = getMaintenanceLogs();
  setStored(STORAGE_KEYS.MAINTENANCE_LOGS, logs.filter(m => m.id !== id));
  logAuditEvent('EXCLUIR', 'Manutenção', `Excluiu o registro de manutenção ID ${id}.`);
}

// Machine Issue Mutators
export function addMachineIssue(issueData: Omit<MachineIssue, 'id' | 'dateTime' | 'status'>): MachineIssue {
  const current = getMachineIssues();
  const newIssue: MachineIssue = {
    ...issueData,
    id: `iss-${Date.now()}`,
    dateTime: new Date().toISOString(),
    status: 'ABERTO'
  };
  setStored(STORAGE_KEYS.MACHINE_ISSUES, [newIssue, ...current]);

  // Also create smart alert for admins
  const alerts = getAlerts();
  const newAlert: SmartAlert = {
    id: `alt-iss-${Date.now()}`,
    type: 'MACHINE_ISSUE',
    severity: 'ALTA',
    title: `Problema Relatado: ${newIssue.equipmentName}`,
    description: `Operador ${newIssue.reportedByUserName} relatou: "${newIssue.description}"`,
    equipmentId: newIssue.equipmentId,
    equipmentName: newIssue.equipmentName,
    date: newIssue.dateTime.slice(0, 10),
    resolved: false
  };
  setStored(STORAGE_KEYS.ALERTS, [newAlert, ...alerts]);

  logAuditEvent('CRIAR', 'Problema', `Relatou problema em ${newIssue.equipmentName}: ${newIssue.description}`);
  return newIssue;
}

export function resolveMachineIssue(issueId: string, notes?: string): void {
  const current = getMachineIssues();
  const user = getCurrentUser();
  const updated = current.map(iss => {
    if (iss.id === issueId) {
      return {
        ...iss,
        status: 'RESOLVIDO' as const,
        resolvedAt: new Date().toISOString(),
        resolvedBy: user?.name || 'Administrador',
        notes: notes || iss.notes
      };
    }
    return iss;
  });
  setStored(STORAGE_KEYS.MACHINE_ISSUES, updated);
  logAuditEvent('EDITAR', 'Problema', `Resolveu o problema relatado ID ${issueId}`);
}

// Preventive Maintenance Mutators
export function recordPreventiveService(
  equipmentId: string, 
  itemKey: PreventiveItemKey, 
  currentHourmeter: number, 
  notes?: string
): void {
  const all = getPreventiveItems();
  const target = all.find(item => item.equipmentId === equipmentId && item.itemKey === itemKey);
  
  if (target) {
    const updatedItem: PreventiveMaintenanceItem = {
      ...target,
      lastServiceDate: new Date().toISOString().slice(0, 10),
      lastServiceHourmeter: currentHourmeter,
      nextScheduledHourmeter: currentHourmeter + target.intervalHours,
      notes: notes || target.notes
    };
    const updatedList = all.map(item => item.id === target.id ? updatedItem : item);
    setStored(STORAGE_KEYS.PREVENTIVE_ITEMS, updatedList);

    // Create a maintenance log entry
    addMaintenance({
      equipmentId,
      equipmentName: target.itemName,
      equipmentPlateOrCode: equipmentId,
      date: new Date().toISOString().slice(0, 10),
      type: 'TROCA_OLEO',
      title: `Manutenção Preventiva: ${target.itemName}`,
      description: `Serviço realizado no horímetro ${currentHourmeter}h. Próxima com +${target.intervalHours}h.`,
      kmOrHourAtService: currentHourmeter,
      nextServiceKmOrHour: currentHourmeter + target.intervalHours,
      cost: 0,
      supplierOrWorkshop: 'Oficina Interna AndradeAgro',
      performedBy: getCurrentUser()?.name || 'Oficina',
      status: 'CONCLUIDO',
      notes
    });

    logAuditEvent('CRIAR', 'Manutenção Preventiva', `Registrou ${target.itemName} no horímetro ${currentHourmeter}h.`);
  }
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

export function deleteGasStation(id: string): void {
  const stations = getGasStations();
  setStored(STORAGE_KEYS.GAS_STATIONS, stations.filter(s => s.id !== id));
  logAuditEvent('EXCLUIR', 'Posto', `Excluiu o posto ID ${id}.`);
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

export function deleteUser(id: string): void {
  const users = getUsers();
  setStored(STORAGE_KEYS.USERS, users.filter(u => u.id !== id));
  logAuditEvent('EXCLUIR', 'Usuário', `Excluiu o usuário ID ${id}.`);
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
