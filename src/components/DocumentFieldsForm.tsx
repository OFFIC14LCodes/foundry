import type { DocumentRequirement } from "../lib/documentRequirements";

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
        background: "rgba(255,255,255,0.04)",
        border: error ? "1px solid rgba(214,80,55,0.55)" : "1px solid rgba(255,255,255,0.1)",
        borderRadius: 10,
        padding: "10px 12px",
        color: "#F0EDE8",
        fontSize: 13,
        fontFamily: "'DM Sans', sans-serif",
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
                style={{ ...baseStyle, cursor: "pointer", colorScheme: "dark" as const }}
            >
                <option value="">{field.placeholder || "Select..."}</option>
                {(field.options || []).map((option) => (
                    <option key={option} value={option} style={{ background: "#111", color: "#F0EDE8" }}>
                        {option}
                    </option>
                ))}
            </select>
        );
    }

    if (field.type === "checkbox") {
        return (
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", color: "#C8C4BE", fontSize: 13 }}>
                <input
                    type="checkbox"
                    checked={!!value}
                    onChange={(event) => onChange(event.target.checked)}
                    style={{ accentColor: "#E8622A", width: 16, height: 16 }}
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
            style={{ ...baseStyle, colorScheme: "dark" as const }}
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
                        border: "1px solid rgba(255,255,255,0.07)",
                        background: "rgba(255,255,255,0.02)",
                        borderRadius: 14,
                        padding: "14px 14px 16px",
                    }}
                >
                    <div style={{ fontSize: 13, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8", marginBottom: 4 }}>
                        {group.title}
                    </div>
                    {group.description && (
                        <div style={{ fontSize: 11, color: "#666", lineHeight: 1.55, marginBottom: 14 }}>
                            {group.description}
                        </div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {group.fields.map((field) => (
                            <div key={field.id}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                                    <label style={{ fontSize: 11, color: "#A8A4A0", letterSpacing: "0.04em" }}>
                                        {field.label}
                                        {field.required && <span style={{ color: "#E8622A" }}> *</span>}
                                    </label>
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
                                {field.help && (
                                    <div style={{ fontSize: 10, color: "#555", lineHeight: 1.5, marginTop: 5 }}>
                                        {field.help}
                                    </div>
                                )}
                                {field.type === "list" && (
                                    <div style={{ fontSize: 10, color: "#555", lineHeight: 1.5, marginTop: 5 }}>
                                        Enter one item per line.
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
