import { requireAdminApiContext, sendAdminApiError } from "../../_lib/admin.js";
import { loadFounderList, parseListQuery } from "../_lib/founderRoutes.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { serviceClient } = await requireAdminApiContext(req);
    const query = parseListQuery(req);
    const payload = await loadFounderList(serviceClient, query);
    res.status(200).json(payload);
  } catch (error) {
    sendAdminApiError(res, error, "Unable to load founders");
  }
}
