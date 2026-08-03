/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { 
  initStorage, getCurrentUser, getUsers, getVehicles, getGasStations, 
  getFuelLogs, getMaintenanceLogs, getAlerts, getAuditLogs, getSettings,
  getMachineIssues, getPreventiveItems, addMachineIssue, resolveMachineIssue, recordPreventiveService,
  addFuelLog, updateFuelLog, deleteFuelLog, addVehicle, updateVehicle, deleteVehicle,
  addMaintenance, updateMaintenance, deleteMaintenance, addGasStation, updateGasStation, addUser,
  updateUser, resolveAlert, updateSettings, logoutUser
} from './utils/storage';
import { User, Vehicle, GasStation, FuelLog, MaintenanceLog, SmartAlert, AuditLog, SystemSettings, MachineIssue, PreventiveMaintenanceItem } from './types';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';

// Lazy Loaded Views & Modals for optimum initial loading performance
const DashboardView = React.lazy(() => import('./components/DashboardView').then(m => ({ default: m.DashboardView })));
const FuelLogsView = React.lazy(() => import('./components/FuelLogsView').then(m => ({ default: m.FuelLogsView })));
const FleetManagementView = React.lazy(() => import('./components/FleetManagementView').then(m => ({ default: m.FleetManagementView })));
const MaintenanceView = React.lazy(() => import('./components/MaintenanceView').then(m => ({ default: m.MaintenanceView })));
const GasStationsView = React.lazy(() => import('./components/GasStationsView').then(m => ({ default: m.GasStationsView })));
const StaffView = React.lazy(() => import('./components/StaffView').then(m => ({ default: m.StaffView })));
const ReportsView = React.lazy(() => import('./components/ReportsView').then(m => ({ default: m.ReportsView })));
const AlertsView = React.lazy(() => import('./components/AlertsView').then(m => ({ default: m.AlertsView })));
const AuditLogsView = React.lazy(() => import('./components/AuditLogsView').then(m => ({ default: m.AuditLogsView })));
const SettingsAndAboutView = React.lazy(() => import('./components/SettingsAndAboutView').then(m => ({ default: m.SettingsAndAboutView })));
const OperatorFuelingView = React.lazy(() => import('./components/OperatorFuelingView').then(m => ({ default: m.OperatorFuelingView })));
const FuelingFormModal = React.lazy(() => import('./components/FuelingFormModal').then(m => ({ default: m.FuelingFormModal })));
const QRCodeScannerModal = React.lazy(() => import('./components/QRCodeScannerModal').then(m => ({ default: m.QRCodeScannerModal })));
const QRCodeModuleView = React.lazy(() => import('./components/QRCodeModuleView').then(m => ({ default: m.QRCodeModuleView })));
const MachineDigitalSheetModal = React.lazy(() => import('./components/MachineDigitalSheetModal').then(m => ({ default: m.MachineDigitalSheetModal })));
const LoginView = React.lazy(() => import('./components/LoginView').then(m => ({ default: m.LoginView })));

const ViewLoader = () => (
  <div className="flex items-center justify-center min-h-[300px] w-full">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
  </div>
);

export default function App() {
  // Init Local Storage Seed
  useEffect(() => {
    initStorage();
  }, []);

  // State
  const [currentUser, setCurrentUser] = useState<User | null>(getCurrentUser());
  const [users, setUsers] = useState<User[]>(getUsers());
  const [vehicles, setVehicles] = useState<Vehicle[]>(getVehicles());
  const [gasStations, setGasStations] = useState<GasStation[]>(getGasStations());
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>(getFuelLogs());
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>(getMaintenanceLogs());
  const [machineIssues, setMachineIssues] = useState<MachineIssue[]>(getMachineIssues());
  const [preventiveItems, setPreventiveItems] = useState<PreventiveMaintenanceItem[]>(getPreventiveItems());
  const [alerts, setAlerts] = useState<SmartAlert[]>(getAlerts());
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(getAuditLogs());
  const [settings, setSettings] = useState<SystemSettings>(getSettings());

  // UI State
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [loginSuccessMessage, setLoginSuccessMessage] = useState<string | null>(null);

  // Sync tab when currentUser changes or logs in
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'FUNCIONARIO') {
        if (
          activeTab !== 'operator-fueling' && 
          activeTab !== 'my-fuel-logs' && 
          activeTab !== 'qr-codes' && 
          activeTab !== 'maintenance'
        ) {
          setActiveTab('operator-fueling');
        }
      }
    }
  }, [currentUser, activeTab]);

  const darkMode = true;
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isFuelingModalOpen, setIsFuelingModalOpen] = useState<boolean>(false);
  const [preSelectedVehicleId, setPreSelectedVehicleId] = useState<string | undefined>(undefined);
  const [isQRScannerModalOpen, setIsQRScannerModalOpen] = useState<boolean>(false);
  const [selectedDigitalSheetVehicle, setSelectedDigitalSheetVehicle] = useState<Vehicle | null>(null);

  // Sync state on updates
  const refreshState = useCallback(() => {
    const freshUser = getCurrentUser();
    setCurrentUser(freshUser);
    setUsers(getUsers());
    setVehicles(getVehicles());
    setGasStations(getGasStations());
    setFuelLogs(getFuelLogs());
    setMaintenanceLogs(getMaintenanceLogs());
    setMachineIssues(getMachineIssues());
    setPreventiveItems(getPreventiveItems());
    setAlerts(getAlerts());
    setAuditLogs(getAuditLogs());
    setSettings(getSettings());
  }, []);

  useEffect(() => {
    window.addEventListener('andradeagro_data_updated', refreshState);
    return () => window.removeEventListener('andradeagro_data_updated', refreshState);
  }, [refreshState]);

  // Listen for QR code scans or deep links via URL hash (e.g. #maintenance/v1 or #vehicle/v1)
  useEffect(() => {
    const handleHashCheck = () => {
      const hash = window.location.hash;
      if (!hash) return;

      let matchedVehicleId: string | null = null;

      if (hash.includes('vehicle/') || hash.includes('maintenance/')) {
        const parts = hash.split('/');
        matchedVehicleId = parts[parts.length - 1];
      } else if (hash.includes('ANDRADEAGRO:')) {
        const parts = hash.split(':');
        matchedVehicleId = parts[1];
      }

      if (matchedVehicleId) {
        const found = vehicles.find(v => v.id === matchedVehicleId || v.licensePlate === matchedVehicleId || v.patrimonyCode === matchedVehicleId);
        if (found) {
          setSelectedDigitalSheetVehicle(found);
          setIsFuelingModalOpen(false);
          setIsQRScannerModalOpen(false);
        }
      }
    };

    handleHashCheck();
    window.addEventListener('hashchange', handleHashCheck);
    return () => window.removeEventListener('hashchange', handleHashCheck);
  }, [vehicles]);

  // Handlers
  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setLoginSuccessMessage(null);
    if (user.role === 'FUNCIONARIO') {
      setActiveTab('operator-fueling');
    } else {
      setActiveTab('dashboard');
    }
  };

  const handleOpenFuelingModalWithEquipment = (equipmentId: string) => {
    setPreSelectedVehicleId(equipmentId);
    setIsFuelingModalOpen(true);
  };

  const handleAddFuelLog = (logData: Omit<FuelLog, 'id' | 'createdAt'>) => {
    addFuelLog(logData);
    refreshState();
    
    // Auto logout back to login screen as requested
    logoutUser();
    setCurrentUser(null);
    setLoginSuccessMessage('Abastecimento registrado com sucesso! O sistema retornou para a tela de login.');
  };

  // 1. If not authenticated, render Login Screen
  if (!currentUser) {
    return (
      <Suspense fallback={<ViewLoader />}>
        <LoginView
          onLoginSuccess={handleLoginSuccess}
          darkMode={darkMode}
          successMessage={loginSuccessMessage}
        />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen flex flex-row font-sans antialiased bg-[#031d16] text-slate-100 dark">
      
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onNavigate={(tab) => setActiveTab(tab)}
        onLogout={handleLogout}
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
          onLogout={handleLogout}
          onOpenFuelingModal={() => { setPreSelectedVehicleId(undefined); setIsFuelingModalOpen(true); }}
          onOpenQRScanner={() => setIsQRScannerModalOpen(true)}
          onNavigate={(tab) => setActiveTab(tab)}
          alerts={alerts}
          darkMode={darkMode}
          searchQuery={searchQuery}
          onSearchChange={(q) => setSearchQuery(q)}
        />

        {/* Content View Container */}
        <main className="flex-1 p-6 sm:p-8 overflow-y-auto max-w-[1600px] w-full mx-auto">
          <Suspense fallback={<ViewLoader />}>
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
                onUpdateFuelLog={(id, fields) => updateFuelLog(id, fields)}
                onDeleteFuelLog={(id) => deleteFuelLog(id)}
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
                onUpdateFuelLog={(id, fields) => updateFuelLog(id, fields)}
                onDeleteFuelLog={(id) => deleteFuelLog(id)}
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
                onAddVehicle={(v) => addVehicle(v)}
                onUpdateVehicle={(id, fields) => updateVehicle(id, fields)}
                onDeleteVehicle={(id) => deleteVehicle(id)}
                onOpenFuelingModalWithEquipment={handleOpenFuelingModalWithEquipment}
                onOpenDigitalSheet={(v) => setSelectedDigitalSheetVehicle(v)}
                darkMode={darkMode}
              />
            )}

            {activeTab === 'qr-codes' && (
              <QRCodeModuleView
                vehicles={vehicles}
                fuelLogs={fuelLogs}
                currentUser={currentUser}
                onOpenDigitalSheet={(v) => setSelectedDigitalSheetVehicle(v)}
                darkMode={darkMode}
              />
            )}

            {activeTab === 'maintenance' && (
              <MaintenanceView
                maintenanceLogs={maintenanceLogs}
                vehicles={vehicles}
                users={users}
                currentUser={currentUser}
                onAddMaintenance={(m) => addMaintenance(m)}
                onUpdateMaintenance={(id, fields) => updateMaintenance(id, fields)}
                onDeleteMaintenance={(id) => deleteMaintenance(id)}
                darkMode={darkMode}
              />
            )}

            {activeTab === 'stations' && (
              <GasStationsView
                gasStations={gasStations}
                onAddStation={(stn) => addGasStation(stn)}
                onUpdateStation={(id, fields) => updateGasStation(id, fields)}
                darkMode={darkMode}
              />
            )}

            {activeTab === 'staff' && (
              <StaffView
                users={users}
                currentUser={currentUser}
                onAddUser={(u) => addUser(u)}
                onUpdateUser={(id, fields) => updateUser(id, fields)}
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
                onResolveAlert={(id) => resolveAlert(id)}
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
                onUpdateSettings={(newSettings) => updateSettings(newSettings)}
                darkMode={darkMode}
              />
            )}
          </Suspense>
        </main>
      </div>

      {/* Global Modals */}
      <Suspense fallback={null}>
        {isFuelingModalOpen && (
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
        )}

        {isQRScannerModalOpen && (
          <QRCodeScannerModal
            isOpen={isQRScannerModalOpen}
            onClose={() => setIsQRScannerModalOpen(false)}
            vehicles={vehicles}
            fuelLogs={fuelLogs}
            onOpenDigitalSheet={(v) => setSelectedDigitalSheetVehicle(v)}
            darkMode={darkMode}
          />
        )}

        {selectedDigitalSheetVehicle && (
          <MachineDigitalSheetModal
            isOpen={!!selectedDigitalSheetVehicle}
            onClose={() => setSelectedDigitalSheetVehicle(null)}
            vehicle={selectedDigitalSheetVehicle}
            fuelLogs={fuelLogs}
            maintenanceLogs={maintenanceLogs}
            machineIssues={machineIssues}
            preventiveItems={preventiveItems}
            currentUser={currentUser}
            initialTab="HISTORY"
            onAddMaintenance={(m) => addMaintenance(m)}
            onUpdateMaintenance={(id, fields) => updateMaintenance(id, fields)}
            onDeleteMaintenance={(id) => deleteMaintenance(id)}
            onReportProblemSubmit={(issueData) => addMachineIssue(issueData)}
            onRecordPreventiveService={(equipmentId, itemKey, currentHourmeter, notes) => recordPreventiveService(equipmentId, itemKey, currentHourmeter, notes)}
            onResolveIssue={(issueId) => resolveMachineIssue(issueId)}
            onUpdateVehicleStatus={(vehicleId, newStatus) => updateVehicle(vehicleId, { status: newStatus })}
            darkMode={darkMode}
          />
        )}
      </Suspense>

    </div>
  );
}
