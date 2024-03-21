console.log("[vite] connecting");

const socket = new WebSocket(`ws://localhost:__HMR_PORT__`, "vite-hmr");

socket.addEventListener("message", async ({ data }) => {
  handleMessage(JSON.parse(data)).catch(console.error);
});

async function handleMessage(payload) {
  switch (payload.type) {
    case "connected":
      console.log(`[vite] connected.`);
      setInterval(() => socket.send("ping"), 1000);
      break;
    case "update":
      payload.updates.forEach((update) => {
        if (update.type === "js-update") {
          fetchUpdate(update);
        }
        // else if (update.type === "css-update") {
        //   updateStyle(update.path);
        // }
      });
      break;
  }
}

const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.innerHTML = content;
    document.head.appendChild(style);
  } else {
    style.innerHTML = content;
  }
  sheetsMap.set(id, style);
}

export function remoteStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
  }
  sheetsMap.delete(id);
}

async function fetchUpdate({ path, timestamp }) {
  const mod = hotModulesMap.get(path);
  if (!mod) return;

  const moduleMap = new Map();
  const modulesToUpdate = new Set();
  modulesToUpdate.add(path);

  await Promise.all(
    Array.from(modulesToUpdate).map(async (dep) => {
      const [path, query] = dep.split(",");
      try {
        const newMod = await import(
          path + `?t=${timestamp}${query ? `${query}` : ""}`
        );
        moduleMap.set(dep, newMod);
      } catch (e) {}
    })
  );
  return () => {
    for (const { deps, fn } of mod.callbacks) {
      fn(deps.map((dep) => moduleMap.get(dep)));
    }
    console.log(`[vite] hot updated: ${path}`);
  };
}

const hotModulesMap = new Map();
const pruneMap = new Map();

export const createHotContext = (ownerPath) => {
  const mod = hotModulesMap.get(ownerPath);
  if (mod) {
    mod.callbacks = [];
  }

  function acceptDeps(deps, callback) {
    const mod = hotModulesMap.get(ownerPath) || {
      id: ownerPath,
      callbacks: [],
    };
    mod.callbacks.push({
      deps,
      fn: callback,
    });
    hotModulesMap.set(ownerPath, mod);
  }

  return {
    accept(deps, callback) {
      if (typeof deps === "function" || !deps) {
        acceptDeps([ownerPath], ([mod]) => deps && deps(mod));
      }
    },

    prune(cb) {
      pruneMap.set(ownerPath, cb);
    },
  };
};
