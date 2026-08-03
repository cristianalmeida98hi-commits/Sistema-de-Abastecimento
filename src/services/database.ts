import { 
  collection, doc, getDocs, deleteDoc 
} from 'firebase/firestore';
import { db, safeSetDoc, safeUpdateDoc } from '../lib/firebase';
import { 
  User, Vehicle, GasStation, FuelLog, MaintenanceLog 
} from '../types';
import { 
  getVehicles, getUsers, getFuelLogs, getMaintenanceLogs, getGasStations 
} from '../utils/storage';

// Online Central Firebase Firestore Database Service Layer
export const databaseService = {
  // MACHINES / VEHICLES
  async getMachines(): Promise<Vehicle[]> {
    try {
      const snapshot = await getDocs(collection(db, 'vehicles'));
      if (!snapshot.empty) {
        return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Vehicle));
      }
    } catch (e) {
      console.error('[databaseService] Error getting machines:', e);
    }
    return getVehicles();
  },

  async addMachine(machine: Vehicle): Promise<boolean> {
    try {
      await safeSetDoc(doc(db, 'vehicles', machine.id), machine);
      return true;
    } catch (e) {
      console.error('[databaseService] Error adding machine:', e);
      return false;
    }
  },

  async updateMachine(id: string, fields: Partial<Vehicle>): Promise<boolean> {
    try {
      await safeUpdateDoc(doc(db, 'vehicles', id), fields);
      return true;
    } catch (e) {
      console.error('[databaseService] Error updating machine:', e);
      return false;
    }
  },

  async deleteMachine(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(db, 'vehicles', id));
      return true;
    } catch (e) {
      console.error('[databaseService] Error deleting machine:', e);
      return false;
    }
  },

  // EMPLOYEES / USERS
  async getEmployees(): Promise<User[]> {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      if (!snapshot.empty) {
        return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as User));
      }
    } catch (e) {
      console.error('[databaseService] Error getting employees:', e);
    }
    return getUsers();
  },

  async addEmployee(user: User): Promise<boolean> {
    try {
      await safeSetDoc(doc(db, 'users', user.id), user);
      return true;
    } catch (e) {
      console.error('[databaseService] Error adding employee:', e);
      return false;
    }
  },

  async updateEmployee(id: string, fields: Partial<User>): Promise<boolean> {
    try {
      await safeUpdateDoc(doc(db, 'users', id), fields);
      return true;
    } catch (e) {
      console.error('[databaseService] Error updating employee:', e);
      return false;
    }
  },

  async deleteEmployee(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(db, 'users', id));
      return true;
    } catch (e) {
      console.error('[databaseService] Error deleting employee:', e);
      return false;
    }
  },

  // FUEL RECORDS / ABASTECIMENTOS
  async getFuelRecords(): Promise<FuelLog[]> {
    try {
      const snapshot = await getDocs(collection(db, 'fuel_logs'));
      if (!snapshot.empty) {
        return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as FuelLog));
      }
    } catch (e) {
      console.error('[databaseService] Error getting fuel records:', e);
    }
    return getFuelLogs();
  },

  async addFuelRecord(log: FuelLog): Promise<boolean> {
    try {
      await safeSetDoc(doc(db, 'fuel_logs', log.id), log);
      return true;
    } catch (e) {
      console.error('[databaseService] Error adding fuel record:', e);
      return false;
    }
  },

  async deleteFuelRecord(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(db, 'fuel_logs', id));
      return true;
    } catch (e) {
      console.error('[databaseService] Error deleting fuel record:', e);
      return false;
    }
  },

  // MAINTENANCE RECORDS / MANUTENÇÕES
  async getMaintenanceRecords(): Promise<MaintenanceLog[]> {
    try {
      const snapshot = await getDocs(collection(db, 'maintenance_logs'));
      if (!snapshot.empty) {
        return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as MaintenanceLog));
      }
    } catch (e) {
      console.error('[databaseService] Error getting maintenance records:', e);
    }
    return getMaintenanceLogs();
  },

  async addMaintenanceRecord(log: MaintenanceLog): Promise<boolean> {
    try {
      await safeSetDoc(doc(db, 'maintenance_logs', log.id), log);
      return true;
    } catch (e) {
      console.error('[databaseService] Error adding maintenance record:', e);
      return false;
    }
  },

  async updateMaintenanceRecord(id: string, fields: Partial<MaintenanceLog>): Promise<boolean> {
    try {
      await safeUpdateDoc(doc(db, 'maintenance_logs', id), fields);
      return true;
    } catch (e) {
      console.error('[databaseService] Error updating maintenance record:', e);
      return false;
    }
  },

  async deleteMaintenanceRecord(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(db, 'maintenance_logs', id));
      return true;
    } catch (e) {
      console.error('[databaseService] Error deleting maintenance record:', e);
      return false;
    }
  },

  // GAS STATIONS / POSTOS
  async getGasStations(): Promise<GasStation[]> {
    try {
      const snapshot = await getDocs(collection(db, 'gas_stations'));
      if (!snapshot.empty) {
        return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as GasStation));
      }
    } catch (e) {
      console.error('[databaseService] Error getting gas stations:', e);
    }
    return getGasStations();
  },

  async addGasStation(station: GasStation): Promise<boolean> {
    try {
      await safeSetDoc(doc(db, 'gas_stations', station.id), station);
      return true;
    } catch (e) {
      console.error('[databaseService] Error adding gas station:', e);
      return false;
    }
  },

  async updateGasStation(id: string, fields: Partial<GasStation>): Promise<boolean> {
    try {
      await safeUpdateDoc(doc(db, 'gas_stations', id), fields);
      return true;
    } catch (e) {
      console.error('[databaseService] Error updating gas station:', e);
      return false;
    }
  },

  async deleteGasStation(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(db, 'gas_stations', id));
      return true;
    } catch (e) {
      console.error('[databaseService] Error deleting gas station:', e);
      return false;
    }
  }
};
