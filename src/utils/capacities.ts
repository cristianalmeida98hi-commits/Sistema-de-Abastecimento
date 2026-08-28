import { OperationalCapacity, OperationalCapacityType, Vehicle, MachineSubtype } from '../types';

export function getCapacityTypeLabel(type: OperationalCapacityType): string {
  switch (type) {
    case 'COMBUSTIVEL':
      return 'Tanque de Combustível';
    case 'PULVERIZACAO':
      return 'Tanque de Pulverização / Calda';
    case 'ADUBO':
      return 'Capacidade / Depósito de Adubo';
    case 'SEMENTE':
      return 'Depósito de Sementes / Graneleiro';
    case 'CACAMBA':
      return 'Caçamba de Carga';
    case 'RESERVATORIO':
      return 'Reservatório de Água / Fluidos';
    case 'CARGA':
      return 'Capacidade de Carga';
    case 'OUTRO':
    default:
      return 'Capacidade Operacional';
  }
}

export function getCapacityTypeEmoji(type: OperationalCapacityType): string {
  switch (type) {
    case 'COMBUSTIVEL':
      return '⛽';
    case 'PULVERIZACAO':
      return '🧪';
    case 'ADUBO':
      return '🌾';
    case 'SEMENTE':
      return '🌱';
    case 'CACAMBA':
      return '🚜';
    case 'RESERVATORIO':
      return '💧';
    case 'CARGA':
      return '⚖️';
    case 'OUTRO':
    default:
      return '📦';
  }
}

export function getDefaultUnitForType(type: OperationalCapacityType): string {
  switch (type) {
    case 'COMBUSTIVEL':
    case 'PULVERIZACAO':
    case 'RESERVATORIO':
      return 'L';
    case 'ADUBO':
    case 'CARGA':
      return 'kg';
    case 'CACAMBA':
      return 'm³';
    case 'SEMENTE':
      return 'L';
    case 'OUTRO':
    default:
      return 'L';
  }
}

export const COMMON_UNITS = ['L', 'kg', 't', 'm³', 'sacas', 'unidades'];

export function getMachineSubtypeName(subtype?: MachineSubtype | string): string {
  if (!subtype) return 'Geral';
  switch (subtype) {
    case 'PULVERIZADOR':
      return 'Pulverizador Autopropelido / Arrasto';
    case 'COLHEITADEIRA':
      return 'Colheitadeira de Grãos';
    case 'DISTRIBUIDOR_ADUBO':
      return 'Distribuidor de Adubo / Calcário';
    case 'PLANTADEIRA_SEMEADORA':
      return 'Plantadeira / Semeadora';
    case 'ESCAVADEIRA':
      return 'Escavadeira Hidráulica';
    case 'RETROESCAVADEIRA':
      return 'Retroescavadeira';
    case 'PA_CARREGADEIRA':
      return 'Pá Carregadeira';
    case 'MOTONIVELADORA':
      return 'Motoniveladora';
    case 'IMPLEMENTO':
      return 'Implemento / Grade / Arado';
    case 'CARRETA_AGRICOLA':
      return 'Carreta Agrícola / Basculante';
    case 'OUTRO':
      return 'Outro Equipamento';
    default:
      return subtype;
  }
}

/**
 * Retorna as capacidades operacionais do veículo consolidadas,
 * garantindo compatibilidade com registros antigos que possuem apenas
 * tankCapacityLiters ou sprayingTankCapacityLiters.
 */
export function getConsolidatedCapacities(vehicle: Vehicle): OperationalCapacity[] {
  if (Array.isArray(vehicle.operationalCapacities)) {
    return vehicle.operationalCapacities;
  }

  const generated: OperationalCapacity[] = [];

  // Tanque de pulverização
  if ((vehicle.sprayingTankCapacityLiters || 0) > 0 || vehicle.hasSprayingTank || vehicle.sector === 'PULVERIZACAO' || vehicle.machineSubtype === 'PULVERIZADOR') {
    if ((vehicle.sprayingTankCapacityLiters || 0) > 0) {
      generated.push({
        id: 'legacy-spray',
        type: 'PULVERIZACAO',
        name: 'Tanque de Pulverização',
        value: vehicle.sprayingTankCapacityLiters || 0,
        unit: 'L',
        notes: 'Calda / Defensivos'
      });
    }
  }

  // Tanque de combustível (apenas se tiver combustível e capacidade > 0)
  if (vehicle.fuelType && vehicle.fuelType !== 'NENHUM' && (vehicle.tankCapacityLiters || 0) > 0) {
    generated.push({
      id: 'legacy-fuel',
      type: 'COMBUSTIVEL',
      name: 'Tanque de Combustível',
      value: vehicle.tankCapacityLiters,
      unit: 'L'
    });
  }

  return generated;
}
