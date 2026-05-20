import { useMemo, useState } from "react";
import type { CofounderWorkspaceSummary } from "../lib/cofounderDb";
import type { ForgeMemorySource } from "../lib/forgeMemory";

type Props = {
    workspaces: CofounderWorkspaceSummary[];
    onSelectPersonal: () => void;
    onSelectWorkspace: (workspaceId: string) => void;
    onSubmitCustom: (label: string) => void;
    onDismiss: () => void;
    suggestedReason?: string | null;
    source?: ForgeMemorySource | string | null;
};

export default function ForgeContextApplyCard({
    workspaces,
    onSelectPersonal,
    onSelectWorkspace,
    onSubmitCustom,
    onDismiss,
    suggestedReason = null,
    source = null,
}: Props) {
    const [customOpen, setCustomOpen] = useState(false);
    const [customLabel, setCustomLabel] = useState("");

    const sourceLabel = useMemo(() => {
        if (!source) return null;
        return String(source).replace(/_/g, " ");
    }, [source]);

    return (
        <div className="forge-context-card foundry-panel-in">
            <div className="forge-context-card__header">
                <div>
                    <div className="foundry-label forge-context-card__eyebrow">
                        {sourceLabel ? `Context · ${sourceLabel}` : "Navi Context"}
                    </div>
                    <div className="forge-context-card__title">Where should Navi apply this?</div>
                </div>
                <button className="forge-context-card__dismiss" onClick={onDismiss} aria-label="Dismiss context prompt">
                    ×
                </button>
            </div>

            <div className="forge-context-card__subtitle">
                Choose whether this should stay private or connect to a shared business workspace.
            </div>

            {suggestedReason && (
                <div className="forge-context-card__reason">{suggestedReason}</div>
            )}

            <div className="forge-context-card__options">
                <button className="forge-context-option" onClick={onSelectPersonal}>
                    <span className="forge-context-option__title">Personal work</span>
                    <span className="forge-context-option__meta">Private to your account</span>
                </button>

                {workspaces.map((workspace) => (
                    <button
                        key={workspace.id}
                        className="forge-context-option forge-context-option--workspace"
                        onClick={() => onSelectWorkspace(workspace.id)}
                    >
                        <span className="forge-context-option__title">{workspace.business_name}</span>
                        <span className="forge-context-option__meta">Shared with this workspace</span>
                    </button>
                ))}

                <button
                    className="forge-context-option"
                    onClick={() => setCustomOpen((open) => !open)}
                >
                    <span className="forge-context-option__title">Another business/project</span>
                    <span className="forge-context-option__meta">Save privately with a custom label</span>
                </button>
            </div>

            {customOpen && (
                <div className="forge-context-card__custom">
                    <label className="foundry-label" htmlFor="forge-context-custom-label">
                        What should Navi call this context?
                    </label>
                    <div className="forge-context-card__custom-row">
                        <input
                            id="forge-context-custom-label"
                            value={customLabel}
                            onChange={(event) => setCustomLabel(event.target.value)}
                            placeholder="e.g. Real Estate Idea"
                        />
                        <button
                            className="foundry-btn foundry-btn--secondary"
                            disabled={!customLabel.trim()}
                            onClick={() => {
                                const label = customLabel.trim();
                                if (label) onSubmitCustom(label);
                            }}
                        >
                            Save privately
                        </button>
                    </div>
                </div>
            )}

            <div className="forge-context-card__privacy">
                Personal and custom contexts stay private unless you later share them to a workspace.
            </div>
        </div>
    );
}
