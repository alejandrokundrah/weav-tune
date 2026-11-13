// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { appearanceOf, DEFAULT_APPEARANCE, useAppearance } from './appearance';
it('recovers invalid persisted choices without losing valid preferences', () => {
  expect(appearanceOf(null)).toEqual(DEFAULT_APPEARANCE);
  expect(appearanceOf({ mode: 'invalid', accent: 'url(example)', pureBlack: false, playerStyle: 'vinyl' }))
    .toEqual({ ...DEFAULT_APPEARANCE, pureBlack: false, playerStyle: 'vinyl' });
});
it('saves appearance changes independently and round-trips across reloads', () => {
  useAppearance.getState().update({ mode: 'dark', playerStyle: 'polaroid', motion: false, replicaGlass: false });
  const saved = appearanceOf(JSON.parse(localStorage.getItem('weav:appearance')!));
  expect(saved).toMatchObject({ mode: 'dark', playerStyle: 'polaroid', motion: false, replicaGlass: false });
  expect(saved.accent).toBe(DEFAULT_APPEARANCE.accent);
});
it('defaults the replica shell on for old saved appearances and honors an explicit choice', () => {
  expect(appearanceOf({}).replicaGlass).toBe(true);
  expect(appearanceOf({ replicaGlass: 'invalid' }).replicaGlass).toBe(true);
  expect(appearanceOf({ replicaGlass: false }).replicaGlass).toBe(false);
});
