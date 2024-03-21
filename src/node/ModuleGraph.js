import { cleanUrl } from "./utils";

export class ModuleNode {
  url;
  id;
  importers = new Set();
  importedModules = new Set();
  transformResult = null;
  lastHMRTimestamp = 0;
  constructor(url) {
    this.url = url;
  }
}

export class ModuleGraph {
  urlToModuleMap = new Map();
  idToModuleMap = new Map();

  constructor(resolveId) {
    this.resolveId = resolveId;
  }

  getModuleById(id) {
    return this.idToModuleMap.get(id);
  }

  async getModuleByUrl(rawUrl) {
    const { url } = await this._resolve(rawUrl);
    return this.urlToModuleMap.get(url);
  }

  async ensureEntryFromUrl(rawUrl) {
    const { url, resolvedId } = await this._resolve(rawUrl);
    if (this.urlToModuleMap.has(url)) {
      return this.urlToModuleMap.get(url);
    }

    const mod = new ModuleNode(url);
    mod.id = resolvedId;
    this.urlToModuleMap.set(url, mod);
    this.idToModuleMap.set(resolvedId, mod);
    return mod;
  }

  async updateModuleInfo(mod, importedModules) {
    const prevImports = mod.importedModules;
    for (const curImports of importedModules) {
      const dep =
        typeof curImports === "string"
          ? await this.ensureEntryFromUrl(cleanUrl(curImports))
          : curImports;
      if (dep) {
        mod.importedModules.add(dep);
        dep.importers.add(mod);
      }
    }

    for (const prevImport of prevImports) {
      if (!importedModules.has(prevImport.url)) {
        prevImport.importers.delete(mod);
      }
    }
  }

  invalidateModule(file) {
    const mod = this.idToModuleMap.get(file);
    if (mod) {
      mod.lastHMRTimestamp = Date.now();
      mod.transformResult = null;
      mod.importers.forEach((importer) => {
        this.invalidateModule(importer.id);
      });
    }
  }

  async _resolve(url) {
    const resolved = await this.resolveId(url);
    const resolvedId = resolved.id || url;
    return { url, resolvedId };
  }
}
