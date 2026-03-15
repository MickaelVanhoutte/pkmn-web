export type SpriteVariant = 'front' | 'back' | 'front-shiny' | 'back-shiny';

const VARIANT_DIRS: Record<SpriteVariant, string> = {
  front: 'gen5',
  back: 'gen5-back',
  'front-shiny': 'gen5-shiny',
  'back-shiny': 'gen5-back-shiny',
};

export function getSpriteUrl(speciesId: string, variant: SpriteVariant): string {
  const dir = VARIANT_DIRS[variant];
  return `./sprites/${dir}/${speciesId}.png`;
}
