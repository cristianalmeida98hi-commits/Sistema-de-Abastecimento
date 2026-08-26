import { 
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, writeBatch 
} from 'firebase/firestore';
import { db, safeSetDoc, safeUpdateDoc } from '../lib/firebase';
import { 
  User, Vehicle, GasStation, FuelLog, MaintenanceLog, SmartAlert, AuditLog, 
  SystemSettings, MachineIssue, PreventiveMaintenanceItem, PreventiveItemKey, 
  FuelRefill, CentralTank, TankMovement, ScheduledServiceItem, MaintenanceControlType 
} from '../types';
import { 
  INITIAL_USERS, INITIAL_VEHICLES, INITIAL_GAS_STATIONS, 
  INITIAL_FUEL_LOGS, INITIAL_FUEL_REFILLS, INITIAL_MAINTENANCE_LOGS, INITIAL_ALERTS, 
  INITIAL_AUDIT_LOGS, INITIAL_SETTINGS, INITIAL_MACHINE_ISSUES, INITIAL_PREVENTIVE_ITEMS,
  INITIAL_CENTRAL_TANKS, INITIAL_TANK_MOVEMENTS 
} from '../data/seedData';

const SESSION_KEYS = {
  SESSION_USER: 'andradeagro_session_user_v1',
  REMEMBERED_EMAIL: 'andradeagro_remembered_email_v1'
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
  centralTanks: INITIAL_CENTRAL_TANKS as CentralTank[],
  tankMovements: INITIAL_TANK_MOVEMENTS as TankMovement[],
  fuelLogs: INITIAL_FUEL_LOGS as FuelLog[],
  fuelRefills: INITIAL_FUEL_REFILLS as FuelRefill[],
  maintenanceLogs: INITIAL_MAINTENANCE_LOGS as MaintenanceLog[],
  machineIssues: INITIAL_MACHINE_ISSUES as MachineIssue[],
  preventiveItems: INITIAL_PREVENTIVE_ITEMS as PreventiveMaintenanceItem[],
  alerts: INITIAL_ALERTS as SmartAlert[],
  auditLogs: INITIAL_AUDIT_LOGS as AuditLog[],
  settings: INITIAL_SETTINGS as SystemSettings
};

let isInitialized = false;
let notifyDebounceTimer: any = null;
let alertCheckDebounceTimer: any = null;

// Initialize Firebase Firestore Real-Time Listeners
export function initStorage() {
  if (isInitialized && typeof window !== 'undefined') return;
  isInitialized = true;

  // Purge any legacy auth keys from previous versions to avoid auto-login glitches
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('andradeagro_remembered_user_v1');
      localStorage.removeItem('andradeagro_remembered_user');
      localStorage.removeItem('andradeagro_user');
      localStorage.removeItem('andradeagro_current_user');
    } catch (e) {
      // ignore
    }
  }

  try {
    // 1. Users Subscription
    onSnapshot(collection(db, 'users'), (snapshot) => {
      if (snapshot.empty) {
        seedCollection('users', INITIAL_USERS);
      } else {
        const items = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as User));
        cache.users = items;
        notifyDataUpdated();
      }
    }, (err) => console.error('[Firestore Users Error]', err));

    // 2. Vehicles / Machines Subscription
    onSnapshot(collection(db, 'vehicles'), (snapshot) => {
      if (snapshot.empty) {
        seedCollection('vehicles', INITIAL_VEHICLES);
      } else {
        const items = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Vehicle));
        cache.vehicles = items;
        notifyDataUpdated();
      }
    }, (err) => console.error('[Firestore Vehicles Error]', err));

    // 3. Central Tanks Subscription (Tanques Centrais: Quadra e Itapeva)
    onSnapshot(collection(db, 'central_tanks'), (snapshot) => {
      if (snapshot.empty) {
        seedCollection('central_tanks', INITIAL_CENTRAL_TANKS);
      } else {
        const items = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as CentralTank));
        cache.centralTanks = items;
        notifyDataUpdated();
      }
    }, (err) => console.error('[Firestore CentralTanks Error]', err));

    // 3.1 Tank Movements Subscription
    onSnapshot(collection(db, 'tank_movements'), (snapshot) => {
      if (snapshot.empty) {
        seedCollection('tank_movements', INITIAL_TANK_MOVEMENTS);
      } else {
        const items = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as TankMovement));
        items.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
        cache.tankMovements = items;
        notifyDataUpdated();
      }
    }, (err) => console.error('[Firestore TankMovements Error]', err));

    // 3.2 Gas Stations Subscription
    onSnapshot(collection(db, 'gas_stations'), (snapshot) => {
      if (snapshot.empty) {
        seedCollection('gas_stations', INITIAL_GAS_STATIONS);
      } else {
        const items = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as GasStation));
        cache.gasStations = items;
        notifyDataUpdated();
      }
    }, (err) => console.error('[Firestore GasStations Error]', err));

    // 4. Fuel Logs Subscription
    onSnapshot(collection(db, 'fuel_logs'), (snapshot) => {
      if (snapshot.empty) {
        seedCollection('fuel_logs', INITIAL_FUEL_LOGS);
      } else {
        const items = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as FuelLog));
        items.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
        cache.fuelLogs = items;
        notifyDataUpdated();
      }
    }, (err) => console.error('[Firestore FuelLogs Error]', err));

    // 4.1 Fuel Refills Subscription
    onSnapshot(collection(db, 'fuel_refills'), (snapshot) => {
      if (snapshot.empty) {
        seedCollection('fuel_refills', INITIAL_FUEL_REFILLS);
      } else {
        const items = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as FuelRefill));
        items.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
        cache.fuelRefills = items;
        notifyDataUpdated();
      }
    }, (err) => console.error('[Firestore FuelRefills Error]', err));

    // 5. Maintenance Logs Subscription
    onSnapshot(collection(db, 'maintenance_logs'), (snapshot) => {
      if (snapshot.empty) {
        seedCollection('maintenance_logs', INITIAL_MAINTENANCE_LOGS);
      } else {
        const items = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as MaintenanceLog));
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
        const items = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as MachineIssue));
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
        const items = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as PreventiveMaintenanceItem));
        cache.preventiveItems = items;
        notifyDataUpdated();
      }
    }, (err) => console.error('[Firestore Preventive Error]', err));

    // 8. Alerts Subscription
    onSnapshot(collection(db, 'alerts'), (snapshot) => {
      if (snapshot.empty) {
        seedCollection('alerts', INITIAL_ALERTS);
      } else {
        const items = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as SmartAlert));
        items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        cache.alerts = items;
        notifyDataUpdated(false); // don't re-trigger alert check when alerts arrive
      }
    }, (err) => console.error('[Firestore Alerts Error]', err));

    // 9. Audit Logs Subscription
    onSnapshot(collection(db, 'audit_logs'), (snapshot) => {
      if (snapshot.empty) {
        seedCollection('audit_logs', INITIAL_AUDIT_LOGS);
      } else {
        const items = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as AuditLog));
        items.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
        cache.auditLogs = items;
        notifyDataUpdated(false);
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

export function notifyDataUpdated(shouldCheckAlerts: boolean = true) {
  if (typeof window !== 'undefined') {
    if (notifyDebounceTimer) clearTimeout(notifyDebounceTimer);
    notifyDebounceTimer = setTimeout(() => {
      window.dispatchEvent(new Event('andradeagro_data_updated'));
    }, 40);

    if (shouldCheckAlerts) {
      if (alertCheckDebounceTimer) clearTimeout(alertCheckDebounceTimer);
      alertCheckDebounceTimer = setTimeout(() => {
        checkAutomatedAlerts();
      }, 300);
    }
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

export function getRememberedEmail(): string {
  try {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(SESSION_KEYS.REMEMBERED_EMAIL) || '';
  } catch (err) {
    return '';
  }
}

export function clearRememberedEmail(): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SESSION_KEYS.REMEMBERED_EMAIL);
      localStorage.removeItem('andradeagro_remembered_user_v1');
      localStorage.removeItem('andradeagro_remembered_user');
      notifyDataUpdated(false);
    }
  } catch (err) {
    console.error('Error clearing remembered email:', err);
  }
}

export function getCurrentUser(): User | null {
  try {
    if (typeof window === 'undefined') return null;
    const sessionStr = sessionStorage.getItem(SESSION_KEYS.SESSION_USER);
    if (!sessionStr) return null;

    const parsedUser: User = JSON.parse(sessionStr);
    if (!parsedUser || !parsedUser.id) return null;

    // Validate against fresh active cache
    const live = cache.users.find(u => u.id === parsedUser.id || u.email?.toLowerCase() === parsedUser.email?.toLowerCase());
    if (live) {
      if (live.active === false) {
        logoutUser();
        return null;
      }
      return live;
    }
    return parsedUser;
  } catch (err) {
    console.error('Error reading current user session:', err);
    return null;
  }
}

export function loginUser(email: string, password: string, rememberMe: boolean): { success: boolean; user?: User; error?: string } {
  const users = getUsers();
  const targetEmail = email.trim().toLowerCase();
  
  const user = users.find(u => u.email.toLowerCase() === targetEmail);

  if (!user) {
    return { success: false, error: 'E-mail não cadastrado no sistema AndradeAgro.' };
  }

  if (user.active === false) {
    return { success: false, error: 'Este usuário está inativo no sistema. Fale com a administração.' };
  }

  if (user.password !== password) {
    return { success: false, error: 'Senha incorreta. Verifique suas credenciais.' };
  }

  // Update session
  setCurrentUserSession(user);

  // Handle remember email
  if (typeof window !== 'undefined') {
    if (rememberMe) {
      localStorage.setItem(SESSION_KEYS.REMEMBERED_EMAIL, targetEmail);
    } else {
      localStorage.removeItem(SESSION_KEYS.REMEMBERED_EMAIL);
    }
  }

  // Register audit
  logAuditEvent('LOGIN', 'Autenticação', `Usuário ${user.name} (${user.role}) realizou login no sistema.`);

  return { success: true, user };
}

export function logoutUser(): void {
  try {
    const user = getCurrentUser();
    if (user) {
      logAuditEvent('LOGOUT', 'Autenticação', `Usuário ${user.name} saiu do sistema.`);
    }
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(SESSION_KEYS.SESSION_USER);
    }
    notifyDataUpdated(false);
  } catch (err) {
    console.error('Error logging out user:', err);
  }
}

export function setCurrentUserSession(user: User): void {
  try {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(SESSION_KEYS.SESSION_USER, JSON.stringify(user));
    }
  } catch (err) {
    console.error('Error setting current user:', err);
  }
}

export function setCurrentUser(user: User | null): void {
  if (user) {
    setCurrentUserSession(user);
    notifyDataUpdated(false);
  } else {
    logoutUser();
  }
}

export function getVehicles(): Vehicle[] {
  return cache.vehicles;
}

export function getCentralTanks(): CentralTank[] {
  return cache.centralTanks && cache.centralTanks.length > 0 ? cache.centralTanks : INITIAL_CENTRAL_TANKS;
}

export function getCentralTank(id: string): CentralTank | undefined {
  const tanks = getCentralTanks();
  return tanks.find(t => t.id === id);
}

export function getTankMovements(tankId?: string): TankMovement[] {
  const all = cache.tankMovements || [];
  if (!tankId) return all;
  return all.filter(m => m.tankId === tankId);
}

export function getGasStations(): GasStation[] {
  return cache.gasStations;
}

export function getFuelLogs(): FuelLog[] {
  return cache.fuelLogs;
}

export function getFuelRefills(): FuelRefill[] {
  return cache.fuelRefills;
}

// Calculate Individual Tank Status (Tanque Central Quadra, Tanque Central Itapeva ou Genérico)
export function getTankStatus(targetTankId?: string) {
  const allTanks = getCentralTanks();
  
  // Identify which tank to evaluate
  let targetTank: CentralTank | undefined;
  if (targetTankId) {
    targetTank = allTanks.find(t => t.id === targetTankId || (targetTankId.includes('quadra') && t.id === 'tank-quadra') || (targetTankId.includes('itapeva') && t.id === 'tank-itapeva'));
  }
  
  // Fallback to first tank (Quadra) if not found
  if (!targetTank) {
    targetTank = allTanks[0] || INITIAL_CENTRAL_TANKS[0];
  }

  const capacity = targetTank?.capacityLiters || 10000;
  const initialStock = targetTank?.currentStockLiters !== undefined ? targetTank.currentStockLiters : 7500;
  const minStockAlert = targetTank?.minStockAlertLiters || 2000;
  const baseUpdatedAt = targetTank?.stockBaseUpdatedAt ? new Date(targetTank.stockBaseUpdatedAt).getTime() : 0;

  // Refills dedicated to this specific tank
  const refills = getFuelRefills();
  const totalRefilled = refills.reduce((sum, r) => {
    const rDate = r.dateTime || (r as any).date;
    // Check if refill belongs to this tank (by tankId or matched name)
    const isThisTank = (r as any).tankId === targetTank?.id || 
      (targetTank?.id === 'tank-quadra' && (!((r as any).tankId) || (r as any).tankId === 'stn-001' || (r as any).tankId === 'stn-quadra')) ||
      (targetTank?.id === 'tank-itapeva' && (r as any).tankId === 'tank-itapeva');
    
    if (!isThisTank) return sum;

    if (baseUpdatedAt > 0 && rDate) {
      const refillTime = new Date(rDate).getTime();
      if (refillTime < baseUpdatedAt) return sum;
    }
    return sum + (Number(r.liters) || 0);
  }, 0);

  // Dispensed fuel logs dedicated to this specific tank
  const fuelLogs = getFuelLogs();
  const totalDispensed = fuelLogs.reduce((sum, log) => {
    const isThisTank = log.gasStationId === targetTank?.id || 
      (targetTank?.id === 'tank-quadra' && (log.gasStationId === 'stn-001' || log.gasStationId === 'stn-quadra' || log.gasStationName?.toLowerCase().includes('quadra') || (!log.gasStationId && !log.gasStationName?.toLowerCase().includes('itapeva')))) ||
      (targetTank?.id === 'tank-itapeva' && (log.gasStationId === 'tank-itapeva' || log.gasStationId === 'stn-itapeva' || log.gasStationName?.toLowerCase().includes('itapeva')));

    if (!isThisTank) return sum;

    if (baseUpdatedAt > 0 && log.dateTime) {
      const logTime = new Date(log.dateTime).getTime();
      if (logTime < baseUpdatedAt) return sum;
    }
    return sum + (Number(log.liters) || 0);
  }, 0);

  const currentStock = Math.max(0, initialStock + totalRefilled - totalDispensed);
  const percentage = capacity > 0 ? Math.min(100, Math.max(0, (currentStock / capacity) * 100)) : 0;
  
  // Alerta quando estoque atual <= estoque mínimo configurado (padrão 2.000 L)
  const isCritical = currentStock <= Math.max(500, minStockAlert * 0.25);
  const isLow = currentStock <= minStockAlert;

  return {
    tankId: targetTank?.id || 'tank-quadra',
    name: targetTank?.name || 'Tanque Central',
    location: targetTank?.location || 'Sede',
    capacity,
    minStockAlert,
    initialStock,
    totalRefilled,
    totalDispensed,
    currentStock,
    percentage: Math.round(percentage * 10) / 10,
    isLow,
    isCritical
  };
}

// Quick Access Shortcuts helpers (ADMs e Funcionários na tela de login)
export function getQuickAccessUserIds(): string[] {
  try {
    const settings = getSettings();
    if (settings.quickAccessUserIds && Array.isArray(settings.quickAccessUserIds) && settings.quickAccessUserIds.length > 0) {
      return settings.quickAccessUserIds;
    }
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('andradeagro_quick_access_user_ids');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
    // Default: all active users
    return cache.users.filter(u => u.active !== false).map(u => u.id);
  } catch (e) {
    console.error('Error loading quick access user ids:', e);
    return cache.users.filter(u => u.active !== false).map(u => u.id);
  }
}

export async function setQuickAccessUserIds(userIds: string[]): Promise<void> {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('andradeagro_quick_access_user_ids', JSON.stringify(userIds));
    }
    await updateSettings({ quickAccessUserIds: userIds });
  } catch (e) {
    console.error('Error saving quick access user ids:', e);
  }
}

export async function toggleQuickAccessUser(userId: string): Promise<void> {
  const currentIds = getQuickAccessUserIds();
  const nextIds = currentIds.includes(userId)
    ? currentIds.filter(id => id !== userId)
    : [...currentIds, userId];
  await setQuickAccessUserIds(nextIds);
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
    { key: 'TROCA_OLEO_MOTOR', name: 'Troca de Óleo do Motor', interval: 300 },
    { key: 'FILTRO_OLEO', name: 'Filtro de Óleo Lubrificante', interval: 300 },
    { key: 'FILTRO_COMBUSTIVEL', name: 'Filtro de Combustível / Separador', interval: 500 },
    { key: 'FILTRO_AR', name: 'Filtro de Ar do Motor', interval: 500 },
    { key: 'LUBRIFICACAO', name: 'Lubrificação Geral (Graxa)', interval: 100 },
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

    // If fueling came from a central tank, register a Tank Movement (Saída / Abastecimento)
    const isTankQuadra = log.gasStationId === 'tank-quadra' || log.gasStationId === 'stn-001' || log.gasStationId === 'stn-quadra' || log.gasStationName?.toLowerCase().includes('quadra');
    const isTankItapeva = log.gasStationId === 'tank-itapeva' || log.gasStationId === 'stn-itapeva' || log.gasStationName?.toLowerCase().includes('itapeva');
    
    if (isTankQuadra || isTankItapeva) {
      const activeTankId = isTankItapeva ? 'tank-itapeva' : 'tank-quadra';
      const statusBefore = getTankStatus(activeTankId);
      const prevStock = statusBefore.currentStock;
      const afterStock = Math.max(0, prevStock - log.liters);

      await addTankMovement({
        tankId: activeTankId,
        dateTime: log.dateTime || new Date().toISOString(),
        type: 'SAIDA_ABASTECIMENTO',
        liters: log.liters,
        previousStock: prevStock,
        afterStock: afterStock,
        userId: log.attendantId || log.driverOrOperatorId || 'sys',
        userName: log.attendantName || log.driverOrOperatorName || 'Operador',
        equipmentId: log.equipmentId,
        equipmentName: log.equipmentName,
        fuelLogId: cleanedLog.id,
        notes: `Abastecimento de ${log.liters}L em ${log.equipmentName} (${log.equipmentPlateOrCode}).`
      });
    }

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

    logAuditEvent('CRIAR', 'Abastecimento', `Registrou ${newLog.liters}L em ${newLog.equipmentName} (${newLog.equipmentPlateOrCode}) via ${newLog.gasStationName}.`);
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

// Central Tanks Mutators
export async function updateCentralTank(id: string, fields: Partial<CentralTank>, reason?: string): Promise<void> {
  const current = getCentralTank(id);
  const currentStatus = getTankStatus(id);
  const user = getCurrentUser();

  const prevStock = currentStatus ? currentStatus.currentStock : (current?.currentStockLiters || 0);
  const newStock = fields.currentStockLiters !== undefined ? Number(fields.currentStockLiters) : prevStock;
  const stockChanged = fields.currentStockLiters !== undefined && Math.abs(newStock - prevStock) > 0.01;

  const cleaned = cleanUndefined({
    ...fields,
    currentStockLiters: newStock,
    stockBaseUpdatedAt: stockChanged ? new Date().toISOString() : (current?.stockBaseUpdatedAt || new Date().toISOString())
  });

  const updatedObj = current ? { ...current, ...cleaned } : { id, ...cleaned } as CentralTank;
  cache.centralTanks = cache.centralTanks.map(t => t.id === id ? updatedObj : t);
  if (!cache.centralTanks.some(t => t.id === id)) {
    cache.centralTanks.push(updatedObj);
  }
  notifyDataUpdated();

  await setDoc(doc(db, 'central_tanks', id), cleaned, { merge: true });

  // If currentStockLiters was manually adjusted, register an audit movement with full details
  if (stockChanged) {
    const diff = newStock - prevStock;
    const diffText = diff > 0 ? `+${diff.toLocaleString('pt-BR')} L` : `${diff.toLocaleString('pt-BR')} L`;
    const adjReason = reason?.trim() || 'Ajuste manual de calibração do estoque físico';

    await addTankMovement({
      tankId: id,
      dateTime: new Date().toISOString(),
      type: 'AJUSTE_MANUAL',
      liters: newStock,
      previousStock: prevStock,
      afterStock: newStock,
      difference: diff,
      userId: user?.id || 'sys',
      userName: user?.name || 'Administrador',
      reason: adjReason,
      notes: `Ajuste manual em ${updatedObj.name}: anterior ${prevStock.toLocaleString('pt-BR')}L → novo ${newStock.toLocaleString('pt-BR')}L (${diffText}). Motivo: ${adjReason}.`
    });

    logAuditEvent(
      'CONFIGURACAO', 
      'Ajuste de Estoque de Tanque', 
      `Ajustou estoque do ${updatedObj.name}: ${prevStock.toLocaleString('pt-BR')}L → ${newStock.toLocaleString('pt-BR')}L (${diffText}). Motivo: ${adjReason}.`
    );
  } else {
    logAuditEvent('EDITAR', 'Tanque Central', `Atualizou dados e configurações de ${updatedObj.name} (${updatedObj.location}).`);
  }

  checkAutomatedAlerts();
}

export async function addTankMovement(movement: Omit<TankMovement, 'id'>): Promise<TankMovement> {
  const newMov: TankMovement = {
    ...movement,
    id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  };
  const cleaned = cleanUndefined(newMov);
  cache.tankMovements = [cleaned, ...(cache.tankMovements || [])];
  notifyDataUpdated(false);

  await setDoc(doc(db, 'tank_movements', cleaned.id), cleaned);
  return cleaned;
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

  // When a maintenance is registered, also update the vehicle's last maintenance reference and next target
  const vehicles = getVehicles();
  const targetVehicle = vehicles.find(v => v.id === m.equipmentId);
  if (targetVehicle) {
    const isKm = targetVehicle.category === 'VEICULO' || targetVehicle.maintenanceControlType === 'QUILOMETRAGEM';
    const interval = isKm 
      ? (targetVehicle.maintenanceIntervalKm || 10000)
      : (targetVehicle.maintenanceIntervalHours || targetVehicle.oilChangeIntervalHours || 300);

    const updates: Partial<Vehicle> = {};
    if (isKm) {
      updates.lastMaintenanceKm = m.kmOrHourAtService;
      updates.nextMaintenanceKm = m.nextServiceKmOrHour || (m.kmOrHourAtService + interval);
      updates.lastMaintenanceDate = m.date;
    } else {
      updates.lastMaintenanceHourmeter = m.kmOrHourAtService;
      updates.nextMaintenanceHourmeter = m.nextServiceKmOrHour || (m.kmOrHourAtService + interval);
      updates.lastMaintenanceDate = m.date;
      if (m.type === 'TROCA_OLEO' || m.title.toLowerCase().includes('óleo')) {
        updates.lastOilChangeHourmeter = m.kmOrHourAtService;
        updates.lastOilChangeDate = m.date;
        updates.nextOilChangeHourmeter = m.nextServiceKmOrHour || (m.kmOrHourAtService + interval);
      }
    }

    await updateVehicle(targetVehicle.id, updates);
  }

  logAuditEvent('CRIAR', 'Manutenção', `Agendou/Registrou manutenção "${m.title}" em ${m.equipmentName}.`);
  checkAutomatedAlerts();
  return cleaned;
}

export async function updateMaintenance(id: string, fields: Partial<MaintenanceLog>): Promise<void> {
  const cleaned = cleanUndefined(fields);
  cache.maintenanceLogs = cache.maintenanceLogs.map(m => m.id === id ? { ...m, ...cleaned } : m);
  notifyDataUpdated();

  await updateDoc(doc(db, 'maintenance_logs', id), cleaned);
  logAuditEvent('EDITAR', 'Manutenção', `Atualizou registro de manutenção ID ${id}.`);
  checkAutomatedAlerts();
}

export async function deleteMaintenance(id: string): Promise<void> {
  cache.maintenanceLogs = cache.maintenanceLogs.filter(m => m.id !== id);
  notifyDataUpdated();

  await deleteDoc(doc(db, 'maintenance_logs', id));
  logAuditEvent('EXCLUIR', 'Manutenção', `Excluiu o registro de manutenção ID ${id}.`);
  checkAutomatedAlerts();
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
  const vehicles = getVehicles();
  const vehicle = vehicles.find(v => v.id === equipmentId);
  const interval = target?.intervalHours || vehicle?.maintenanceIntervalHours || 300;

  if (target) {
    const updatedItem: PreventiveMaintenanceItem = cleanUndefined({
      ...target,
      lastServiceDate: new Date().toISOString().slice(0, 10),
      lastServiceHourmeter: currentHourmeter,
      nextScheduledHourmeter: currentHourmeter + interval,
      notes: notes || target.notes
    });
    
    cache.preventiveItems = cache.preventiveItems.map(p => p.id === target.id ? updatedItem : p);
    notifyDataUpdated();

    await setDoc(doc(db, 'preventive_items', target.id), updatedItem);

    // Create a maintenance log entry in Firestore
    await addMaintenance({
      equipmentId,
      equipmentName: vehicle?.model || target.itemName,
      equipmentPlateOrCode: vehicle?.patrimonyCode || vehicle?.licensePlate || equipmentId,
      date: new Date().toISOString().slice(0, 10),
      type: itemKey.includes('OLEO') ? 'TROCA_OLEO' : (itemKey.includes('FILTRO') ? 'TROCA_FILTROS' : 'REVISAO'),
      title: `Manutenção Preventiva: ${target.itemName}`,
      description: `Serviço realizado no horímetro ${currentHourmeter}h. Próxima programada com +${interval}h (em ${currentHourmeter + interval}h).`,
      kmOrHourAtService: currentHourmeter,
      nextServiceKmOrHour: currentHourmeter + interval,
      cost: 0,
      supplierOrWorkshop: 'Oficina Interna AndradeAgro',
      performedBy: getCurrentUser()?.name || 'Oficina',
      status: 'CONCLUIDO',
      notes
    });

    logAuditEvent('CRIAR', 'Manutenção Preventiva', `Registrou ${target.itemName} em ${vehicle?.model || equipmentId} no horímetro ${currentHourmeter}h.`);
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

  await safeSetDoc(doc(db, 'gas_stations', cleaned.id), cleaned);
  logAuditEvent('CRIAR', 'Posto', `Cadastrou posto ${cleaned.name}.`);
  return cleaned;
}

export async function updateGasStation(id: string, fields: Partial<GasStation>): Promise<void> {
  const cleaned = cleanUndefined(fields);
  cache.gasStations = cache.gasStations.map(s => s.id === id ? { ...s, ...cleaned } : s);
  notifyDataUpdated();

  await safeUpdateDoc(doc(db, 'gas_stations', id), cleaned);
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

// Fuel Refill (Entrada / Reabastecimento de Tanque) Mutators
export async function addFuelRefill(refill: Omit<FuelRefill, 'id' | 'createdAt'>): Promise<FuelRefill> {
  const newRefill: FuelRefill = {
    ...refill,
    id: `refill-${Date.now()}`,
    createdAt: new Date().toISOString()
  };
  const cleaned = cleanUndefined(newRefill);
  cache.fuelRefills = [cleaned, ...cache.fuelRefills];
  notifyDataUpdated();

  await setDoc(doc(db, 'fuel_refills', cleaned.id), cleaned);

  // Register in Tank Movements
  const targetTankId = (refill as any).tankId || 'tank-quadra';
  const tankStatus = getTankStatus(targetTankId);
  const prevStock = tankStatus.currentStock;
  const afterStock = prevStock + cleaned.liters;

  await addTankMovement({
    tankId: targetTankId,
    dateTime: cleaned.dateTime || (cleaned as any).date || new Date().toISOString(),
    type: 'ENTRADA',
    liters: cleaned.liters,
    previousStock: prevStock,
    afterStock: afterStock,
    userId: getCurrentUser()?.id || 'sys',
    userName: getCurrentUser()?.name || 'Administrador',
    refillId: cleaned.id,
    notes: `Recebimento de combustível: ${cleaned.liters.toLocaleString('pt-BR')}L (${cleaned.fuelType}) de ${cleaned.supplierName || 'Fornecedor'}. NF: ${cleaned.invoiceNumber || 'S/N'}.`
  });

  logAuditEvent('CRIAR', 'Entrada de Combustível', `Registrou entrada de ${cleaned.liters.toLocaleString('pt-BR')}L no ${tankStatus.name} (${cleaned.fuelType}) de ${cleaned.supplierName || 'Fornecedor'}.`);
  
  checkAutomatedAlerts();
  return cleaned;
}

export async function deleteFuelRefill(id: string): Promise<void> {
  cache.fuelRefills = cache.fuelRefills.filter(r => r.id !== id);
  notifyDataUpdated();

  await deleteDoc(doc(db, 'fuel_refills', id));
  logAuditEvent('EXCLUIR', 'Entrada de Combustível', `Removeu o registro de entrada de combustível ID ${id}.`);
  checkAutomatedAlerts();
}

// Dedicated Oil Change / Maintenance Service Recorder
// Dedicated Oil Change / Maintenance Service Recorder
export async function recordOilChange(
  equipmentId: string,
  recordedHourmeter: number,
  date?: string,
  cost: number = 0,
  notes?: string,
  extra?: {
    oilType?: string;
    oilQuantityLiters?: number;
    filtersReplaced?: string;
    performedBy?: string;
    supplierOrWorkshop?: string;
  }
): Promise<void> {
  const serviceDate = date || new Date().toISOString().slice(0, 10);
  const vehicles = getVehicles();
  const targetVehicle = vehicles.find(v => v.id === equipmentId);
  
  // Use equipment specific interval (default 300h only if not specified)
  const interval = Number(targetVehicle?.oilChangeIntervalHours) || Number(targetVehicle?.maintenanceIntervalHours) || 300;
  const nextScheduled = recordedHourmeter + interval;
  const performedBy = extra?.performedBy || getCurrentUser()?.name || 'Mecânico Responsável';
  const supplierOrWorkshop = extra?.supplierOrWorkshop || 'Oficina Interna AndradeAgro';
  const oilType = extra?.oilType || 'Óleo Motor 15W40';
  const oilQuantityLiters = extra?.oilQuantityLiters;
  const filtersReplaced = extra?.filtersReplaced;

  if (targetVehicle) {
    const updatedVehicle: Partial<Vehicle> = {
      oilChangeControlActive: true,
      lastMaintenanceHourmeter: recordedHourmeter,
      lastMaintenanceDate: serviceDate,
      nextMaintenanceHourmeter: nextScheduled,
      lastOilChangeHourmeter: recordedHourmeter,
      lastOilChangeDate: serviceDate,
      nextOilChangeHourmeter: nextScheduled,
      oilChangeIntervalHours: interval,
      currentHourmeter: Math.max(targetVehicle.currentHourmeter || 0, recordedHourmeter)
    };
    await updateVehicle(targetVehicle.id, updatedVehicle);
  }

  // Update Preventive Item if exists
  const allPrev = getPreventiveItems();
  const oilPrevItem = allPrev.find(p => p.equipmentId === equipmentId && p.itemKey === 'TROCA_OLEO_MOTOR');
  if (oilPrevItem) {
    const updatedItem = cleanUndefined({
      ...oilPrevItem,
      lastServiceDate: serviceDate,
      lastServiceHourmeter: recordedHourmeter,
      nextScheduledHourmeter: nextScheduled,
      intervalHours: interval,
      notes: notes || oilPrevItem.notes
    });
    cache.preventiveItems = cache.preventiveItems.map(p => p.id === oilPrevItem.id ? updatedItem : p);
    await setDoc(doc(db, 'preventive_items', oilPrevItem.id), updatedItem);
  }

  // Resolve any existing maintenance alert for this machine
  const existingAlert = cache.alerts.find(a => a.id === `alt-oil-${equipmentId}` || (a.equipmentId === equipmentId && (a.type === 'OIL_CHANGE_DUE' || a.type === 'PREVENTIVE_MAINTENANCE')));
  if (existingAlert && !existingAlert.resolved) {
    await resolveAlert(existingAlert.id);
  }

  // Build full description
  let desc = `Troca de óleo realizada no horímetro ${recordedHourmeter}h. Intervalo: ${interval}h. Próxima troca programada para ${nextScheduled}h.`;
  if (oilType) desc += ` Tipo: ${oilType}.`;
  if (oilQuantityLiters) desc += ` Volume: ${oilQuantityLiters}L.`;
  if (filtersReplaced) desc += ` Filtros: ${filtersReplaced}.`;

  // Add Maintenance Log
  await addMaintenance({
    equipmentId,
    equipmentName: targetVehicle?.model || 'Máquina Agrícola',
    equipmentPlateOrCode: targetVehicle?.patrimonyCode || targetVehicle?.licensePlate || equipmentId,
    date: serviceDate,
    type: 'TROCA_OLEO',
    title: `Troca de Óleo do Motor (${recordedHourmeter}h)`,
    description: desc,
    kmOrHourAtService: recordedHourmeter,
    nextServiceKmOrHour: nextScheduled,
    cost,
    supplierOrWorkshop,
    performedBy,
    status: 'CONCLUIDO',
    notes,
    oilType,
    oilQuantityLiters,
    filtersReplaced,
    intervalHoursApplied: interval
  });

  logAuditEvent('CRIAR', 'Troca de Óleo', `Registrou troca de óleo em ${targetVehicle?.model || equipmentId} no horímetro ${recordedHourmeter}h (Próxima: ${nextScheduled}h).`);
  checkAutomatedAlerts();
  notifyDataUpdated();
}

// Configurator for Oil Change Interval & Initial Reference Meter without creating fake past maintenance
export async function setOilChangeConfigAndReference(
  equipmentId: string,
  config: {
    active: boolean;
    intervalHours: number;
    warningAdvanceHours: number;
    referenceHourmeter?: number;
    lastServiceDate?: string;
  }
): Promise<void> {
  const vehicles = getVehicles();
  const target = vehicles.find(v => v.id === equipmentId);
  if (!target) return;

  const active = config.active !== false;
  const interval = Math.max(1, Number(config.intervalHours) || 300);
  const advance = Math.max(0, Number(config.warningAdvanceHours) || 50);
  const refMeter = config.referenceHourmeter !== undefined 
    ? Number(config.referenceHourmeter) 
    : (target.lastOilChangeHourmeter !== undefined ? Number(target.lastOilChangeHourmeter) : (target.currentHourmeter || 0));
  
  const nextScheduled = refMeter + interval;

  const vehicleUpdates: Partial<Vehicle> = {
    oilChangeControlActive: active,
    oilChangeIntervalHours: interval,
    oilChangeWarningAdvanceHours: advance,
    lastOilChangeHourmeter: refMeter,
    lastOilChangeDate: config.lastServiceDate || target.lastOilChangeDate || new Date().toISOString().slice(0, 10),
    nextOilChangeHourmeter: nextScheduled,
    maintenanceIntervalHours: interval,
    maintenanceWarningAdvanceHours: advance,
    lastMaintenanceHourmeter: refMeter,
    nextMaintenanceHourmeter: nextScheduled,
  };

  await updateVehicle(target.id, vehicleUpdates);

  // If deactivated, resolve pending alerts for this equipment
  if (!active) {
    const existingAlert = cache.alerts.find(a => a.id === `alt-oil-${equipmentId}` || (a.equipmentId === equipmentId && a.type === 'OIL_CHANGE_DUE'));
    if (existingAlert && !existingAlert.resolved) {
      await resolveAlert(existingAlert.id);
    }
  }

  logAuditEvent('CONFIGURACAO', 'Troca de Óleo', `Configurou troca de óleo de ${target.model}: Intervalo ${interval}h, Alerta ${advance}h antes, Horímetro ref: ${refMeter}h, Ativo: ${active ? 'Sim' : 'Não'}.`);
  checkAutomatedAlerts();
  notifyDataUpdated();
}

// Automated Intelligence Checker for Alerts (Multi-tank & Multi-interval maintenance)
export function checkAutomatedAlerts() {
  try {
    const settings = getSettings();
    if (!settings.autoAlertsEnabled) return;

    // 1. Check Tank Level for EACH Central Tank independently (Quadra & Itapeva)
    const centralTanks = getCentralTanks();
    centralTanks.forEach(tank => {
      const tankStatus = getTankStatus(tank.id);
      const lowTankAlertId = `alt-low-tank-${tank.id}`;
      const existingLowTank = cache.alerts.find(a => a.id === lowTankAlertId);
      const minStock = tank.minStockAlertLiters || 2000;

      if (tankStatus.currentStock <= minStock) {
        const isCritical = tankStatus.currentStock <= Math.max(500, minStock * 0.25);
        const title = isCritical ? `🔴 Estoque crítico - ${tank.name}` : `⚠️ Estoque baixo - ${tank.name}`;
        const desc = `O ${tank.name} (${tank.location}) está com ${Math.round(tankStatus.currentStock).toLocaleString('pt-BR')} L. Nível ${isCritical ? 'crítico' : 'abaixo do estoque mínimo'} de ${minStock.toLocaleString('pt-BR')} L. Reabastecimento recomendado.`;

        if (!existingLowTank) {
          const alertObj: SmartAlert = cleanUndefined({
            id: lowTankAlertId,
            type: 'LOW_TANK_LEVEL',
            severity: isCritical ? 'ALTA' : 'MEDIA',
            title,
            description: desc,
            date: new Date().toISOString().slice(0, 10),
            resolved: false
          });
          cache.alerts = [alertObj, ...cache.alerts.filter(a => a.id !== lowTankAlertId)];
          setDoc(doc(db, 'alerts', lowTankAlertId), alertObj).catch(console.error);
        } else if (!existingLowTank.resolved || existingLowTank.description !== desc) {
          const updated: SmartAlert = cleanUndefined({
            ...existingLowTank,
            title,
            description: desc,
            severity: isCritical ? 'ALTA' : 'MEDIA',
            resolved: false,
            resolvedAt: undefined,
            resolvedBy: undefined
          });
          cache.alerts = cache.alerts.map(a => a.id === lowTankAlertId ? updated : a);
          setDoc(doc(db, 'alerts', lowTankAlertId), updated).catch(console.error);
        }
      } else if (existingLowTank && !existingLowTank.resolved) {
        // Tank level returned to above minimum limit -> auto-resolve the alert
        const resolvedAlert = cleanUndefined({
          ...existingLowTank,
          resolved: true,
          resolvedAt: new Date().toISOString(),
          resolvedBy: 'Sistema (Estoque Normalizado)'
        });
        cache.alerts = cache.alerts.map(a => a.id === lowTankAlertId ? resolvedAlert : a);
        setDoc(doc(db, 'alerts', lowTankAlertId), resolvedAlert).catch(console.error);
      }
    });

    // 2. Check Flexible & Individual Maintenance Intervals per Vehicle/Machine
    const vehicles = getVehicles();
    vehicles.forEach(v => {
      const isKm = v.category === 'VEICULO' || v.maintenanceControlType === 'QUILOMETRAGEM';
      
      if (!isKm) {
        // Hour-based maintenance control
        const isOilControlActive = v.oilChangeControlActive !== false;
        const curHour = Number(v.currentHourmeter) || 0;
        const lastMnt = Number(v.lastOilChangeHourmeter) || Number(v.lastMaintenanceHourmeter) || 0;
        const interval = Number(v.oilChangeIntervalHours) || Number(v.maintenanceIntervalHours) || 300;
        const warningAdvance = v.oilChangeWarningAdvanceHours !== undefined ? Number(v.oilChangeWarningAdvanceHours) : (Number(v.maintenanceWarningAdvanceHours) || 50);
        const nextMnt = v.nextOilChangeHourmeter !== undefined
          ? Number(v.nextOilChangeHourmeter)
          : (v.nextMaintenanceHourmeter !== undefined ? Number(v.nextMaintenanceHourmeter) : (lastMnt > 0 ? lastMnt + interval : interval));

        const mntAlertId = `alt-oil-${v.id}`;
        const existingMntAlert = cache.alerts.find(a => a.id === mntAlertId || (a.equipmentId === v.id && a.type === 'OIL_CHANGE_DUE'));

        if (!isOilControlActive || v.category === 'IMPLEMENTO') {
          // If oil change control is disabled for this equipment, resolve any existing alert
          if (existingMntAlert && !existingMntAlert.resolved) {
            const resolvedAlert: SmartAlert = cleanUndefined({
              ...existingMntAlert,
              resolved: true,
              resolvedBy: 'Sistema (Controle Desativado)'
            });
            cache.alerts = cache.alerts.map(a => a.id === existingMntAlert.id ? resolvedAlert : a);
            setDoc(doc(db, 'alerts', existingMntAlert.id), resolvedAlert).catch(console.error);
          }
          return;
        }

        if (curHour > 0) {
          if (curHour >= nextMnt) {
            // Overdue / Vencida: 🔴 Troca de óleo vencida
            const delay = curHour - nextMnt;
            const title = `🔴 Troca de óleo vencida: ${v.model}`;
            const desc = `Equipamento: ${v.model}. Horímetro atual: ${curHour}h. Troca prevista: ${nextMnt}h. Atraso: ${delay}h (Intervalo: ${interval}h).`;

            if (!existingMntAlert || existingMntAlert.cycleTargetHourmeter !== nextMnt || existingMntAlert.severity !== 'ALTA') {
              const alertObj: SmartAlert = cleanUndefined({
                id: mntAlertId,
                type: 'OIL_CHANGE_DUE',
                severity: 'ALTA',
                title,
                description: desc,
                equipmentId: v.id,
                equipmentName: v.model,
                date: new Date().toISOString().slice(0, 10),
                resolved: false,
                cycleTargetHourmeter: nextMnt,
                lastOilChangeHourmeter: lastMnt
              });
              cache.alerts = [alertObj, ...cache.alerts.filter(a => a.id !== mntAlertId && !(a.equipmentId === v.id && a.type === 'OIL_CHANGE_DUE'))];
              setDoc(doc(db, 'alerts', mntAlertId), alertObj).catch(console.error);
            } else if (!existingMntAlert.resolved && existingMntAlert.description !== desc) {
              const updated = cleanUndefined({
                ...existingMntAlert,
                title,
                description: desc,
                severity: 'ALTA' as const
              }) as SmartAlert;
              cache.alerts = cache.alerts.map(a => a.id === existingMntAlert.id ? updated : a);
              setDoc(doc(db, 'alerts', existingMntAlert.id), updated).catch(console.error);
            }
          } else if (curHour >= (nextMnt - warningAdvance)) {
            // Near due / Próxima da manutenção: 🟡 Troca de óleo próxima
            const diff = nextMnt - curHour;
            const title = `🟡 Troca de óleo próxima: ${v.model}`;
            const desc = `Equipamento: ${v.model}. Próxima troca: ${nextMnt}h. Horímetro atual: ${curHour}h. Faltam: ${diff}h (Intervalo: ${interval}h).`;

            if (!existingMntAlert || existingMntAlert.cycleTargetHourmeter !== nextMnt || existingMntAlert.severity !== 'MEDIA') {
              const alertObj: SmartAlert = cleanUndefined({
                id: mntAlertId,
                type: 'OIL_CHANGE_DUE',
                severity: 'MEDIA',
                title,
                description: desc,
                equipmentId: v.id,
                equipmentName: v.model,
                date: new Date().toISOString().slice(0, 10),
                resolved: false,
                cycleTargetHourmeter: nextMnt,
                lastOilChangeHourmeter: lastMnt
              });
              cache.alerts = [alertObj, ...cache.alerts.filter(a => a.id !== mntAlertId && !(a.equipmentId === v.id && a.type === 'OIL_CHANGE_DUE'))];
              setDoc(doc(db, 'alerts', mntAlertId), alertObj).catch(console.error);
            }
          } else if (existingMntAlert && !existingMntAlert.resolved) {
            // Machine maintenance has been completed or is well within safe bounds
            const resolvedAlert: SmartAlert = cleanUndefined({
              ...existingMntAlert,
              resolved: true,
              resolvedBy: 'Sistema (Troca de Óleo em Dia)'
            });
            cache.alerts = cache.alerts.map(a => a.id === existingMntAlert.id ? resolvedAlert : a);
            setDoc(doc(db, 'alerts', existingMntAlert.id), resolvedAlert).catch(console.error);
          }
        }
      } else {
        // Km-based maintenance control
        const curKm = Number(v.currentKm) || 0;
        const lastKm = Number(v.lastMaintenanceKm) || 0;
        const intervalKm = Number(v.maintenanceIntervalKm) || 10000;
        const warningAdvanceKm = Number(v.maintenanceWarningAdvanceKm) || 1000;
        const nextKm = v.nextMaintenanceKm !== undefined
          ? Number(v.nextMaintenanceKm)
          : (lastKm > 0 ? lastKm + intervalKm : intervalKm);

        const kmAlertId = `alt-km-${v.id}`;
        const existingKmAlert = cache.alerts.find(a => a.id === kmAlertId);

        if (curKm > 0) {
          if (curKm >= nextKm) {
            const title = `⚠️ Revisão Vencida: ${v.model} (${v.licensePlate})`;
            const desc = `Veículo atingiu ${curKm.toLocaleString('pt-BR')} km (limite: ${nextKm.toLocaleString('pt-BR')} km, intervalo de ${intervalKm.toLocaleString('pt-BR')} km).`;
            
            if (!existingKmAlert) {
              const alertObj: SmartAlert = cleanUndefined({
                id: kmAlertId,
                type: 'PREVENTIVE_MAINTENANCE',
                severity: 'ALTA',
                title,
                description: desc,
                equipmentId: v.id,
                equipmentName: v.model,
                date: new Date().toISOString().slice(0, 10),
                resolved: false
              });
              cache.alerts = [alertObj, ...cache.alerts.filter(a => a.id !== kmAlertId)];
              setDoc(doc(db, 'alerts', kmAlertId), alertObj).catch(console.error);
            }
          } else if (curKm >= (nextKm - warningAdvanceKm)) {
            const diffKm = nextKm - curKm;
            const title = `🟡 Revisão Próxima: ${v.model}`;
            const desc = `Faltam ${diffKm.toLocaleString('pt-BR')} km para a revisão programada de ${nextKm.toLocaleString('pt-BR')} km.`;

            if (!existingKmAlert) {
              const alertObj: SmartAlert = cleanUndefined({
                id: kmAlertId,
                type: 'PREVENTIVE_MAINTENANCE',
                severity: 'MEDIA',
                title,
                description: desc,
                equipmentId: v.id,
                equipmentName: v.model,
                date: new Date().toISOString().slice(0, 10),
                resolved: false
              });
              cache.alerts = [alertObj, ...cache.alerts.filter(a => a.id !== kmAlertId)];
              setDoc(doc(db, 'alerts', kmAlertId), alertObj).catch(console.error);
            }
          } else if (existingKmAlert && !existingKmAlert.resolved) {
            // Vehicle review has been completed or is well within safe bounds
            const resolvedAlert: SmartAlert = cleanUndefined({
              ...existingKmAlert,
              resolved: true,
              resolvedBy: 'Sistema (Revisão em Dia)'
            });
            cache.alerts = cache.alerts.map(a => a.id === existingKmAlert.id ? resolvedAlert : a);
            setDoc(doc(db, 'alerts', existingKmAlert.id), resolvedAlert).catch(console.error);
          }
        }
      }
    });

  } catch (err) {
    console.error('Error checking automated alerts:', err);
  }
}

// Settings Mutator
export async function updateSettings(newSettings: Partial<SystemSettings>): Promise<void> {
  const cleaned = cleanUndefined(newSettings);
  cache.settings = { ...cache.settings, ...cleaned };
  notifyDataUpdated();

  await updateDoc(doc(db, 'settings', 'config'), cleaned);
  logAuditEvent('CONFIGURACAO', 'Sistema', 'Atualizou as configurações gerais do AndradeAgro.');
  checkAutomatedAlerts();
}

export async function updateTankCapacity(capacityLiters: number, currentStockLiters?: number): Promise<void> {
  const validCapacity = Math.max(1000, Number(capacityLiters) || 10000);
  const validStock = currentStockLiters !== undefined ? Math.max(0, Number(currentStockLiters)) : validCapacity;

  // Update primary tank (Quadra)
  await updateCentralTank('tank-quadra', {
    capacityLiters: validCapacity,
    currentStockLiters: validStock
  });
}

// Reset system data in Firestore
export async function resetSystemData(): Promise<void> {
  try {
    await seedCollection('users', INITIAL_USERS);
    await seedCollection('vehicles', INITIAL_VEHICLES);
    await seedCollection('central_tanks', INITIAL_CENTRAL_TANKS);
    await seedCollection('tank_movements', INITIAL_TANK_MOVEMENTS);
    await seedCollection('gas_stations', INITIAL_GAS_STATIONS);
    await seedCollection('fuel_logs', INITIAL_FUEL_LOGS);
    await seedCollection('fuel_refills', INITIAL_FUEL_REFILLS);
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
