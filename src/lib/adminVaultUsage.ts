import { supabase } from "../supabase";

export interface AdminVaultUsageSummary {
    windowHours: number;
    sinceIso: string;
    documentsGenerated: number;
    vaultDocumentsCreated: number;
    filesUploaded: number;
    artifactsSaved: number;
    signatureRequestsCreated: number;
    documentsSignedCompleted: number;
    mockDocumentsSignedCompleted: number;
    needsWizardRuns: number;
}

export async function loadAdminVaultUsage(): Promise<AdminVaultUsageSummary> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
        throw new Error("Missing active session");
    }

    const response = await fetch("/api/admin-vault-usage", {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail.slice(0, 200) || `Vault usage API ${response.status}`);
    }

    return response.json();
}
