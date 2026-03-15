import type { TypeName } from '../types';
import typeChartData from '../../data/type-chart.json';

const chart = typeChartData as Record<TypeName, Record<TypeName, number>>;

export function getSingleTypeEffectiveness(attackType: TypeName, defendType: TypeName): number {
  return chart[attackType]?.[defendType] ?? 1;
}

export function getTypeEffectiveness(attackType: TypeName, defenderTypes: TypeName[]): number {
  return defenderTypes.reduce(
    (mult, defType) => mult * getSingleTypeEffectiveness(attackType, defType),
    1.0,
  );
}

export function getEffectivenessLabel(effectiveness: number): 'immune' | 'not-very-effective' | 'neutral' | 'super-effective' {
  if (effectiveness === 0) return 'immune';
  if (effectiveness < 1) return 'not-very-effective';
  if (effectiveness > 1) return 'super-effective';
  return 'neutral';
}
