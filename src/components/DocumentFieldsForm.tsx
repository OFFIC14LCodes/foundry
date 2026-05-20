import type { DocumentRequirement } from "../lib/documentRequirements";
import HelpTooltip from "./HelpTooltip";

interface DocumentFieldsFormProps {
    requirement: DocumentRequirement;
    values: Record<string, any>;
    errors: Record<string, string>;
    onChange: (fieldId: string, value: any) => void;
}

function FieldInput({ field, value, error, onChange }: {
    field: DocumentRequirement["groups"][number]["fields"][number];
    value: any;
    error?: string;
    onChange: (value: any) => void;
}) {
    const baseStyle = {
        width: "100%",
        background: "rgba(7,26,47,0.04)",
        border: error ? "1px solid rgba(214,80,55,0.55)" : "1px solid rgba(7,26,47,0.1)",
        borderRadius: 10,
        padding: "10px 12px",
        color: "var(--color-text)",
        fontSize: 13,
        fontFamily: "var(--tekori-font-ui)",
        lineHeight: 1.55,
        boxSizing: "border-box" as const,
        outline: "none",
    };

    if (field.type === "textarea" || field.type === "list") {
        return (
            <textarea
                value={value ?? ""}
                onChange={(event) => onChange(event.target.value)}
                placeholder={field.placeholder}
                rows={field.rows ?? (field.type === "list" ? 4 : 3)}
                style={{ ...baseStyle, resize: "vertical" as const }}
            />
        );
    }

    if (field.type === "select") {
        return (
            <select
                value={value ?? ""}
                onChange={(event) => onChange(event.target.value)}
                style={{ ...baseStyle, cursor: "pointer", colorScheme: "light" as const }}
            >
                <option value="">{field.placeholder || "Select..."}</option>
                {(field.options || []).map((option) => (
                    <option key={option} value={option} style={{ background: "var(--color-surface-elevated)", color: "var(--color-text)" }}>
                        {option}
                    </option>
                ))}
            </select>
        );
    }

    if (field.type === "checkbox") {
        return (
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", color: "var(--color-text-soft)", fontSize: 13 }}>
                <input
                    type="checkbox"
                    checked={!!value}
                    onChange={(event) => onChange(event.target.checked)}
                    style={{ accentColor: "var(--tekori-gold)", width: 16, height: 16 }}
                />
                <span>{field.placeholder || "Yes"}</span>
            </label>
        );
    }

    const inputType = field.type === "email"
        ? "email"
        : field.type === "phone"
            ? "tel"
            : field.type === "date"
                ? "date"
                : ["number", "currency", "percentage"].includes(field.type)
                    ? "text"
                    : "text";

    return (
        <input
            type={inputType}
            value={value ?? ""}
            onChange={(event) => onChange(event.target.value)}
            placeholder={field.placeholder}
            style={{ ...baseStyle, colorScheme: "light" as const }}
        />
    );
}

export default function DocumentFieldsForm({ requirement, values, errors, onChange }: DocumentFieldsFormProps) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {requirement.groups.map((group) => (
                <section
                    key={group.id}
                    style={{
                        border: "1px solid rgba(7,26,47,0.07)",
                        background: "rgba(7,26,47,0.02)",
                        borderRadius: 14,
                        padding: "14px 14px 16px",
                    }}
                >
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                        <div style={{ fontSize: 13, fontFamily: "var(--tekori-font-ui)", fontWeight: 600, color: "var(--color-text)" }}>
                            {group.title}
                        </div>
                        {group.description && <HelpTooltip content={group.description} />}
                        {group.id === "structured-template" && (
                            <HelpTooltip content="Template-backed fields are validated before generation so the draft can include the core clauses for this document type." />
                        )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {group.fields.map((field) => (
                            <div key={field.id}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                                    <div style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                                        <label style={{ fontSize: 11, color: "var(--color-text-muted)", letterSpacing: "0.04em" }}>
                                            {field.label}
                                            {field.required && <span style={{ color: "var(--tekori-gold)" }}> *</span>}
                                        </label>
                                        {field.help && <HelpTooltip content={field.help} />}
                                        {field.type === "list" && <HelpTooltip content="Enter one item per line." />}
                                    </div>
                                    {errors[field.id] && (
                                        <span style={{ fontSize: 10, color: "#D65037", flexShrink: 0 }}>{errors[field.id]}</span>
                                    )}
                                </div>
                                <FieldInput
                                    field={field}
                                    value={values[field.id]}
                                    error={errors[field.id]}
                                    onChange={(next) => onChange(field.id, next)}
                                />
                            </div>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
