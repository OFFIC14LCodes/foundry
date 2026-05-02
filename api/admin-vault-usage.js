import { createClient } from "@supabase/supabase-js";
import { verifyAdminRequest } from "./_lib/tts.js";

async function countExact(queryBuilder) {
  const { count, error } = await queryBuilder;
  if (error) {
    const message = String(error.message || "");
    if (error.code === "PGRST205" || message.includes("could not find the table")) {
      return 0;
    }
    throw error;
  }
  return count ?? 0;
}

async function loadVaultUsageSummary(db, sinceIso) {
  const [
    documentsGenerated,
    vaultDocumentsCreated,
    filesUploaded,
    artifactsSaved,
    signatureRequestsCreated,
    documentsSignedCompleted,
    mockDocumentsSignedCompleted,
    needsWizardRuns,
  ] = await Promise.all([
    countExact(db.from("produced_documents").select("id", { count: "exact", head: true }).gte("created_at", sinceIso)),
    countExact(db.from("documents").select("id", { count: "exact", head: true }).gte("created_at", sinceIso)),
    countExact(db.from("document_files").select("id", { count: "exact", head: true }).gte("created_at", sinceIso).in("file_kind", ["source_upload", "attachment"])),
    countExact(db.from("document_files").select("id", { count: "exact", head: true }).gte("created_at", sinceIso).in("file_kind", ["generated_pdf", "generated_docx", "generated_html", "signed_pdf"])),
    countExact(db.from("document_signature_requests").select("id", { count: "exact", head: true }).gte("created_at", sinceIso)),
    countExact(db.from("document_signature_requests").select("id", { count: "exact", head: true }).eq("status", "completed").gte("completed_at", sinceIso)),
    countExact(db.from("document_signature_requests").select("id", { count: "exact", head: true }).eq("provider", "mock").eq("status", "completed").gte("completed_at", sinceIso)),
    countExact(db.from("product_usage_events").select("id", { count: "exact", head: true }).eq("feature", "document_vault").eq("event_name", "needs_wizard_run").gte("created_at", sinceIso)),
  ]);

  return {
    windowHours: 24,
    sinceIso,
    documentsGenerated,
    vaultDocumentsCreated,
    filesUploaded,
    artifactsSaved,
    signatureRequestsCreated,
    documentsSignedCompleted,
    mockDocumentsSignedCompleted,
    needsWizardRuns,
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    await verifyAdminRequest(req);

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    if (!supabaseUrl || !serviceRoleKey) {
      res.status(500).json({ error: "Supabase admin usage API is not configured" });
      return;
    }

    const db = createClient(supabaseUrl, serviceRoleKey);
    const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const summary = await loadVaultUsageSummary(db, sinceIso);

    res.status(200).json(summary);
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    res.status(statusCode).json({
      error: error instanceof Error ? error.message : "Unable to load vault usage summary",
    });
  }
}
