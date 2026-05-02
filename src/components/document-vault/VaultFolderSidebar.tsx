import type { ChangeEvent, RefObject } from "react";
import type { DocumentFolder, DocumentStatus } from "../../db";
import { STAGE_LABELS, type FolderFilter, type StageFilter, type VaultStatusFilter } from "./shared";

export default function VaultFolderSidebar(props: {
    folders: DocumentFolder[];
    loading: boolean;
    error: string | null;
    selectedFolderFilter: FolderFilter;
    onSelectFolder: (value: FolderFilter) => void;
    folderActionId: string | null;
    onRenameFolder: (folder: DocumentFolder) => void;
    onDeleteFolder: (folder: DocumentFolder) => void;
    newFolderName: string;
    onNewFolderNameChange: (value: string) => void;
    onCreateFolder: () => void;
    creatingFolder: boolean;
    search: string;
    onSearchChange: (value: string) => void;
    statusFilter: VaultStatusFilter;
    onStatusFilterChange: (value: VaultStatusFilter) => void;
    stageFilter: StageFilter;
    onStageFilterChange: (value: StageFilter) => void;
    categoryFilter: string;
    onCategoryFilterChange: (value: string) => void;
    searchInputRef: RefObject<HTMLInputElement | null>;
    categories: string[];
    documentStatusLabels: Record<DocumentStatus, string>;
}) {
    const {
        folders, loading, error, selectedFolderFilter, onSelectFolder, folderActionId, onRenameFolder,
        onDeleteFolder, newFolderName, onNewFolderNameChange, onCreateFolder, creatingFolder, search,
        onSearchChange, statusFilter, onStatusFilterChange, stageFilter, onStageFilterChange,
        categoryFilter, onCategoryFilterChange, searchInputRef, categories, documentStatusLabels,
    } = props;

    return (
        <>
            <div style={{
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.07)",
                background: "rgba(255,255,255,0.025)",
                padding: 16,
            }}>
                <div style={{ fontSize: 11, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
                    Folders
                </div>
                <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
                    <button
                        onClick={() => onSelectFolder("all")}
                        style={{ width: "100%", textAlign: "left", padding: "9px 11px", borderRadius: 10, border: selectedFolderFilter === "all" ? "1px solid rgba(232,98,42,0.2)" : "1px solid rgba(255,255,255,0.07)", background: selectedFolderFilter === "all" ? "rgba(232,98,42,0.08)" : "rgba(255,255,255,0.018)", color: selectedFolderFilter === "all" ? "#E8622A" : "#C8C4BE", fontSize: 12, cursor: "pointer", fontFamily: "'Lora', Georgia, serif" }}
                    >
                        All documents
                    </button>
                    <button
                        onClick={() => onSelectFolder("unfiled")}
                        style={{ width: "100%", textAlign: "left", padding: "9px 11px", borderRadius: 10, border: selectedFolderFilter === "unfiled" ? "1px solid rgba(232,98,42,0.2)" : "1px solid rgba(255,255,255,0.07)", background: selectedFolderFilter === "unfiled" ? "rgba(232,98,42,0.08)" : "rgba(255,255,255,0.018)", color: selectedFolderFilter === "unfiled" ? "#E8622A" : "#C8C4BE", fontSize: 12, cursor: "pointer", fontFamily: "'Lora', Georgia, serif" }}
                    >
                        Unfiled
                    </button>
                    {loading && <div style={{ fontSize: 12, color: "#666", padding: "6px 2px" }}>Loading folders...</div>}
                    {!loading && error && <div style={{ fontSize: 12, color: "#D28B76", lineHeight: 1.6 }}>{error}</div>}
                    {!loading && !error && folders.length === 0 && (
                        <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6, padding: "6px 2px" }}>
                            No folders yet. Create one to organize your vault.
                        </div>
                    )}
                    {!loading && !error && folders.map((folder) => (
                        <div key={folder.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
                            <button
                                onClick={() => onSelectFolder(folder.id)}
                                style={{ width: "100%", textAlign: "left", padding: "9px 11px", borderRadius: 10, border: selectedFolderFilter === folder.id ? "1px solid rgba(232,98,42,0.2)" : "1px solid rgba(255,255,255,0.07)", background: selectedFolderFilter === folder.id ? "rgba(232,98,42,0.08)" : "rgba(255,255,255,0.018)", color: selectedFolderFilter === folder.id ? "#E8622A" : "#C8C4BE", fontSize: 12, cursor: "pointer", fontFamily: "'Lora', Georgia, serif" }}
                            >
                                {folder.name}
                            </button>
                            <div style={{ display: "flex", gap: 6 }}>
                                <button
                                    onClick={() => onRenameFolder(folder)}
                                    disabled={folderActionId === folder.id}
                                    style={{ padding: "5px 8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#888", fontSize: 10, cursor: folderActionId === folder.id ? "wait" : "pointer", fontFamily: "'Lora', Georgia, serif" }}
                                >
                                    Rename
                                </button>
                                <button
                                    onClick={() => onDeleteFolder(folder)}
                                    disabled={folderActionId === folder.id}
                                    style={{ padding: "5px 8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#888", fontSize: 10, cursor: folderActionId === folder.id ? "wait" : "pointer", fontFamily: "'Lora', Georgia, serif" }}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                    <input
                        value={newFolderName}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => onNewFolderNameChange(event.target.value)}
                        placeholder="Create folder"
                        style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "9px 11px", color: "#F0EDE8", fontSize: 12, fontFamily: "'Lora', Georgia, serif", boxSizing: "border-box" }}
                    />
                    <button
                        onClick={onCreateFolder}
                        disabled={creatingFolder}
                        style={{ padding: "9px 11px", background: creatingFolder ? "rgba(255,255,255,0.06)" : "rgba(232,98,42,0.08)", border: creatingFolder ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(232,98,42,0.18)", borderRadius: 10, color: creatingFolder ? "#777" : "#E8622A", fontSize: 11, fontWeight: 600, cursor: creatingFolder ? "wait" : "pointer", fontFamily: "'Lora', Georgia, serif" }}
                    >
                        {creatingFolder ? "Creating..." : "Create"}
                    </button>
                </div>
            </div>

            <div style={{
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.07)",
                background: "rgba(255,255,255,0.025)",
                padding: 16,
            }}>
                <div style={{ fontSize: 11, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
                    Search & Filter
                </div>
                <div style={{ position: "relative", marginBottom: 10 }}>
                    <div style={{ position: "absolute", left: 12, top: 12, fontSize: 14, color: "#555" }}>⌕</div>
                    <input
                        ref={searchInputRef}
                        value={search}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => onSearchChange(event.target.value)}
                        placeholder="Search title, doc type, or category"
                        style={{
                            width: "100%",
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.09)",
                            borderRadius: 12,
                            padding: "10px 12px 10px 38px",
                            color: "#F0EDE8",
                            fontSize: 13,
                            fontFamily: "'Lora', Georgia, serif",
                            boxSizing: "border-box",
                        }}
                    />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                    <select
                        value={statusFilter}
                        onChange={(event) => onStatusFilterChange(event.target.value as VaultStatusFilter)}
                        style={{
                            width: "100%",
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.09)",
                            borderRadius: 12,
                            padding: "10px 12px",
                            color: "#F0EDE8",
                            fontSize: 12,
                            fontFamily: "'Lora', Georgia, serif",
                            boxSizing: "border-box",
                            colorScheme: "dark",
                        }}
                    >
                        <option value="active">Active documents</option>
                        <option value="all">All documents</option>
                        {Object.entries(documentStatusLabels).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                    <select
                        value={categoryFilter}
                        onChange={(event) => onCategoryFilterChange(event.target.value)}
                        style={{
                            width: "100%",
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.09)",
                            borderRadius: 12,
                            padding: "10px 12px",
                            color: "#F0EDE8",
                            fontSize: 12,
                            fontFamily: "'Lora', Georgia, serif",
                            boxSizing: "border-box",
                            colorScheme: "dark",
                        }}
                    >
                        <option value="all">All categories</option>
                        {categories.map((value) => (
                            <option key={value} value={value}>{value}</option>
                        ))}
                    </select>
                </div>
                <select
                    value={stageFilter}
                    onChange={(event) => onStageFilterChange(event.target.value as StageFilter)}
                    style={{
                        width: "100%",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.09)",
                        borderRadius: 12,
                        padding: "10px 12px",
                        color: "#F0EDE8",
                        fontSize: 12,
                        fontFamily: "'Lora', Georgia, serif",
                        boxSizing: "border-box",
                        colorScheme: "dark",
                    }}
                >
                    <option value="all">All stages</option>
                    {[1, 2, 3, 4, 5, 6].map((stage) => (
                        <option key={stage} value={String(stage)}>Stage {stage}: {STAGE_LABELS[stage]}</option>
                    ))}
                </select>
            </div>
        </>
    );
}
