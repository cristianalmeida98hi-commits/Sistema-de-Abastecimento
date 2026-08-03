import { 
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, writeBatch 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  User, Vehicle, GasStation, FuelLog, MaintenanceLog, SmartAlert, AuditLog, SystemSettings, MachineIssue, PreventiveMaintenanceItem, PreventiveItemKey 
} from '../types';
import { 
  INITIAL_USERS, INITIAL_VEHICLES, INITIAL_GAS_STATIONS, 
  INITIAL_FUEL_LOGS, INITIAL_MAINTENANCE_LOGS, INITIAL_ALERTS, 
  INITIAL_AUDIT_LOGS, INITIAL_SETTINGS, INITIAL_MACHINE_ISSUES, INITIAL_PREVENTIVE_ITEMS 
} from '../data/seedData';

const SESSION_KEYS = {
  REMEMBERED_USER: 'andradeagro_remembered_user_v1',
  SESSION_USER: 'andradeagro_session_user_v1'
};

// Helper to remove any undefined fields before saving to Firestore (Firestore rejects undefined)
export function cleanUndefined<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  const cleaned: any = Array.isArray(obj) ? [] : {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
        cleaned[key] = cleanUndefined(val);
      } else {
        cleaned[key] = val;
      }
    }
  }
  return cleaned as T;
}

// In-Memory Live Cache synced directly with Firestore in real-time
let cache = {
  users: INITIAL_USERS as User[],
  vehicles: INITIAL_VEHICLES as Vehicle[],
  gasStations: INITIAL_GAS_STATIONS as GasStation[],
  fuelLogs: INITIAL_FUEL_LOGS as FuelLog[],
  maintenanceLogs: INITIAL_MAINTENANCE_LOGS as MaintenanceLog[],
  machineIssues: INITIAL_MACHINE_ISSUES as MachineIssue[],
  preventiveItems: INITIAL_PREVENTIVE_ITEMS as PreventiveMaintenanceItem[],
  alerts: INITIAL_ALERTS as SmartAlert[],
  auditLogs: INITIAL_AUDIT_LOGS as AuditLog[],
  settings: INITIAL_SETTINGS as SystemSettings
};

let isInitialized = false;

// Initialize Firebase Firestore Real-Time Listeners
export function initStorage() {
  if (isInitialized && typeof window !== 'undefined') return;
  isInitialized = true;

  try {
    // 1. Users Subscription
    onSnapshot(collection(db, 'users'), (snapshot) => {
      if (snapshot.empty) {
        seedCollection('users', INITIAL_USERS);
      } else {
        const items = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        cache.users = items;
        notifyDataUpdated();
      }
    }, (err) => console.error('[Firestore Users Error]', err));

    // 2. Vehicles / Machines Subscription
    onSnapshot(collection(db, 'vehicles'), (snapshot) => {
      if (snapshot.empty) {
        seedCollection('vehicles', INITIAL_VEHICLES);
      } else {
        const items = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Vehicle));
        cache.vehicles = items;
        notifyDataUpdated();
      }
    }, (err) => console.error('[Firestore Vehicles Error]', err));

    // 3. Gas Stations Subscription
    onSnapshot(collection(db, 'gas_stations'), (snapshot) => {
      if (snapshot.empty) {
        seedCollection('gas_stations', INITIAL_GAS_STATIONS);
      } else {
        const items = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as GasStation));
        cache.gasStations = items;
        notifyDataUpdated();
      }
    }, (err) => console.error('[Firestore GasStations Error]', err));

    // 4. Fuel Logs Subscription
    onSnapshot(collection(db, 'fuel_logs'), (snapshot) => {
      if (snapshot.empty) {
        seedCollection('fuel_logs', INITIAL_FUEL_LOGS);
      } else {
        const items = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as FuelLog));
        items.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
        cache.fuelLogs = items;
        notifyDataUpdated();
      }
    }, (err) => console.error('[Firestore FuelLogs Error]', err));

    // 5. Maintenance Logs Subscription
    onSnapshot(collection(db, 'maintenance_logs'), (snapshot) => {
      if (snapshot.empty) {
        seedCollection('maintenance_logs', INITIAL_MAINTENANCE_LOGS);
      } else {
        const items = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as MaintenanceLog));
        items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        cache.maintenanceLogs = items;
        notifyDataUpdated();
      }
    }, (err) => console.error('[Firestore MaintenanceLogs Error]', err));

    // 6. Machine Issues Subscription
    onSnapshot(collection(db, 'machine_issues'), (snapshot) => {
      if (snapshot.empty) {
        seedCollection('machine_issues', INITIAL_MACHINE_ISSUES);
      } else {
        const items = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as MachineIssue));
        items.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
        cache.machineIssues = items;
        notifyDataUpdated();
      }
    }, (err) => console.error('[Firestore Issues Error]', err));

    // 7. Preventive Items Subscription
    onSnapshot(collection(db, 'preventive_items'), (snapshot) => {
      if (snapshot.empty) {
        seedCollection('preventive_items', INITIAL_PREVENTIVE_ITEMS);
      } else {
        const items = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as PreventiveMaintenanceItem));
        cache.preventiveItems = items;
        notifyDataUpdated();
      }
    }, (err) => console.error('[Firestore Preventive Error]', err));

    // 8. Alerts Subscription
    onSnapshot(collection(db, 'alerts'), (snapshot) => {
      if (snapshot.empty) {
        seedCollection('alerts', INITIAL_ALERTS);
      } else {
        const items = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as SmartAlert));
        items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        cache.alerts = items;
        notifyDataUpdated();
      }
    }, (err) => console.error('[Firestore Alerts Error]', err));

    // 9. Audit Logs Subscription
    onSnapshot(collection(db, 'audit_logs'), (snapshot) => {
      if (snapshot.empty) {
        seedCollection('audit_logs', INITIAL_AUDIT_LOGS);
      } else {
        const items = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AuditLog));
        items.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
        cache.auditLogs = items;
        notifyDataUpdated();
      }
    }, (err) => console.error('[Firestore AuditLogs Error]', err));

    // 10. System Settings Subscription
    onSnapshot(collection(db, 'settings'), (snapshot) => {
      if (snapshot.empty) {
        setDoc(doc(db, 'settings', 'config'), cleanUndefined(INITIAL_SETTINGS)).catch(console.error);
      } else {
        const configDoc = snapshot.docs.find(d => d.id === 'config') || snapshot.docs[0];
        if (configDoc) {
          cache.settings = configDoc.data() as SystemSettings;
          notifyDataUpdated();
        }
      }
    }, (err) => console.error('[Firestore Settings Error]', err));

  } catch (err) {
    console.error('[Firestore init error]', err);
  }
}

function notifyDataUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('andradeagro_data_updated'));
  }
}

async function seedCollection(colName: string, items: any[]) {
  try {
    const batch = writeBatch(db);
    for (const item of items) {
      if (item.id) {
        batch.set(doc(db, colName, String(item.id)), cleanUndefined(item));
      }
    }
    await batch.commit();
  } catch (e) {
    console.error(`[Firestore Seed Error for ${colName}]`, e);
  }
}

// Getters - All reading from real-time Firebase cache
export function getUsers(): User[] {
  return cache.users;
}

export function getCurrentUser(): User | null {
  try {
    if (typeof window === 'undefined') return null;
    const sessionStr = sessionStorage.getItem(SESSION_KEYS.SESSION_USER);
    if (sessionStr) {
      return JSON.parse(sessionStr);
    }
    const rememberedStr = localStorage.getItem(SESSION_KEYS.REMEMBERED_USER);
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
    sessionStorage.setItem(SESSION_KEYS.SESSION_USER, JSON.stringify(user));
    if (rememberMe) {
      localStorage.setItem(SESSION_KEYS.REMEMBERED_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_KEYS.REMEMBERED_USER);
    }

    logAuditEvent('LOGIN', 'Acesso', `Login realizado com sucesso (${user.role === 'ADMIN' ? 'Administrador' : 'Funcionário'})`);

    notifyDataUpdated();
    return { success: true, user };
  } catch (err) {
    return { success: false, error: 'Erro ao salvar sessão de login.' };
  }
}

export function logoutUser(): void {
  try {
    sessionStorage.removeItem(SESSION_KEYS.SESSION_USER);
    localStorage.removeItem(SESSION_KEYS.REMEMBERED_USER);
    notifyDataUpdated();
  } catch (err) {
    console.error('Error logging out:', err);
  }
}

export function setCurrentUser(user: User | null): void {
  try {
    if (user) {
      sessionStorage.setItem(SESSION_KEYS.SESSION_USER, JSON.stringify(user));
    } else {
      sessionStorage.removeItem(SESSION_KEYS.SESSION_USER);
      localStorage.removeItem(SESSION_KEYS.REMEMBERED_USER);
    }
    notifyDataUpdated();
  } catch (err) {
    console.error('Error setting current user:', err);
  }
}

export function getVehicles(): Vehicle[] {
  return cache.vehicles;
}

export function getGasStations(): GasStation[] {
  return cache.gasStations;
}

export function getFuelLogs(): FuelLog[] {
  return cache.fuelLogs;
}

export function getMaintenanceLogs(): MaintenanceLog[] {
  return cache.maintenanceLogs;
}

export function getAlerts(): SmartAlert[] {
  return cache.alerts;
}

export function getAuditLogs(): AuditLog[] {
  return cache.auditLogs;
}

export function getSettings(): SystemSettings {
  return cache.settings;
}

export function getMachineIssues(): MachineIssue[] {
  return cache.machineIssues;
}

export function getPreventiveItems(equipmentId?: string): PreventiveMaintenanceItem[] {
  const all = cache.preventiveItems;
  if (!equipmentId) return all;
  
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

  // Save generated directly to Firestore
  generated.forEach(item => {
    setDoc(doc(db, 'preventive_items', item.id), cleanUndefined(item)).catch(console.error);
  });

  return generated;
}

// Audit Helper
export function logAuditEvent(action: AuditLog['action'], entity: string, details: string) {
  const user = getCurrentUser();
  const newLog: AuditLog = {
    id: `aud-${Date.now()}`,
    dateTime: new Date().toISOString(),
    userId: user?.id || 'sys',
    userName: user?.name || 'Sistema',
    action,
    entity,
    details
  };
  setDoc(doc(db, 'audit_logs', newLog.id), cleanUndefined(newLog)).catch(console.error);
}

// Mutators - All updating Firebase Firestore directly
export async function addFuelLog(log: Omit<FuelLog, 'id' | 'createdAt'>): Promise<FuelLog> {
  const newLog: FuelLog = {
    ...log,
    id: `log-${Date.now()}`,
    createdAt: new Date().toISOString()
  };

  const cleanedLog = cleanUndefined(newLog);

  // Optimistically update local memory cache
  cache.fuelLogs = [cleanedLog, ...cache.fuelLogs.filter(l => l.id !== cleanedLog.id)];
  notifyDataUpdated();

  try {
    // Write fuel log to Firestore
    await setDoc(doc(db, 'fuel_logs', cleanedLog.id), cleanedLog);

    // Update Equipment current KM / Hourmeter in Firestore
    const vehicles = getVehicles();
    const targetVehicle = vehicles.find(v => v.id === log.equipmentId);
    if (targetVehicle) {
      const isKm = targetVehicle.category === 'VEICULO';
      const updatedKm = isKm ? Math.max(targetVehicle.currentKm || 0, log.kmAtFueling || targetVehicle.currentKm || 0) : targetVehicle.currentKm;
      const updatedHour = !isKm ? Math.max(targetVehicle.currentHourmeter || 0, log.hourmeterAtFueling || targetVehicle.currentHourmeter || 0) : targetVehicle.currentHourmeter;
      
      const vehicleUpdates = cleanUndefined({
        currentKm: updatedKm,
        currentHourmeter: updatedHour,
        lastFuelingDate: log.dateTime.slice(0, 10)
      });

      // Update in local memory cache
      const updatedVehicleObj = { ...targetVehicle, ...vehicleUpdates };
      cache.vehicles = cache.vehicles.map(v => v.id === targetVehicle.id ? updatedVehicleObj : v);

      await updateDoc(doc(db, 'vehicles', targetVehicle.id), vehicleUpdates);
    }

    // If flagged suspicious, create automated Alert in Firestore
    if (log.flaggedSuspicious) {
      const newAlert: SmartAlert = cleanUndefined({
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
      });
      cache.alerts = [newAlert, ...cache.alerts];
      await setDoc(doc(db, 'alerts', newAlert.id), newAlert);
    }

    logAuditEvent('CRIAR', 'Abastecimento', `Registrou ${newLog.liters}L em ${newLog.equipmentName} (${newLog.equipmentPlateOrCode}).`);
    notifyDataUpdated();
    return cleanedLog;
  } catch (err) {
    console.error('[addFuelLog Firestore Error]', err);
    throw err;
  }
}

export async function updateFuelLog(id: string, updatedFields: Partial<FuelLog>): Promise<void> {
  const cleaned = cleanUndefined({
    ...updatedFields,
    updatedAt: new Date().toISOString()
  });

  cache.fuelLogs = cache.fuelLogs.map(l => l.id === id ? { ...l, ...cleaned } : l);
  notifyDataUpdated();

  await updateDoc(doc(db, 'fuel_logs', id), cleaned);
  logAuditEvent('EDITAR', 'Abastecimento', `Atualizou o registro de abastecimento ID ${id}.`);
}

export async function deleteFuelLog(id: string): Promise<void> {
  cache.fuelLogs = cache.fuelLogs.filter(l => l.id !== id);
  notifyDataUpdated();

  await deleteDoc(doc(db, 'fuel_logs', id));
  logAuditEvent('EXCLUIR', 'Abastecimento', `Removeu o abastecimento ID ${id}.`);
}

// Vehicle / Machine Mutators
export async function addVehicle(v: Omit<Vehicle, 'id'>): Promise<Vehicle> {
  const newVehicle: Vehicle = {
    ...v,
    id: `veh-${Date.now()}`
  };
  const cleaned = cleanUndefined(newVehicle);
  cache.vehicles = [...cache.vehicles, cleaned];
  notifyDataUpdated();

  await setDoc(doc(db, 'vehicles', cleaned.id), cleaned);
  logAuditEvent('CRIAR', 'Equipamento', `Cadastrou ${cleaned.model} (${cleaned.licensePlate || cleaned.patrimonyCode}).`);
  return cleaned;
}

export async function updateVehicle(id: string, updatedFields: Partial<Vehicle>): Promise<void> {
  const cleaned = cleanUndefined(updatedFields);
  cache.vehicles = cache.vehicles.map(v => v.id === id ? { ...v, ...cleaned } : v);
  notifyDataUpdated();

  await updateDoc(doc(db, 'vehicles', id), cleaned);
  logAuditEvent('EDITAR', 'Equipamento', `Atualizou equipamento ID ${id}.`);
}

export async function deleteVehicle(id: string): Promise<void> {
  cache.vehicles = cache.vehicles.filter(v => v.id !== id);
  notifyDataUpdated();

  await deleteDoc(doc(db, 'vehicles', id));
  logAuditEvent('EXCLUIR', 'Equipamento', `Excluiu equipamento ID ${id}.`);
}

// Maintenance Mutators
export async function addMaintenance(m: Omit<MaintenanceLog, 'id'>): Promise<MaintenanceLog> {
  const newMnt: MaintenanceLog = {
    ...m,
    id: `mnt-${Date.now()}`
  };
  const cleaned = cleanUndefined(newMnt);
  cache.maintenanceLogs = [cleaned, ...cache.maintenanceLogs];
  notifyDataUpdated();

  await setDoc(doc(db, 'maintenance_logs', cleaned.id), cleaned);
  logAuditEvent('CRIAR', 'Manutenção', `Agendou/Registrou manutenção "${m.title}" em ${m.equipmentName}.`);
  return cleaned;
}

export async function updateMaintenance(id: string, fields: Partial<MaintenanceLog>): Promise<void> {
  const cleaned = cleanUndefined(fields);
  cache.maintenanceLogs = cache.maintenanceLogs.map(m => m.id === id ? { ...m, ...cleaned } : m);
  notifyDataUpdated();

  await updateDoc(doc(db, 'maintenance_logs', id), cleaned);
  logAuditEvent('EDITAR', 'Manutenção', `Atualizou registro de manutenção ID ${id}.`);
}

export async function deleteMaintenance(id: string): Promise<void> {
  cache.maintenanceLogs = cache.maintenanceLogs.filter(m => m.id !== id);
  notifyDataUpdated();

  await deleteDoc(doc(db, 'maintenance_logs', id));
  logAuditEvent('EXCLUIR', 'Manutenção', `Excluiu o registro de manutenção ID ${id}.`);
}

// Machine Issue Mutators
export async function addMachineIssue(issueData: Omit<MachineIssue, 'id' | 'dateTime' | 'status'>): Promise<MachineIssue> {
  const newIssue: MachineIssue = {
    ...issueData,
    id: `iss-${Date.now()}`,
    dateTime: new Date().toISOString(),
    status: 'ABERTO'
  };
  const cleaned = cleanUndefined(newIssue);
  cache.machineIssues = [cleaned, ...cache.machineIssues];

  const newAlert: SmartAlert = cleanUndefined({
    id: `alt-iss-${Date.now()}`,
    type: 'MACHINE_ISSUE',
    severity: 'ALTA',
    title: `Problema Relatado: ${newIssue.equipmentName}`,
    description: `Operador ${newIssue.reportedByUserName} relatou: "${newIssue.description}"`,
    equipmentId: newIssue.equipmentId,
    equipmentName: newIssue.equipmentName,
    date: newIssue.dateTime.slice(0, 10),
    resolved: false
  });
  cache.alerts = [newAlert, ...cache.alerts];
  notifyDataUpdated();

  await setDoc(doc(db, 'machine_issues', cleaned.id), cleaned);
  await setDoc(doc(db, 'alerts', newAlert.id), newAlert);

  logAuditEvent('CRIAR', 'Problema', `Relatou problema em ${newIssue.equipmentName}: ${newIssue.description}`);
  return cleaned;
}

export async function resolveMachineIssue(issueId: string, notes?: string): Promise<void> {
  const user = getCurrentUser();
  const fields = cleanUndefined({
    status: 'RESOLVIDO',
    resolvedAt: new Date().toISOString(),
    resolvedBy: user?.name || 'Administrador',
    notes: notes || ''
  });

  cache.machineIssues = cache.machineIssues.map(i => i.id === issueId ? { ...i, ...fields } as MachineIssue : i);
  notifyDataUpdated();

  await updateDoc(doc(db, 'machine_issues', issueId), fields);
  logAuditEvent('EDITAR', 'Problema', `Resolveu o problema relatado ID ${issueId}`);
}

// Preventive Maintenance Mutators
export async function recordPreventiveService(
  equipmentId: string, 
  itemKey: PreventiveItemKey, 
  currentHourmeter: number, 
  notes?: string
): Promise<void> {
  const all = getPreventiveItems();
  const target = all.find(item => item.equipmentId === equipmentId && item.itemKey === itemKey);
  
  if (target) {
    const updatedItem: PreventiveMaintenanceItem = cleanUndefined({
      ...target,
      lastServiceDate: new Date().toISOString().slice(0, 10),
      lastServiceHourmeter: currentHourmeter,
      nextScheduledHourmeter: currentHourmeter + target.intervalHours,
      notes: notes || target.notes
    });
    
    cache.preventiveItems = cache.preventiveItems.map(p => p.id === target.id ? updatedItem : p);
    notifyDataUpdated();

    await setDoc(doc(db, 'preventive_items', target.id), updatedItem);

    // Create a maintenance log entry in Firestore
    await addMaintenance({
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
export async function addGasStation(stn: Omit<GasStation, 'id'>): Promise<GasStation> {
  const newStn: GasStation = {
    ...stn,
    id: `stn-${Date.now()}`
  };
  const cleaned = cleanUndefined(newStn);
  cache.gasStations = [...cache.gasStations, cleaned];
  notifyDataUpdated();

  await setDoc(doc(db, 'gas_stations', cleaned.id), cleaned);
  logAuditEvent('CRIAR', 'Posto', `Cadastrou posto ${cleaned.name}.`);
  return cleaned;
}

export async function updateGasStation(id: string, fields: Partial<GasStation>): Promise<void> {
  const cleaned = cleanUndefined(fields);
  cache.gasStations = cache.gasStations.map(s => s.id === id ? { ...s, ...cleaned } : s);
  notifyDataUpdated();

  await updateDoc(doc(db, 'gas_stations', id), cleaned);
  logAuditEvent('EDITAR', 'Posto', `Atualizou tabela de preços/dados do posto ID ${id}.`);
}

export async function deleteGasStation(id: string): Promise<void> {
  cache.gasStations = cache.gasStations.filter(s => s.id !== id);
  notifyDataUpdated();

  await deleteDoc(doc(db, 'gas_stations', id));
  logAuditEvent('EXCLUIR', 'Posto', `Excluiu o posto ID ${id}.`);
}

// User Mutators
export async function addUser(user: Omit<User, 'id'>): Promise<User> {
  const newUser: User = {
    ...user,
    id: `usr-${Date.now()}`
  };
  const cleaned = cleanUndefined(newUser);
  cache.users = [...cache.users, cleaned];
  notifyDataUpdated();

  await setDoc(doc(db, 'users', cleaned.id), cleaned);
  logAuditEvent('CRIAR', 'Usuário', `Cadastrou funcionário/usuário ${cleaned.name}.`);
  return cleaned;
}

export async function updateUser(id: string, fields: Partial<User>): Promise<void> {
  const cleaned = cleanUndefined(fields);
  cache.users = cache.users.map(u => u.id === id ? { ...u, ...cleaned } : u);
  notifyDataUpdated();

  await updateDoc(doc(db, 'users', id), cleaned);
  logAuditEvent('EDITAR', 'Usuário', `Atualizou dados do usuário ID ${id}.`);
}

export async function deleteUser(id: string): Promise<void> {
  cache.users = cache.users.filter(u => u.id !== id);
  notifyDataUpdated();

  await deleteDoc(doc(db, 'users', id));
  logAuditEvent('EXCLUIR', 'Usuário', `Excluiu o usuário ID ${id}.`);
}

// Alerts Mutator
export async function resolveAlert(id: string): Promise<void> {
  const user = getCurrentUser();
  const fields = cleanUndefined({
    resolved: true,
    resolvedAt: new Date().toISOString(),
    resolvedBy: user?.name || 'Administrador'
  });

  cache.alerts = cache.alerts.map(a => a.id === id ? { ...a, ...fields } as SmartAlert : a);
  notifyDataUpdated();

  await updateDoc(doc(db, 'alerts', id), fields);
  logAuditEvent('EDITAR', 'Alerta', `Marcou alerta ID ${id} como resolvido.`);
}

// Settings Mutator
export async function updateSettings(newSettings: Partial<SystemSettings>): Promise<void> {
  const cleaned = cleanUndefined(newSettings);
  cache.settings = { ...cache.settings, ...cleaned };
  notifyDataUpdated();

  await updateDoc(doc(db, 'settings', 'config'), cleaned);
  logAuditEvent('CONFIGURACAO', 'Sistema', 'Atualizou as configurações gerais do AndradeAgro.');
}

// Reset system data in Firestore
export async function resetSystemData(): Promise<void> {
  try {
    await seedCollection('users', INITIAL_USERS);
    await seedCollection('vehicles', INITIAL_VEHICLES);
    await seedCollection('gas_stations', INITIAL_GAS_STATIONS);
    await seedCollection('fuel_logs', INITIAL_FUEL_LOGS);
    await seedCollection('maintenance_logs', INITIAL_MAINTENANCE_LOGS);
    await seedCollection('machine_issues', INITIAL_MACHINE_ISSUES);
    await seedCollection('preventive_items', INITIAL_PREVENTIVE_ITEMS);
    await seedCollection('alerts', INITIAL_ALERTS);
    await seedCollection('audit_logs', INITIAL_AUDIT_LOGS);
    await setDoc(doc(db, 'settings', 'config'), cleanUndefined(INITIAL_SETTINGS));
    notifyDataUpdated();
  } catch (err) {
    console.error('Error resetting system data in Firestore:', err);
  }
}
