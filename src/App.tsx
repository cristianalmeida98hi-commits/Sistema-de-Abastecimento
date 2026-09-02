/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  initStorage, getCurrentUser, getUsers, getVehicles, getGasStations, 
  getFuelLogs, getMaintenanceLogs, getAlerts, getAuditLogs, getSettings,
  getMachineIssues, getPreventiveItems, addMachineIssue, resolveMachineIssue, recordPreventiveService,
  addFuelLog, updateFuelLog, deleteFuelLog, addVehicle, updateVehicle, deleteVehicle,
  addMaintenance, updateMaintenance, deleteMaintenance, addGasStation, updateGasStation, deleteGasStation, addUser,
  updateUser, deleteUser, resetUserPassword, resolveAlert, updateSettings, logoutUser,
  getStorageLoadingState, getFirestoreLoadError, StorageLoadingState
} from './utils/storage';
import { User, Vehicle, GasStation, FuelLog, MaintenanceLog, SmartAlert, AuditLog, SystemSettings, MachineIssue, PreventiveMaintenanceItem } from './types';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { CheckCircle2, Tractor, AlertTriangle, RefreshCw } from 'lucide-react';

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
import { QRCodeModuleView } from './components/QRCodeModuleView';
import { MachineDigitalSheetModal } from './components/MachineDigitalSheetModal';
import { OperatorDigitalSheetsView } from './components/OperatorDigitalSheetsView';
import { LoginView } from './components/LoginView';

export default function App() {
  // 1. All useState Hooks grouped strictly at the top
  const [currentUser, setCurrentUser] = useState<User | null>(() => getCurrentUser());
  const [users, setUsers] = useState<User[]>(() => getUsers());
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => getVehicles());
  const [gasStations, setGasStations] = useState<GasStation[]>(() => getGasStations());
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>(() => getFuelLogs());
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>(() => getMaintenanceLogs());
  const [machineIssues, setMachineIssues] = useState<MachineIssue[]>(() => getMachineIssues());
  const [preventiveItems, setPreventiveItems] = useState<PreventiveMaintenanceItem[]>(() => getPreventiveItems());
  const [alerts, setAlerts] = useState<SmartAlert[]>(() => getAlerts());
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => getAuditLogs());
  const [settings, setSettings] = useState<SystemSettings>(() => getSettings());
  const [storageStatus, setStorageStatus] = useState<StorageLoadingState>(() => getStorageLoadingState());

  // UI State
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [loginSuccessMessage, setLoginSuccessMessage] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & Feedback State
  const [isFuelingModalOpen, setIsFuelingModalOpen] = useState<boolean>(false);
  const [preSelectedVehicleId, setPreSelectedVehicleId] = useState<string | undefined>(undefined);
  const [isQRScannerModalOpen, setIsQRScannerModalOpen] = useState<boolean>(false);
  const [selectedDigitalSheetVehicle, setSelectedDigitalSheetVehicle] = useState<Vehicle | null>(null);
  const [fuelingSuccessFeedback, setFuelingSuccessFeedback] = useState<{
    show: boolean;
    liters: number;
    equipmentName: string;
  } | null>(null);

  const darkMode = true;

  // 2. Storage initialization
  useEffect(() => {
    initStorage();
  }, []);

  // 3. Sync state on storage/Firestore updates
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
    setStorageStatus(getStorageLoadingState());
  }, []);

  useEffect(() => {
    window.addEventListener('andradeagro_data_updated', refreshState);
    return () => window.removeEventListener('andradeagro_data_updated', refreshState);
  }, [refreshState]);

  // 4. Sync tab when currentUser changes or logs in
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'FUNCIONARIO') {
        const allowedFuncionarioTabs = ['operator-fueling', 'digital-sheets'];
        if (!allowedFuncionarioTabs.includes(activeTab)) {
          setActiveTab('operator-fueling');
        }
      }
    }
  }, [currentUser, activeTab]);

  // 5. Listen for QR code scans or deep links via URL hash (only when data has finished loading)
  useEffect(() => {
    if (storageStatus === 'LOADING') return;

    const handleHashCheck = () => {
      const hash = window.location.hash;
      if (!hash) return;

      let matchedVehicleId: string | null = null;

      if (hash.includes('vehicle/') || hash.includes('maintenance/') || hash.includes('ficha-maquina/')) {
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
  }, [vehicles, storageStatus]);

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

    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash;
      let matchedVehicleId: string | null = null;
      if (hash.includes('vehicle/') || hash.includes('maintenance/') || hash.includes('ficha-maquina/')) {
        const parts = hash.split('/');
        matchedVehicleId = parts[parts.length - 1];
      } else if (hash.includes('ANDRADEAGRO:')) {
        const parts = hash.split(':');
        matchedVehicleId = parts[1];
      }

      if (matchedVehicleId) {
        const currentVehicles = getVehicles();
        const found = currentVehicles.find(v => v.id === matchedVehicleId || v.licensePlate === matchedVehicleId || v.patrimonyCode === matchedVehicleId);
        if (found) {
          setSelectedDigitalSheetVehicle(found);
          setIsFuelingModalOpen(false);
          setIsQRScannerModalOpen(false);
        }
      }
    }
  };

  const handleOpenFuelingModalWithEquipment = (equipmentId: string) => {
    const currentVehicles = getVehicles();
    const eq = currentVehicles.find(v => v.id === equipmentId);
    if (eq && eq.fuelType === 'NENHUM') {
      alert('Esta máquina/equipamento não possui combustível definido e não pode ser abastecida.');
      return;
    }
    setPreSelectedVehicleId(equipmentId);
    setIsFuelingModalOpen(true);
  };

  const handleAddFuelLog = async (logData: Omit<FuelLog, 'id' | 'createdAt'>) => {
    try {
      await addFuelLog(logData);
      refreshState();

      if (currentUser && currentUser.role === 'FUNCIONARIO') {
        setIsFuelingModalOpen(false);
        setFuelingSuccessFeedback({
          show: true,
          liters: logData.liters,
          equipmentName: logData.equipmentName || 'Equipamento'
        });

        setTimeout(() => {
          setFuelingSuccessFeedback(null);
          logoutUser();
          setCurrentUser(null);
          setLoginSuccessMessage(`✅ Abastecimento de ${logData.liters}L registrado com sucesso!`);
        }, 2200);
      }
    } catch (err: any) {
      console.error('Erro ao salvar abastecimento:', err);
      throw err;
    }
  };

  // If storage is LOADING, render Andrade Agro Loading Screen
  if (storageStatus === 'LOADING') {
    const isScanningQR = typeof window !== 'undefined' && (
      window.location.hash.includes('ficha-maquina') || 
      window.location.hash.includes('vehicle') ||
      window.location.hash.includes('ANDRADEAGRO')
    );

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#031d16] text-slate-100 font-sans">
        <div className="w-full max-w-md p-8 rounded-3xl bg-[#042d23] border border-emerald-800/60 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-[#064E3B] border-2 border-[#FACC15]/40 flex items-center justify-center shadow-lg relative">
            <div className="absolute inset-0 rounded-3xl border-2 border-[#FACC15] animate-ping opacity-20" />
            <Tractor className="w-10 h-10 text-[#FACC15]" />
          </div>

          <div className="space-y-2">
            <div className="inline-block px-3 py-1 rounded-full bg-[#064E3B] text-[#FACC15] text-[10px] font-black tracking-widest uppercase border border-[#FACC15]/30">
              Andrade Agro
            </div>
            <h1 className="text-xl font-black text-white tracking-tight">
              {isScanningQR ? 'Acessando Ficha da Máquina...' : 'Sincronizando Sistema Andrade Agro'}
            </h1>
            <p className="text-xs text-emerald-200/80 leading-relaxed">
              {isScanningQR
                ? 'Localizando equipamento e sincronizando histórico de manutenção e abastecimento...'
                : 'Conectando ao banco de dados e sincronizando frotas, combustíveis e manutenções em tempo real...'}
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <div className="w-full bg-emerald-950/80 rounded-full h-2 overflow-hidden border border-emerald-800/60">
              <div className="bg-gradient-to-r from-emerald-500 via-[#FACC15] to-emerald-400 h-full w-2/3 rounded-full animate-pulse" />
            </div>
            <div className="flex items-center justify-between text-[10px] text-emerald-400/80 font-semibold px-1">
              <span>Status: Conectando</span>
              <span>Aguarde um instante</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If storage is ERROR, render Connection Error Screen
  if (storageStatus === 'ERROR') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#031d16] text-slate-100 font-sans">
        <div className="w-full max-w-md p-8 rounded-3xl bg-[#042d23] border border-rose-900/60 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-950/80 border border-rose-800 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-rose-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-black text-white">Falha na Conexão com o Banco de Dados</h2>
            <p className="text-xs text-rose-200/80">
              {getFirestoreLoadError() || 'Não foi possível conectar ao Firestore. Verifique sua conexão com a internet ou tente recarregar.'}
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-transform active:scale-95"
          >
            Tentar Reconectar
          </button>
        </div>
      </div>
    );
  }

  // If not authenticated, render Login Screen
  if (!currentUser) {
    return (
      <LoginView
        onLoginSuccess={handleLoginSuccess}
        darkMode={darkMode}
        successMessage={loginSuccessMessage}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-row font-sans antialiased bg-[#031d16] text-slate-100 dark">
      
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onNavigate={(tab) => { setActiveTab(tab); setIsMobileMenuOpen(false); }}
        onLogout={handleLogout}
        currentUser={currentUser}
        alerts={alerts}
        darkMode={darkMode}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
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
          onNavigate={(tab) => { setActiveTab(tab); setIsMobileMenuOpen(false); }}
          alerts={alerts}
          darkMode={darkMode}
          searchQuery={searchQuery}
          onSearchChange={(q) => setSearchQuery(q)}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />

        {/* Content View Container */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 overflow-y-auto max-w-[1600px] w-full mx-auto">
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
                settings={settings}
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

            {activeTab === 'digital-sheets' && (
              <OperatorDigitalSheetsView
                vehicles={vehicles}
                users={users}
                currentUser={currentUser}
                maintenanceLogs={maintenanceLogs}
                fuelLogs={fuelLogs}
                preventiveItems={preventiveItems}
                alerts={alerts}
                machineIssues={machineIssues}
                onOpenDigitalSheet={(v) => setSelectedDigitalSheetVehicle(v)}
                onOpenQRScanner={() => setIsQRScannerModalOpen(true)}
                darkMode={darkMode}
                searchQuery={searchQuery}
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
                onDeleteStation={(id) => deleteGasStation(id)}
                darkMode={darkMode}
              />
            )}

            {activeTab === 'staff' && (
              <StaffView
                users={users}
                currentUser={currentUser}
                onAddUser={(u) => addUser(u)}
                onUpdateUser={(id, fields) => updateUser(id, fields)}
                onDeleteUser={(id) => deleteUser(id)}
                onResetPassword={(id, newPass) => resetUserPassword(id, newPass)}
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
        </main>
      </div>

      {/* Global Modals */}
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
          onClose={() => {
            setSelectedDigitalSheetVehicle(null);
            if (typeof window !== 'undefined' && window.location.hash) {
              history.pushState("", document.title, window.location.pathname + window.location.search);
            }
          }}
          vehicle={vehicles.find(v => v.id === selectedDigitalSheetVehicle.id) || selectedDigitalSheetVehicle}
          fuelLogs={fuelLogs}
          maintenanceLogs={maintenanceLogs}
          machineIssues={machineIssues}
          preventiveItems={preventiveItems}
          currentUser={currentUser}
          initialTab="OVERVIEW"
          onAddMaintenance={(m) => { addMaintenance(m); refreshState(); }}
          onUpdateMaintenance={(id, fields) => { updateMaintenance(id, fields); refreshState(); }}
          onDeleteMaintenance={(id) => { deleteMaintenance(id); refreshState(); }}
          onReportProblemSubmit={(issueData) => { addMachineIssue(issueData); refreshState(); }}
          onRecordPreventiveService={(equipmentId, itemKey, currentHourmeter, notes) => { recordPreventiveService(equipmentId, itemKey, currentHourmeter, notes); refreshState(); }}
          onResolveIssue={(issueId) => { resolveMachineIssue(issueId); refreshState(); }}
          onUpdateVehicleStatus={(vehicleId, newStatus) => { updateVehicle(vehicleId, { status: newStatus }); refreshState(); }}
          darkMode={darkMode}
        />
      )}

      {/* Fueling Success Feedback Toast / Overlay (Problem 4) */}
      {fuelingSuccessFeedback?.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-emerald-950 border-2 border-amber-400 p-6 sm:p-8 rounded-3xl text-center space-y-4 max-w-sm w-full shadow-2xl animate-in zoom-in-95">
            <div className="w-16 h-16 bg-emerald-500 text-gray-950 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/30 animate-bounce">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-white">✅ Abastecimento Salvo!</h3>
              <p className="text-sm font-bold text-amber-400">
                {fuelingSuccessFeedback.liters} Litros Registrados
              </p>
              <p className="text-xs text-emerald-200">
                {fuelingSuccessFeedback.equipmentName}
              </p>
            </div>
            <div className="p-2.5 bg-emerald-900/60 rounded-xl text-[11px] text-emerald-300 font-medium">
              Redirecionando para a tela inicial...
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
