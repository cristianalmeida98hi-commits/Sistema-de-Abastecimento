/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  initStorage, getCurrentUser, getUsers, getVehicles, getGasStations, 
  getFuelLogs, getMaintenanceLogs, getAlerts, getAuditLogs, getSettings,
  addFuelLog, updateFuelLog, deleteFuelLog, addVehicle, updateVehicle, deleteVehicle,
  addMaintenance, updateMaintenance, addGasStation, updateGasStation, addUser,
  updateUser, resolveAlert, updateSettings
} from './utils/storage';
import { User, Vehicle, GasStation, FuelLog, MaintenanceLog, SmartAlert, AuditLog, SystemSettings } from './types';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { FuelLogsView } from './components/FuelLogsView';
import { FleetManagementView } from './components/FleetManagementView';
import { MaintenanceView } from './components/MaintenanceView';
import { GasStationsView } from './components/GasStationsView';
import { StaffView } from './components/StaffView';
import { ReportsView } from './components/ReportsView';
import { AlertsView } from './components/AlertsView';
import { AuditLogsView } from './components/AuditLogsView';
import { SettingsAndAboutView } from './components/SettingsAndAboutView';
import { OperatorFuelingView } from './components/OperatorFuelingView';
import { FuelingFormModal } from './components/FuelingFormModal';
import { QRCodeScannerModal } from './components/QRCodeScannerModal';

export default function App() {
  // Init Local Storage Seed
  useEffect(() => {
    initStorage();
  }, []);

  // State
  const [currentUser, setCurrentUser] = useState<User>(getCurrentUser());
  const [users, setUsers] = useState<User[]>(getUsers());
  const [vehicles, setVehicles] = useState<Vehicle[]>(getVehicles());
  const [gasStations, setGasStations] = useState<GasStation[]>(getGasStations());
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>(getFuelLogs());
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>(getMaintenanceLogs());
  const [alerts, setAlerts] = useState<SmartAlert[]>(getAlerts());
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(getAuditLogs());
  const [settings, setSettings] = useState<SystemSettings>(getSettings());

  // UI State
  const [activeTab, setActiveTab] = useState<string>(
    currentUser.role === 'FUNCIONARIO' ? 'operator-fueling' : 'dashboard'
  );

  // Sync tab on user role change
  useEffect(() => {
    if (currentUser.role === 'FUNCIONARIO') {
      if (activeTab !== 'operator-fueling' && activeTab !== 'my-fuel-logs') {
        setActiveTab('operator-fueling');
      }
    } else if (currentUser.role === 'ADMIN') {
      if (activeTab === 'operator-fueling' || activeTab === 'my-fuel-logs') {
        setActiveTab('dashboard');
      }
    }
  }, [currentUser]);
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isFuelingModalOpen, setIsFuelingModalOpen] = useState<boolean>(false);
  const [preSelectedVehicleId, setPreSelectedVehicleId] = useState<string | undefined>(undefined);
  const [isQRScannerModalOpen, setIsQRScannerModalOpen] = useState<boolean>(false);

  // Sync state on updates
  const refreshState = () => {
    setCurrentUser(getCurrentUser());
    setUsers(getUsers());
    setVehicles(getVehicles());
    setGasStations(getGasStations());
    setFuelLogs(getFuelLogs());
    setMaintenanceLogs(getMaintenanceLogs());
    setAlerts(getAlerts());
    setAuditLogs(getAuditLogs());
    setSettings(getSettings());
  };

  useEffect(() => {
    const handleUpdate = () => refreshState();
    window.addEventListener('andradeagro_data_updated', handleUpdate);
    return () => window.removeEventListener('andradeagro_data_updated', handleUpdate);
  }, []);

  // Handlers
  const handleOpenFuelingModalWithEquipment = (equipmentId: string) => {
    setPreSelectedVehicleId(equipmentId);
    setIsFuelingModalOpen(true);
  };

  const handleAddFuelLog = (logData: Omit<FuelLog, 'id' | 'createdAt'>) => {
    addFuelLog(logData);
    refreshState();
  };

  return (
    <div className={`min-h-screen flex flex-row font-sans antialiased transition-colors duration-300 ${
      darkMode ? 'bg-[#031d16] text-slate-100 dark' : 'bg-[#F8FAFC] text-slate-800'
    }`}>
      
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onNavigate={(tab) => setActiveTab(tab)}
        currentUser={currentUser}
        alerts={alerts}
        darkMode={darkMode}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Top Header */}
        <Header
          currentUser={currentUser}
          onUserChanged={(u) => { setCurrentUser(u); refreshState(); }}
          onOpenFuelingModal={() => { setPreSelectedVehicleId(undefined); setIsFuelingModalOpen(true); }}
          onOpenQRScanner={() => setIsQRScannerModalOpen(true)}
          onNavigate={(tab) => setActiveTab(tab)}
          alerts={alerts}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode(!darkMode)}
          searchQuery={searchQuery}
          onSearchChange={(q) => setSearchQuery(q)}
        />

        {/* Content View Container */}
        <main className="flex-1 p-6 sm:p-8 overflow-y-auto max-w-[1600px] w-full mx-auto">
          
          {activeTab === 'operator-fueling' && (
            <OperatorFuelingView
              currentUser={currentUser}
              vehicles={vehicles}
              gasStations={gasStations}
              onAddFuelLog={handleAddFuelLog}
              userLogs={fuelLogs}
              darkMode={darkMode}
            />
          )}

          {activeTab === 'my-fuel-logs' && (
            <FuelLogsView
              fuelLogs={fuelLogs.filter(l => l.createdById === currentUser.id || l.driverOrOperatorId === currentUser.id)}
              vehicles={vehicles}
              gasStations={gasStations}
              users={users}
              currentUser={currentUser}
              settings={settings}
              onOpenFuelingModal={() => { setPreSelectedVehicleId(undefined); setIsFuelingModalOpen(true); }}
              onUpdateFuelLog={(id, fields) => { updateFuelLog(id, fields); refreshState(); }}
              onDeleteFuelLog={(id) => { deleteFuelLog(id); refreshState(); }}
              darkMode={darkMode}
              searchQuery={searchQuery}
            />
          )}

          {activeTab === 'dashboard' && (
            <DashboardView
              fuelLogs={fuelLogs}
              vehicles={vehicles}
              onOpenFuelingModal={() => { setPreSelectedVehicleId(undefined); setIsFuelingModalOpen(true); }}
              onNavigate={(tab) => setActiveTab(tab)}
              darkMode={darkMode}
            />
          )}

          {activeTab === 'fuel-logs' && (
            <FuelLogsView
              fuelLogs={fuelLogs}
              vehicles={vehicles}
              gasStations={gasStations}
              users={users}
              currentUser={currentUser}
              settings={settings}
              onOpenFuelingModal={() => { setPreSelectedVehicleId(undefined); setIsFuelingModalOpen(true); }}
              onUpdateFuelLog={(id, fields) => { updateFuelLog(id, fields); refreshState(); }}
              onDeleteFuelLog={(id) => { deleteFuelLog(id); refreshState(); }}
              darkMode={darkMode}
              searchQuery={searchQuery}
            />
          )}

          {activeTab === 'fleet' && (
            <FleetManagementView
              vehicles={vehicles}
              users={users}
              currentUser={currentUser}
              maintenanceLogs={maintenanceLogs}
              fuelLogs={fuelLogs}
              onAddVehicle={(v) => { addVehicle(v); refreshState(); }}
              onUpdateVehicle={(id, fields) => { updateVehicle(id, fields); refreshState(); }}
              onDeleteVehicle={(id) => { deleteVehicle(id); refreshState(); }}
              onOpenFuelingModalWithEquipment={handleOpenFuelingModalWithEquipment}
              darkMode={darkMode}
            />
          )}

          {activeTab === 'maintenance' && (
            <MaintenanceView
              maintenanceLogs={maintenanceLogs}
              vehicles={vehicles}
              users={users}
              currentUser={currentUser}
              onAddMaintenance={(m) => { addMaintenance(m); refreshState(); }}
              onUpdateMaintenance={(id, fields) => { updateMaintenance(id, fields); refreshState(); }}
              darkMode={darkMode}
            />
          )}

          {activeTab === 'stations' && (
            <GasStationsView
              gasStations={gasStations}
              onAddStation={(stn) => { addGasStation(stn); refreshState(); }}
              onUpdateStation={(id, fields) => { updateGasStation(id, fields); refreshState(); }}
              darkMode={darkMode}
            />
          )}

          {activeTab === 'staff' && (
            <StaffView
              users={users}
              currentUser={currentUser}
              onAddUser={(u) => { addUser(u); refreshState(); }}
              onUpdateUser={(id, fields) => { updateUser(id, fields); refreshState(); }}
              darkMode={darkMode}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              fuelLogs={fuelLogs}
              vehicles={vehicles}
              gasStations={gasStations}
              users={users}
              settings={settings}
              darkMode={darkMode}
            />
          )}

          {activeTab === 'alerts' && (
            <AlertsView
              alerts={alerts}
              currentUser={currentUser}
              onResolveAlert={(id) => { resolveAlert(id); refreshState(); }}
              darkMode={darkMode}
            />
          )}

          {activeTab === 'audit' && (
            <AuditLogsView
              auditLogs={auditLogs}
              darkMode={darkMode}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsAndAboutView
              settings={settings}
              currentUser={currentUser}
              onUpdateSettings={(newSettings) => { updateSettings(newSettings); refreshState(); }}
              darkMode={darkMode}
            />
          )}

        </main>
      </div>

      {/* Global Modals */}
      <FuelingFormModal
        isOpen={isFuelingModalOpen}
        onClose={() => setIsFuelingModalOpen(false)}
        onSubmit={handleAddFuelLog}
        vehicles={vehicles}
        gasStations={gasStations}
        users={users}
        currentUser={currentUser}
        previousLogs={fuelLogs}
        settings={settings}
        preSelectedVehicleId={preSelectedVehicleId}
        darkMode={darkMode}
      />

      <QRCodeScannerModal
        isOpen={isQRScannerModalOpen}
        onClose={() => setIsQRScannerModalOpen(false)}
        vehicles={vehicles}
        onOpenFuelingModalWithEquipment={handleOpenFuelingModalWithEquipment}
        darkMode={darkMode}
      />

    </div>
  );
}
