import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  externals: ['defu', '@parcel/watcher', '@laioutr-core/frontend-core', '@laioutr-core/kit', '@laioutr-core/orchestr'],
  hooks: {
    // Tests sit beside the code they cover; they are not part of the package.
    'mkdist:entry:options'(_context, _entry, options) {
      options.pattern = ['**', '!**/*.test.ts'];
    },
  },
});
