import { Vehicle, FuelLog, UserRole } from '../types';
import { formatDateBR, formatDateTimeBR } from './calculations';

export interface HourmeterValidationParams {
  newHourmeter: number | string | undefined | null;
  equipment: Vehicle | null | undefined;
  previousLogs?: FuelLog[];
  currentDate?: string | Date;
  userRole?: UserRole | string;
  isAuthorizedCorrection?: boolean;
  justification?: string;
}

export interface HourmeterValidationResult {
  isValid: boolean;
  isBlocking: boolean;
  warningType: 'NONE' | 'LOWER_THAN_PREVIOUS' | 'IMPOSSIBLE_INCREASE' | 'SUSPICIOUS_HIGH' | 'EQUAL_READING' | 'EMPTY' | 'INVALID_NUMBER';
  message?: string;
  details?: {
    current: number;
    previous: number;
    diff: number;
    previousDate?: string;
    hoursElapsed?: number;
    daysElapsed?: number;
    maxAllowedIncrease?: number;
    isAuthorizedCorrection?: boolean;
    canAuthorizeCorrection?: boolean;
  };
}

/**
 * Encontra a última leitura válida de horímetro para um equipamento,
 * considerando a ficha técnica do veículo e o histórico de abastecimentos.
 */
export function getLastValidHourmeter(
  equipment: Vehicle | null | undefined,
  previousLogs: FuelLog[] = [],
  currentDate?: string | Date
): {
  lastHourmeter: number;
  lastDate?: string;
  source: 'fuel_log' | 'equipment' | 'none';
} {
  if (!equipment) {
    return { lastHourmeter: 0, source: 'none' };
  }

  // Filtrar logs apenas para este equipamento com horímetro válido
  const relevantLogs = previousLogs
    .filter(l => l.equipmentId === equipment.id && typeof l.hourmeterAtFueling === 'number' && l.hourmeterAtFueling > 0)
    .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());

  // Se houver currentDate, buscar o último registro anterior a este momento
  const refTime = currentDate ? new Date(currentDate).getTime() : Date.now();
  const priorLogs = relevantLogs.filter(l => new Date(l.dateTime).getTime() <= refTime + 60000); // 1 min margin

  const latestLog = priorLogs[0] || relevantLogs[0];

  if (latestLog && typeof latestLog.hourmeterAtFueling === 'number') {
    return {
      lastHourmeter: latestLog.hourmeterAtFueling,
      lastDate: latestLog.dateTime,
      source: 'fuel_log'
    };
  }

  // Se não houver logs de combustível com horímetro, usar o horímetro cadastrado na máquina
  if (equipment.currentHourmeter && equipment.currentHourmeter > 0) {
    return {
      lastHourmeter: equipment.currentHourmeter,
      lastDate: equipment.lastFuelingDate || undefined,
      source: 'equipment'
    };
  }

  return { lastHourmeter: 0, source: 'none' };
}

/**
 * Formata intervalo de horas em texto amigável em português.
 */
export function formatElapsedDuration(hours: number): string {
  if (hours <= 0) return 'menos de 1 minuto';
  if (hours < 1) {
    const mins = Math.max(1, Math.round(hours * 60));
    return `${mins} minuto${mins > 1 ? 's' : ''}`;
  }
  if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  }
  const days = Math.floor(hours / 24);
  const remHours = Math.round(hours % 24);
  if (remHours === 0) {
    return `${days} dia${days > 1 ? 's' : ''}`;
  }
  return `${days} dia${days > 1 ? 's' : ''} e ${remHours}h`;
}

/**
 * Validação inteligente do horímetro conforme as Regras da Andrade Agro:
 * - Regra A: Impedir horímetro inferior ao anterior (bloqueante para funcionário).
 * - Regra B: Detectar aumentos impossíveis pelo tempo transcorrido (máx 24h de operação por dia).
 * - Regra C: Detectar saltos grandes suspeitos (digitação de zero ou dígito a mais).
 * - Regra D: Exibir mensagem clara com números, diferença e orientação do painel.
 * - Exceção Perfil Manutenção: Liberação autorizada com justificativa obrigatória e auditoria.
 */
export function validateHourmeterReading({
  newHourmeter,
  equipment,
  previousLogs = [],
  currentDate,
  userRole,
  isAuthorizedCorrection = false,
  justification = ''
}: HourmeterValidationParams): HourmeterValidationResult {
  // Se o equipamento for veículo rodoviário (KM), a validação de horímetro não se aplica diretamente
  if (equipment?.category === 'VEICULO') {
    return { isValid: true, isBlocking: false, warningType: 'NONE' };
  }

  if (newHourmeter === undefined || newHourmeter === null || String(newHourmeter).trim() === '') {
    return {
      isValid: false,
      isBlocking: true,
      warningType: 'EMPTY',
      message: 'Informe o horímetro atual constante no painel da máquina.'
    };
  }

  const cleanVal = String(newHourmeter).replace(',', '.').trim();
  const currentVal = parseFloat(cleanVal);

  if (isNaN(currentVal) || currentVal < 0) {
    return {
      isValid: false,
      isBlocking: true,
      warningType: 'INVALID_NUMBER',
      message: 'O horímetro informado deve ser um número positivo válido.'
    };
  }

  const { lastHourmeter, lastDate } = getLastValidHourmeter(equipment, previousLogs, currentDate);

  // Se a máquina não tem leitura anterior registrada (primeiro abastecimento)
  if (lastHourmeter <= 0) {
    // Mesmo sem leitura anterior, um valor absurdo como > 100.000h pode ser erro de digitação
    if (currentVal > 100000) {
      return {
        isValid: false,
        isBlocking: true,
        warningType: 'SUSPICIOUS_HIGH',
        message: `Leitura muito elevada (${currentVal.toLocaleString('pt-BR')} h). Confira se não foram digitados zeros a mais em relação ao painel físico da máquina.`,
        details: {
          current: currentVal,
          previous: 0,
          diff: currentVal
        }
      };
    }
    return { isValid: true, isBlocking: false, warningType: 'NONE' };
  }

  const diff = Number((currentVal - lastHourmeter).toFixed(2));
  const canAuthorizeCorrection = userRole === 'MANUTENCAO' || userRole === 'ADMIN';

  // REGRA A: Impedir horímetro inferior ao anterior
  if (diff < 0) {
    const formattedLastDate = lastDate ? formatDateTimeBR(lastDate) : 'último registro';

    // Se o perfil for MANUTENCAO ou ADMIN e acionou a correção autorizada com justificativa válida
    if (canAuthorizeCorrection && isAuthorizedCorrection) {
      const trimmedJust = justification.trim();
      if (trimmedJust.length < 5) {
        return {
          isValid: false,
          isBlocking: true,
          warningType: 'LOWER_THAN_PREVIOUS',
          message: `Horímetro inferior ao anterior (${currentVal.toLocaleString('pt-BR')} h < ${lastHourmeter.toLocaleString('pt-BR')} h). Para confirmar a correção autorizada, informe uma justificativa válida com pelo menos 5 caracteres.`,
          details: {
            current: currentVal,
            previous: lastHourmeter,
            diff,
            previousDate: lastDate,
            canAuthorizeCorrection,
            isAuthorizedCorrection: true
          }
        };
      }

      // Autorizado com sucesso!
      return {
        isValid: true,
        isBlocking: false,
        warningType: 'NONE',
        message: `Correção técnica autorizada: ajuste de ${lastHourmeter.toLocaleString('pt-BR')} h para ${currentVal.toLocaleString('pt-BR')} h (${diff > 0 ? '+' : ''}${diff.toLocaleString('pt-BR')} h).`,
        details: {
          current: currentVal,
          previous: lastHourmeter,
          diff,
          previousDate: lastDate,
          canAuthorizeCorrection,
          isAuthorizedCorrection: true
        }
      };
    }

    // Bloqueio padrão para funcionários (ou manutenção sem ativar a correção)
    return {
      isValid: false,
      isBlocking: true,
      warningType: 'LOWER_THAN_PREVIOUS',
      message: `Horímetro inconsistente. A leitura informada (${currentVal.toLocaleString('pt-BR')} h) é inferior à última leitura registrada (${lastHourmeter.toLocaleString('pt-BR')} h em ${formattedLastDate}), resultando em uma diferença de ${diff.toLocaleString('pt-BR')} h. O horímetro de uma máquina em operação não retrocede. Confira o painel físico da máquina e corrija o valor antes de continuar.`,
      details: {
        current: currentVal,
        previous: lastHourmeter,
        diff,
        previousDate: lastDate,
        canAuthorizeCorrection,
        isAuthorizedCorrection: false
      }
    };
  }

  // REGRA B & C: Detectar aumentos impossíveis pelo tempo transcorrido e saltos suspeitos
  const now = currentDate ? new Date(currentDate) : new Date();
  let hoursElapsed: number | undefined;
  let daysElapsed: number | undefined;

  if (lastDate) {
    const past = new Date(lastDate);
    const msDiff = now.getTime() - past.getTime();
    if (msDiff > 0) {
      hoursElapsed = msDiff / (1000 * 60 * 60);
      daysElapsed = hoursElapsed / 24;
    }
  }

  // Cálculo do limite máximo plausível de trabalho
  // Uma máquina NÃO PODE acumular mais de 24h de trabalho por dia real transcorrido
  let maxAllowedIncrease: number;

  if (hoursElapsed !== undefined) {
    if (hoursElapsed <= 0.5) {
      // Menos de 30 minutos: tolerância pequena de clock skew / ajuste (máx 2.5h)
      maxAllowedIncrease = 2.5;
    } else if (hoursElapsed <= 24) {
      // No mesmo dia: não pode ultrapassar o tempo decorrido mais uma margem de segurança de 2h
      maxAllowedIncrease = Math.min(24, Number((hoursElapsed * 1.05 + 2).toFixed(1)));
    } else {
      // Vários dias (janela histórica de até 10 dias de análise)
      // Limite físico estrito: 24h por dia real transcorrido + margem
      const effectiveDays = Math.min(10, Math.max(1, Math.ceil(daysElapsed || 1)));
      maxAllowedIncrease = Math.round(effectiveDays * 24 + 4);
    }
  } else {
    // Sem data anterior precisa: usar janela de até 10 dias (240h máx)
    maxAllowedIncrease = 240;
  }

  // Detecção de erro de digitação evidente (ex: zero extra, 1450 -> 14500 ou salto > 5x)
  const isTypoExtraDigit = (lastHourmeter > 100 && currentVal >= lastHourmeter * 3 && diff > 80) ||
    (lastHourmeter > 500 && currentVal >= lastHourmeter * 2 && diff > 500);

  const isImpossibleJump = diff > maxAllowedIncrease;

  if (isTypoExtraDigit || isImpossibleJump) {
    const formattedLastDate = lastDate ? formatDateTimeBR(lastDate) : 'última medição';
    const tempoTranscorridoStr = hoursElapsed !== undefined ? formatElapsedDuration(hoursElapsed) : 'período recente';

    // Se perfil MANUTENCAO / ADMIN autorizar expressamente a correção com justificativa
    if (canAuthorizeCorrection && isAuthorizedCorrection) {
      const trimmedJust = justification.trim();
      if (trimmedJust.length < 5) {
        return {
          isValid: false,
          isBlocking: true,
          warningType: 'IMPOSSIBLE_INCREASE',
          message: `Salto expressivo no horímetro (+${diff.toLocaleString('pt-BR')} h). Para confirmar esta correção autorizada, informe uma justificativa válida com pelo menos 5 caracteres.`,
          details: {
            current: currentVal,
            previous: lastHourmeter,
            diff,
            previousDate: lastDate,
            hoursElapsed,
            daysElapsed,
            maxAllowedIncrease,
            canAuthorizeCorrection,
            isAuthorizedCorrection: true
          }
        };
      }

      return {
        isValid: true,
        isBlocking: false,
        warningType: 'NONE',
        message: `Correção técnica autorizada: avanço de +${diff.toLocaleString('pt-BR')} h validado sob justificativa da Manutenção.`,
        details: {
          current: currentVal,
          previous: lastHourmeter,
          diff,
          previousDate: lastDate,
          hoursElapsed,
          daysElapsed,
          maxAllowedIncrease,
          canAuthorizeCorrection,
          isAuthorizedCorrection: true
        }
      };
    }

    const motivo = isTypoExtraDigit 
      ? 'A leitura parece conter dígitos ou zeros a mais digitados acidentalmente.'
      : `Uma máquina não pode trabalhar mais de 24 horas por dia. No intervalo de ${tempoTranscorridoStr}, o avanço máximo permitido é de aproximadamente ${maxAllowedIncrease} horas.`;

    return {
      isValid: false,
      isBlocking: true,
      warningType: isTypoExtraDigit ? 'SUSPICIOUS_HIGH' : 'IMPOSSIBLE_INCREASE',
      message: `Horímetro inconsistente. A leitura informada (${currentVal.toLocaleString('pt-BR')} h) está muito acima da última leitura registrada (${lastHourmeter.toLocaleString('pt-BR')} h em ${formattedLastDate}), gerando uma diferença de +${diff.toLocaleString('pt-BR')} h. ${motivo} Confira o painel físico da máquina e corrija o valor antes de continuar.`,
      details: {
        current: currentVal,
        previous: lastHourmeter,
        diff,
        previousDate: lastDate,
        hoursElapsed,
        daysElapsed,
        maxAllowedIncrease,
        canAuthorizeCorrection,
        isAuthorizedCorrection: false
      }
    };
  }

  // Aviso leve (não bloqueante) se a leitura for idêntica à anterior
  if (diff === 0) {
    return {
      isValid: true,
      isBlocking: false,
      warningType: 'EQUAL_READING',
      message: `Atenção: O horímetro informado (${currentVal.toLocaleString('pt-BR')} h) é idêntico à última leitura registrada. Confirme se a máquina operou entre os abastecimentos.`,
      details: {
        current: currentVal,
        previous: lastHourmeter,
        diff: 0,
        previousDate: lastDate,
        hoursElapsed,
        daysElapsed,
        maxAllowedIncrease,
        canAuthorizeCorrection
      }
    };
  }

  // Valor completamente válido
  return {
    isValid: true,
    isBlocking: false,
    warningType: 'NONE',
    details: {
      current: currentVal,
      previous: lastHourmeter,
      diff,
      previousDate: lastDate,
      hoursElapsed,
      daysElapsed,
      maxAllowedIncrease,
      canAuthorizeCorrection
    }
  };
}

export interface OdometerValidationParams {
  newOdometer: number | string | undefined | null;
  equipment: Vehicle | null | undefined;
  previousLogs?: FuelLog[];
  currentDate?: string | Date;
  userRole?: UserRole | string;
  isAuthorizedCorrection?: boolean;
  justification?: string;
}

export interface OdometerValidationResult {
  isValid: boolean;
  isBlocking: boolean;
  warningType: 'NONE' | 'LOWER_THAN_PREVIOUS' | 'IMPOSSIBLE_INCREASE' | 'SUSPICIOUS_HIGH' | 'EQUAL_READING' | 'EMPTY' | 'INVALID_NUMBER';
  message?: string;
  details?: {
    current: number;
    previous: number;
    diff: number;
    previousDate?: string;
    hoursElapsed?: number;
    daysElapsed?: number;
    maxAllowedIncrease?: number;
    isAuthorizedCorrection?: boolean;
    canAuthorizeCorrection?: boolean;
  };
}

/**
 * Encontra a última leitura válida de odômetro (KM) para um veículo rodoviário,
 * considerando a ficha técnica do veículo e o histórico de abastecimentos.
 */
export function getLastValidOdometer(
  equipment: Vehicle | null | undefined,
  previousLogs: FuelLog[] = [],
  currentDate?: string | Date
): {
  lastOdometer: number;
  lastDate?: string;
  source: 'fuel_log' | 'equipment' | 'none';
} {
  if (!equipment) {
    return { lastOdometer: 0, source: 'none' };
  }

  const relevantLogs = previousLogs
    .filter(l => l.equipmentId === equipment.id && typeof l.kmAtFueling === 'number' && l.kmAtFueling > 0)
    .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());

  const refTime = currentDate ? new Date(currentDate).getTime() : Date.now();
  const priorLogs = relevantLogs.filter(l => new Date(l.dateTime).getTime() <= refTime + 60000);

  const latestLog = priorLogs[0] || relevantLogs[0];

  if (latestLog && typeof latestLog.kmAtFueling === 'number') {
    return {
      lastOdometer: latestLog.kmAtFueling,
      lastDate: latestLog.dateTime,
      source: 'fuel_log'
    };
  }

  if (equipment.currentKm && equipment.currentKm > 0) {
    return {
      lastOdometer: equipment.currentKm,
      lastDate: equipment.lastFuelingDate || undefined,
      source: 'equipment'
    };
  }

  return { lastOdometer: 0, source: 'none' };
}

/**
 * Validação inteligente do odômetro/KM conforme as Regras de Frotas da Andrade Agro:
 * - Regra A: Impedir hodômetro inferior ao anterior (bloqueante para funcionário).
 * - Regra B: Detectar aumentos impossíveis pelo tempo transcorrido (máx 120 km/h médios).
 * - Regra C: Detectar saltos suspeitos por digitação de zero extra.
 * - Exceção Perfil Manutenção/Admin: Liberação autorizada com justificativa obrigatória e auditoria.
 */
export function validateOdometerReading({
  newOdometer,
  equipment,
  previousLogs = [],
  currentDate,
  userRole,
  isAuthorizedCorrection = false,
  justification = ''
}: OdometerValidationParams): OdometerValidationResult {
  // Apenas aplicável a veículos com medição por KM
  if (equipment && equipment.category !== 'VEICULO') {
    return { isValid: true, isBlocking: false, warningType: 'NONE' };
  }

  if (newOdometer === undefined || newOdometer === null || String(newOdometer).trim() === '') {
    return {
      isValid: false,
      isBlocking: true,
      warningType: 'EMPTY',
      message: 'Informe a quilometragem atual constante no painel/odômetro do veículo.'
    };
  }

  const cleanVal = String(newOdometer).replace(',', '.').trim();
  const currentVal = parseFloat(cleanVal);

  if (isNaN(currentVal) || currentVal < 0) {
    return {
      isValid: false,
      isBlocking: true,
      warningType: 'INVALID_NUMBER',
      message: 'A quilometragem informada deve ser um número positivo válido.'
    };
  }

  const { lastOdometer, lastDate } = getLastValidOdometer(equipment, previousLogs, currentDate);

  // Se o veículo não tem leitura anterior registrada
  if (lastOdometer <= 0) {
    if (currentVal > 1500000) {
      return {
        isValid: false,
        isBlocking: true,
        warningType: 'SUSPICIOUS_HIGH',
        message: `Quilometragem excessivamente elevada (${currentVal.toLocaleString('pt-BR')} km). Confira se não foram digitados dígitos a mais em relação ao painel físico.`,
        details: { current: currentVal, previous: 0, diff: currentVal }
      };
    }
    return { isValid: true, isBlocking: false, warningType: 'NONE' };
  }

  const diff = Number((currentVal - lastOdometer).toFixed(1));
  const canAuthorizeCorrection = userRole === 'MANUTENCAO' || userRole === 'ADMIN';

  // REGRA A: Impedir hodômetro inferior ao anterior
  if (diff < 0) {
    const formattedLastDate = lastDate ? formatDateTimeBR(lastDate) : 'último registro';

    if (canAuthorizeCorrection && isAuthorizedCorrection) {
      const trimmedJust = justification.trim();
      if (trimmedJust.length < 5) {
        return {
          isValid: false,
          isBlocking: true,
          warningType: 'LOWER_THAN_PREVIOUS',
          message: `Quilometragem inferior à anterior (${currentVal.toLocaleString('pt-BR')} km < ${lastOdometer.toLocaleString('pt-BR')} km). Para confirmar a correção autorizada, informe uma justificativa válida com pelo menos 5 caracteres.`,
          details: {
            current: currentVal,
            previous: lastOdometer,
            diff,
            previousDate: lastDate,
            canAuthorizeCorrection,
            isAuthorizedCorrection: true
          }
        };
      }

      return {
        isValid: true,
        isBlocking: false,
        warningType: 'NONE',
        message: `Correção técnica autorizada: ajuste de ${lastOdometer.toLocaleString('pt-BR')} km para ${currentVal.toLocaleString('pt-BR')} km (${diff.toLocaleString('pt-BR')} km).`,
        details: {
          current: currentVal,
          previous: lastOdometer,
          diff,
          previousDate: lastDate,
          canAuthorizeCorrection,
          isAuthorizedCorrection: true
        }
      };
    }

    return {
      isValid: false,
      isBlocking: true,
      warningType: 'LOWER_THAN_PREVIOUS',
      message: `Quilometragem inconsistente. A leitura informada (${currentVal.toLocaleString('pt-BR')} km) é inferior à última leitura registrada (${lastOdometer.toLocaleString('pt-BR')} km em ${formattedLastDate}), resultando em uma diferença de ${diff.toLocaleString('pt-BR')} km. O hodômetro de um veículo rodoviário não retrocede. Confira o painel físico do veículo e corrija o valor antes de continuar.`,
      details: {
        current: currentVal,
        previous: lastOdometer,
        diff,
        previousDate: lastDate,
        canAuthorizeCorrection,
        isAuthorizedCorrection: false
      }
    };
  }

  // REGRA B & C: Detectar aumentos impossíveis pelo tempo transcorrido e saltos suspeitos
  const now = currentDate ? new Date(currentDate) : new Date();
  let hoursElapsed: number | undefined;
  let daysElapsed: number | undefined;

  if (lastDate) {
    const past = new Date(lastDate);
    const msDiff = now.getTime() - past.getTime();
    if (msDiff > 0) {
      hoursElapsed = msDiff / (1000 * 60 * 60);
      daysElapsed = hoursElapsed / 24;
    }
  }

  // Limite máximo plausível de deslocamento
  let maxAllowedIncrease: number;

  if (hoursElapsed !== undefined) {
    if (hoursElapsed <= 0.5) {
      maxAllowedIncrease = 80;
    } else if (hoursElapsed <= 24) {
      maxAllowedIncrease = Math.min(2200, Math.round(hoursElapsed * 110 + 100));
    } else {
      const effectiveDays = Math.min(10, Math.max(1, Math.ceil(daysElapsed || 1)));
      maxAllowedIncrease = Math.round(effectiveDays * 2000 + 300);
    }
  } else {
    maxAllowedIncrease = 5000;
  }

  const isTypoExtraDigit = (lastOdometer > 1000 && currentVal >= lastOdometer * 2.5 && diff > 1000) ||
    (lastOdometer > 10000 && currentVal >= lastOdometer * 2 && diff > 5000);

  const isImpossibleJump = diff > maxAllowedIncrease;

  if (isTypoExtraDigit || isImpossibleJump) {
    const formattedLastDate = lastDate ? formatDateTimeBR(lastDate) : 'última medição';
    const tempoTranscorridoStr = hoursElapsed !== undefined ? formatElapsedDuration(hoursElapsed) : 'período recente';

    if (canAuthorizeCorrection && isAuthorizedCorrection) {
      const trimmedJust = justification.trim();
      if (trimmedJust.length < 5) {
        return {
          isValid: false,
          isBlocking: true,
          warningType: 'IMPOSSIBLE_INCREASE',
          message: `Salto expressivo na quilometragem (+${diff.toLocaleString('pt-BR')} km). Para confirmar esta correção autorizada, informe uma justificativa válida com pelo menos 5 caracteres.`,
          details: {
            current: currentVal,
            previous: lastOdometer,
            diff,
            previousDate: lastDate,
            hoursElapsed,
            daysElapsed,
            maxAllowedIncrease,
            canAuthorizeCorrection,
            isAuthorizedCorrection: true
          }
        };
      }

      return {
        isValid: true,
        isBlocking: false,
        warningType: 'NONE',
        message: `Correção técnica autorizada: avanço de +${diff.toLocaleString('pt-BR')} km validado sob justificativa da Manutenção.`,
        details: {
          current: currentVal,
          previous: lastOdometer,
          diff,
          previousDate: lastDate,
          hoursElapsed,
          daysElapsed,
          maxAllowedIncrease,
          canAuthorizeCorrection,
          isAuthorizedCorrection: true
        }
      };
    }

    const motivo = isTypoExtraDigit 
      ? 'A leitura parece conter dígitos ou zeros a mais digitados acidentalmente.'
      : `No intervalo de ${tempoTranscorridoStr}, o deslocamento máximo plausível é de aproximadamente ${maxAllowedIncrease.toLocaleString('pt-BR')} km.`;

    return {
      isValid: false,
      isBlocking: true,
      warningType: isTypoExtraDigit ? 'SUSPICIOUS_HIGH' : 'IMPOSSIBLE_INCREASE',
      message: `Quilometragem inconsistente. A leitura informada (${currentVal.toLocaleString('pt-BR')} km) está muito acima da última leitura registrada (${lastOdometer.toLocaleString('pt-BR')} km em ${formattedLastDate}), gerando uma diferença de +${diff.toLocaleString('pt-BR')} km. ${motivo} Confira o painel físico do veículo e corrija o valor antes de continuar.`,
      details: {
        current: currentVal,
        previous: lastOdometer,
        diff,
        previousDate: lastDate,
        hoursElapsed,
        daysElapsed,
        maxAllowedIncrease,
        canAuthorizeCorrection,
        isAuthorizedCorrection: false
      }
    };
  }

  // Aviso leve se a leitura for idêntica à anterior
  if (diff === 0) {
    return {
      isValid: true,
      isBlocking: false,
      warningType: 'EQUAL_READING',
      message: `Atenção: A quilometragem informada (${currentVal.toLocaleString('pt-BR')} km) é idêntica à última leitura registrada. Confirme se o veículo rodou entre os abastecimentos.`,
      details: {
        current: currentVal,
        previous: lastOdometer,
        diff: 0,
        previousDate: lastDate,
        hoursElapsed,
        daysElapsed,
        maxAllowedIncrease,
        canAuthorizeCorrection
      }
    };
  }

  // Valor completamente válido
  return {
    isValid: true,
    isBlocking: false,
    warningType: 'NONE',
    details: {
      current: currentVal,
      previous: lastOdometer,
      diff,
      previousDate: lastDate,
      hoursElapsed,
      daysElapsed,
      maxAllowedIncrease,
      canAuthorizeCorrection
    }
  };
}
