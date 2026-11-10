/** A `modules` entry of nuxt.config: a name, `[name, options]`, or a module object. */
type ModuleEntry = unknown;

const nameOf = async (entry: ModuleEntry): Promise<string | undefined> => {
  if (typeof entry === 'string') return entry;
  if (Array.isArray(entry)) return nameOf(entry[0]);
  if (typeof entry === 'function') return (await (entry as { getMeta?: () => Promise<{ name?: string }> }).getMeta?.())?.name;
  return undefined;
};

/**
 * Whether the storefront installs the module `name`: listed in nuxt.config's `modules`, or among the
 * laioutrrc's apps, which frontend-core installs after the modules listed before it. Being resolvable
 * is not enough: a package can be present without being installed as a module.
 */
export const installsModule = async (
  name: string,
  modules: readonly ModuleEntry[],
  laioutrrcApps: readonly { name: string }[] | undefined
): Promise<boolean> => {
  if (laioutrrcApps?.some((app) => app.name === name)) return true;
  const names = await Promise.all(modules.map(nameOf));
  return names.includes(name);
};
