import { 
  User, Vehicle, GasStation, FuelLog, MaintenanceLog, SmartAlert, AuditLog, SystemSettings, MachineIssue, PreventiveMaintenanceItem 
} from '../types';

export interface DatabaseState {
  andradeagro_users_v1?: User[];
  andradeagro_vehicles_v1?: Vehicle[];
  andradeagro_gas_stations_v1?: GasStation[];
  andradeagro_fuel_logs_v1?: FuelLog[];
  andradeagro_maintenance_logs_v1?: MaintenanceLog[];
  andradeagro_machine_issues_v1?: MachineIssue[];
  andradeagro_preventive_items_v1?: PreventiveMaintenanceItem[];
  andradeagro_alerts_v1?: SmartAlert[];
  andradeagro_audit_logs_v1?: AuditLog[];
  andradeagro_settings_v1?: SystemSettings;
}

// Online Central Database API Service Layer
export const databaseService = {
  // Fetch entire shared database from online server
  async fetchFullDatabase(): Promise<{ version: number; data: DatabaseState } | null> {
    try {
      const response = await fetch('/api/db', {
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('[DatabaseService] Error fetching full database:', error);
      return null;
    }
  },

  // Save specific collection/key to online server
  async saveKey<T>(key: string, value: T): Promise<boolean> {
    try {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      });
      return response.ok;
    } catch (error) {
      console.error(`[DatabaseService] Error saving key ${key}:`, error);
      return false;
    }
  },

  // MACHINES / VEHICLES
  async getMachines(): Promise<Vehicle[]> {
    try {
      const res = await fetch('/api/machines');
      if (res.ok) return await res.json();
    } catch (e) {}
    const db = await this.fetchFullDatabase();
    return db?.data?.andradeagro_vehicles_v1 || [];
  },

  async addMachine(machine: Vehicle): Promise<boolean> {
    try {
      const res = await fetch('/api/machines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(machine)
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  },

  async updateMachine(id: string, fields: Partial<Vehicle>): Promise<boolean> {
    try {
      const res = await fetch(`/api/machines/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  },

  async deleteMachine(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/machines/${id}`, { method: 'DELETE' });
      return res.ok;
    } catch (e) {
      return false;
    }
  },

  // EMPLOYEES / USERS
  async getEmployees(): Promise<User[]> {
    try {
      const res = await fetch('/api/employees');
      if (res.ok) return await res.json();
    } catch (e) {}
    const db = await this.fetchFullDatabase();
    return db?.data?.andradeagro_users_v1 || [];
  },

  async addEmployee(user: User): Promise<boolean> {
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  },

  async updateEmployee(id: string, fields: Partial<User>): Promise<boolean> {
    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  },

  async deleteEmployee(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' });
      return res.ok;
    } catch (e) {
      return false;
    }
  },

  // FUEL RECORDS / ABASTECIMENTOS
  async getFuelRecords(): Promise<FuelLog[]> {
    try {
      const res = await fetch('/api/fuel-records');
      if (res.ok) return await res.json();
    } catch (e) {}
    const db = await this.fetchFullDatabase();
    return db?.data?.andradeagro_fuel_logs_v1 || [];
  },

  async addFuelRecord(log: FuelLog): Promise<boolean> {
    try {
      const res = await fetch('/api/fuel-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log)
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  },

  async deleteFuelRecord(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/fuel-records/${id}`, { method: 'DELETE' });
      return res.ok;
    } catch (e) {
      return false;
    }
  },

  // MAINTENANCE RECORDS / MANUTENÇÕES
  async getMaintenanceRecords(): Promise<MaintenanceLog[]> {
    try {
      const res = await fetch('/api/maintenance');
      if (res.ok) return await res.json();
    } catch (e) {}
    const db = await this.fetchFullDatabase();
    return db?.data?.andradeagro_maintenance_logs_v1 || [];
  },

  async addMaintenanceRecord(log: MaintenanceLog): Promise<boolean> {
    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log)
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  },

  async updateMaintenanceRecord(id: string, fields: Partial<MaintenanceLog>): Promise<boolean> {
    try {
      const res = await fetch(`/api/maintenance/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  },

  async deleteMaintenanceRecord(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/maintenance/${id}`, { method: 'DELETE' });
      return res.ok;
    } catch (e) {
      return false;
    }
  },

  // GAS STATIONS / POSTOS
  async getGasStations(): Promise<GasStation[]> {
    try {
      const res = await fetch('/api/gas-stations');
      if (res.ok) return await res.json();
    } catch (e) {}
    const db = await this.fetchFullDatabase();
    return db?.data?.andradeagro_gas_stations_v1 || [];
  },

  async addGasStation(station: GasStation): Promise<boolean> {
    try {
      const res = await fetch('/api/gas-stations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(station)
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  },

  async updateGasStation(id: string, fields: Partial<GasStation>): Promise<boolean> {
    try {
      const res = await fetch(`/api/gas-stations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  },

  async deleteGasStation(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/gas-stations/${id}`, { method: 'DELETE' });
      return res.ok;
    } catch (e) {
      return false;
    }
  }
};
