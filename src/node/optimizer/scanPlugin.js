import { BARE_IMPORT_RE, EXTERNAL_TYPES } from "../constants";

export function scanPlugin(deps) {
  return {
    name: "esbuild:scan-deps",
    setup(build) {
      build.onResolve(
        {
          filter: new RegExp(`\\.(${EXTERNAL_TYPES.join("|")})$`),
        },
        (resolveInfo) => {
          return {
            path: resolveInfo.path,
            external: true,
          };
        }
      );

      build.onResolve({ filter: BARE_IMPORT_RE }, (resolveInfo) => {
        const { path: id } = resolveInfo;
        deps.add(id);
        return {
          path: id,
          external: true,
        };
      });
    },
  };
}
