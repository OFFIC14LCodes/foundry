import { useEffect, useState } from "react";
import { STAGES_DATA } from "../constants/stages";
import { STAGE_COLORS } from "../constants/glossary";
import { getConceptEntry } from "../conceptLibrary";

// ─────────────────────────────────────────────────────────────
// CONCEPT MODAL
// ─────────────────────────────────────────────────────────────
export default function ConceptModal({
    conceptName,
    profile,
    activeStage,
    onClose,
    onMarkExplored,
    alreadyExplored,
    callForgeAPI,
    onRelatedConceptTap,
}: {
    conceptName: string;
    profile: any;
    activeStage: number;
    onClose: () => void;
    onMarkExplored: (name: string) => void;
    alreadyExplored: boolean;
    callForgeAPI: (messages: any[], systemPrompt?: string) => Promise<string>;
    onRelatedConceptTap?: (name: string) => void;
}) {
    const [personalNote, setPersonalNote] = useState<string | null>(null);
    const [loadingNote, setLoadingNote] = useState(false);

    const entry = getConceptEntry(conceptName);
    const displayName = entry?.name || conceptName;
    const stageNum = entry?.stage || activeStage;
    const stageData = STAGES_DATA[stageNum - 1];
    const stageColor = STAGE_COLORS[stageNum] || "#9F7AEA";

    // Generate personalized "why this matters for you" on open
    useEffect(() => {
        const generate = async () => {
            setLoadingNote(true);
            try {
                const businessContext = profile.idea || profile.businessName || "their business";
                const prompt = `The founder ${profile.name} is building "${businessContext}" and is currently in Stage ${activeStage} of Foundry. They just tapped on the concept "${displayName}" to explore it more deeply.\n\nIn 2-3 sentences, explain specifically why understanding "${displayName}" is important for what they are working on right now. Be concrete and personal — reference their specific business situation. Do not define the concept. Connect it to their specific stage and business in a way that makes them feel like this concept arrived at exactly the right moment.`;
                const note = await callForgeAPI(
                    [{ role: "user", content: prompt }],
                    "You are Forge. Respond with only the 2-3 sentence insight, no preamble, no sign-off."
                );
                setPersonalNote(note || null);
            } catch {
                setPersonalNote(null);
            }
            setLoadingNote(false);
        };
        generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conceptName]);

    const SectionLabel = ({ children, color = "#555" }: { children: string; color?: string }) => (
        <div style={{
            fontSize: 10,
            color,
            letterSpacing: "0.13em",
            textTransform: "uppercase" as const,
            marginBottom: 8,
            fontFamily: "'Lora', Georgia, serif",
            fontWeight: 600,
        }}>
            {children}
        </div>
    );

    const SectionBody = ({ children, italic = false }: { children: string; italic?: boolean }) => (
        <div style={{
            fontSize: 14,
            fontFamily: "'Lora', Georgia, serif",
            color: "#C8C4BE",
            lineHeight: 1.78,
            fontStyle: italic ? "italic" : "normal",
        }}>
            {children}
        </div>
    );

    return (
        <div style={{
            position: "fixed",
            inset: 0,
            zIndex: 110,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            animation: "fadeIn 0.2s ease",
        }}>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(0,0,0,0.70)",
                    backdropFilter: "blur(6px)",
                }}
            />

            {/* Sheet */}
            <div style={{
                position: "relative",
                background: "#0D0D10",
                borderTop: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "20px 20px 0 0",
                padding: "0 0 max(36px, calc(20px + env(safe-area-inset-bottom)))",
                animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)",
                maxHeight: "88vh",
                overflowY: "auto",
            }}>
                {/* Drag handle */}
                <div style={{
                    width: 36,
                    height: 3,
                    background: "rgba(255,255,255,0.12)",
                    borderRadius: 2,
                    margin: "16px auto 20px",
                }} />

                {/* Header */}
                <div style={{ padding: "0 20px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                        <div style={{ flex: 1, paddingRight: 12 }}>
                            <div style={{
                                fontSize: 28,
                                fontFamily: "'Playfair Display', Georgia, serif",
                                fontWeight: 700,
                                color: "#F0EDE8",
                                letterSpacing: "-0.5px",
                                lineHeight: 1.1,
                                marginBottom: 10,
                            }}>
                                {displayName.charAt(0).toUpperCase() + displayName.slice(1)}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
                                {stageData && (
                                    <div style={{
                                        fontSize: 10,
                                        color: stageColor,
                                        background: `${stageColor}18`,
                                        border: `1px solid ${stageColor}30`,
                                        borderRadius: 20,
                                        padding: "2px 9px",
                                        fontWeight: 500,
                                        fontFamily: "'Lora', Georgia, serif",
                                    }}>
                                        Stage {stageNum} — {stageData.label}
                                    </div>
                                )}
                                <div style={{
                                    fontSize: 10,
                                    color: "#9F7AEA",
                                    background: "rgba(159,122,234,0.1)",
                                    border: "1px solid rgba(159,122,234,0.25)",
                                    borderRadius: 20,
                                    padding: "2px 9px",
                                    fontFamily: "'Lora', Georgia, serif",
                                    fontWeight: 500,
                                }}>
                                    ✦ Core Concept
                                </div>
                                {alreadyExplored && (
                                    <div style={{
                                        fontSize: 10,
                                        color: "#9F7AEA",
                                        background: "rgba(159,122,234,0.08)",
                                        borderRadius: 20,
                                        padding: "2px 9px",
                                        fontFamily: "'Lora', Georgia, serif",
                                    }}>
                                        ✦ Explored
                                    </div>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            style={{
                                background: "rgba(255,255,255,0.06)",
                                border: "none",
                                borderRadius: 8,
                                padding: "6px 12px",
                                color: "#666",
                                fontSize: 11,
                                cursor: "pointer",
                                flexShrink: 0,
                            }}
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Body sections */}
                <div style={{ padding: "0 20px" }}>

                    {/* Why this matters for you right now */}
                    <div style={{
                        marginTop: 18,
                        marginBottom: 16,
                        background: "rgba(232,98,42,0.06)",
                        border: "1px solid rgba(232,98,42,0.15)",
                        borderRadius: 12,
                        padding: "14px 16px",
                    }}>
                        <SectionLabel color="#E8622A">Why this matters for you right now</SectionLabel>
                        {loadingNote ? (
                            <div style={{ display: "flex", gap: 5, alignItems: "center", padding: "4px 0" }}>
                                {[0, 1, 2].map(i => (
                                    <div
                                        key={i}
                                        style={{
                                            width: 5,
                                            height: 5,
                                            borderRadius: "50%",
                                            background: "#E8622A",
                                            animation: "forgePulse 1.4s infinite ease-in-out",
                                            animationDelay: `${i * 0.2}s`,
                                        }}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div style={{
                                fontSize: 13,
                                fontFamily: "'Lora', Georgia, serif",
                                color: "#D8D4CE",
                                lineHeight: 1.75,
                                fontStyle: "italic",
                            }}>
                                {personalNote || (entry
                                    ? `Understanding ${displayName} is directly relevant to where you are in Stage ${activeStage}. The work you're doing right now will be shaped by how clearly you see this concept.`
                                    : `This concept is worth exploring carefully at Stage ${activeStage}. Forge will have more to say about it as your work continues.`
                                )}
                            </div>
                        )}
                    </div>

                    {entry ? (
                        <>
                            {/* What it is */}
                            <div style={{ marginBottom: 18 }}>
                                <SectionLabel>What it is</SectionLabel>
                                <SectionBody>{entry.whatItIs}</SectionBody>
                            </div>

                            {/* The principle */}
                            <div style={{ marginBottom: 18 }}>
                                <SectionLabel>The principle</SectionLabel>
                                <SectionBody>{entry.thePrinciple}</SectionBody>
                            </div>

                            {/* In practice */}
                            <div style={{ marginBottom: 18 }}>
                                <SectionLabel>In practice</SectionLabel>
                                <SectionBody>{entry.inPractice}</SectionBody>
                            </div>

                            {/* Without it */}
                            <div style={{ marginBottom: 18 }}>
                                <SectionLabel>Without it</SectionLabel>
                                <SectionBody>{entry.withoutIt}</SectionBody>
                            </div>

                            {/* The mistake */}
                            <div style={{ marginBottom: 18 }}>
                                <SectionLabel>The mistake</SectionLabel>
                                <SectionBody>{entry.theMistake}</SectionBody>
                            </div>

                            {/* Sit with this */}
                            <div style={{
                                marginBottom: 18,
                                padding: "14px 16px",
                                background: "rgba(159,122,234,0.05)",
                                border: "1px solid rgba(159,122,234,0.18)",
                                borderRadius: 12,
                            }}>
                                <SectionLabel color="#9F7AEA">Sit with this</SectionLabel>
                                <div style={{
                                    fontSize: 15,
                                    fontFamily: "'Lora', Georgia, serif",
                                    color: "#D8D4CE",
                                    lineHeight: 1.72,
                                    fontStyle: "italic",
                                }}>
                                    {entry.sitWithThis}
                                </div>
                            </div>

                            {/* Related concepts */}
                            {entry.related && entry.related.length > 0 && (
                                <div style={{ marginBottom: 22 }}>
                                    <SectionLabel>Connected ideas</SectionLabel>
                                    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
                                        {entry.related.map((rel) => (
                                            <button
                                                key={rel}
                                                onClick={() => {
                                                    if (onRelatedConceptTap) {
                                                        onClose();
                                                        // Small delay so the close animation plays before opening the new one
                                                        setTimeout(() => onRelatedConceptTap(rel), 150);
                                                    }
                                                }}
                                                style={{
                                                    background: "rgba(159,122,234,0.08)",
                                                    border: "1px solid rgba(159,122,234,0.25)",
                                                    borderRadius: 20,
                                                    padding: "4px 12px",
                                                    color: "#9F7AEA",
                                                    fontSize: 11,
                                                    fontFamily: "'Lora', Georgia, serif",
                                                    cursor: onRelatedConceptTap ? "pointer" : "default",
                                                    fontWeight: 500,
                                                }}
                                            >
                                                ✦ {rel}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        // Concept not yet in library — show placeholder
                        <div style={{
                            marginBottom: 22,
                            padding: "16px",
                            background: "rgba(255,255,255,0.02)",
                            border: "1px solid rgba(255,255,255,0.06)",
                            borderRadius: 12,
                            textAlign: "center" as const,
                        }}>
                            <div style={{ fontSize: 13, color: "#555", fontFamily: "'Lora', Georgia, serif", fontStyle: "italic", lineHeight: 1.7 }}>
                                Deep content for this concept is being written. Check back as Foundry grows.
                            </div>
                        </div>
                    )}

                    {/* Mark as explored button */}
                    {!alreadyExplored ? (
                        <button
                            onClick={() => { onMarkExplored(conceptName.toLowerCase().trim()); onClose(); }}
                            style={{
                                width: "100%",
                                padding: "13px",
                                background: "linear-gradient(135deg, #9F7AEA, #7C3AED)",
                                border: "none",
                                borderRadius: 12,
                                color: "#fff",
                                fontSize: 13,
                                fontFamily: "'Lora', Georgia, serif",
                                fontWeight: 600,
                                cursor: "pointer",
                                boxShadow: "0 4px 20px rgba(159,122,234,0.3)",
                                marginBottom: 4,
                            }}
                        >
                            ✦ Mark as Explored
                        </button>
                    ) : (
                        <div style={{
                            textAlign: "center" as const,
                            fontSize: 12,
                            color: "#9F7AEA",
                            padding: "10px 0",
                            fontFamily: "'Lora', Georgia, serif",
                        }}>
                            ✦ You've explored this concept
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
