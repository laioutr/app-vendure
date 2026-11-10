import { describe, expect, it } from 'vitest';
import { installsModule } from './installedModules';

const moduleObject = (name: string) => Object.assign(() => undefined, { getMeta: async () => ({ name }) });

describe('installsModule', () => {
  it('finds a module listed by name, with options, as a module object, or among the laioutrrc apps', async () => {
    expect(await installsModule('@laioutr-app/ui', ['@pinia/nuxt', '@laioutr-app/ui'], undefined)).toBe(true);
    expect(await installsModule('@laioutr-app/ui', [['@laioutr-app/ui', {}]], undefined)).toBe(true);
    expect(await installsModule('@laioutr-app/ui', [moduleObject('@laioutr-app/ui')], undefined)).toBe(true);
    expect(await installsModule('@laioutr-app/ui', [], [{ name: '@laioutr-app/ui' }])).toBe(true);
  });

  it('does not count a package that is only present, not installed as a module', async () => {
    expect(
      await installsModule('@laioutr-app/ui', ['@pinia/nuxt', moduleObject('@laioutr/app-vendure')], [{ name: '@laioutr/app-vendure' }])
    ).toBe(false);
  });
});
