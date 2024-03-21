import { isImportRequest } from "../../utils";
import sirv from "sirv";
export function staticMiddleware(serverContext) {
  const serverFromRoot = sirv(serverContext.root, { dev: true });
  return async (req, res, next) => {
    console.log("static中");
    if (!req.url) return;
    if (isImportRequest(req.url)) {
      return;
    }
    return serverFromRoot(req, res, next);
  };
}
