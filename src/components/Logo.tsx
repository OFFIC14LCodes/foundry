import { useState, type CSSProperties } from "react";

type BrandName = "tekori" | "navi";
type LogoKind = "full" | "mark";
type LogoVariant = LogoKind | "flame" | "forge";
type LogoSurface = "dark" | "light";

const BRAND_COPY: Record<BrandName, { name: string; tagline: string; mark: string }> = {
    tekori: {
        name: "Tekori",
        tagline: "The Builder's Light",
        mark: "T",
    },
    navi: {
        name: "Navi",
        tagline: "Guiding Founders Forward",
        mark: "N",
    },
};

function resolveLogo(brand: BrandName, _kind: LogoKind) {
    return brand === "navi" ? "/Navi.svg" : "/Tekori.svg";
}

function resolveLegacyVariant(variant: LogoVariant, brand?: BrandName): { brand: BrandName; kind: LogoKind } {
    if (variant === "forge") return { brand: "navi", kind: "mark" };
    if (variant === "flame") return { brand: "tekori", kind: "mark" };
    return { brand: brand ?? "tekori", kind: variant === "mark" ? "mark" : "full" };
}

type LogoProps = {
    brand?: BrandName;
    variant?: LogoVariant;
    surface?: LogoSurface;
    compact?: boolean;
    className?: string;
    style?: CSSProperties;
};

export default function Logo({
    brand,
    variant = "full",
    surface = "light",
    compact = false,
    className,
    style,
}: LogoProps) {
    const resolved = resolveLegacyVariant(variant, brand);
    const copy = BRAND_COPY[resolved.brand];
    const [imageFailed, setImageFailed] = useState(false);
    const src = resolveLogo(resolved.brand, resolved.kind);
    const alt = resolved.kind === "full" ? `${copy.name} logo` : `${copy.name} mark`;

    if (!imageFailed) {
        return (
            <img
                src={src}
                alt={alt}
                className={className}
                style={style}
                onError={() => setImageFailed(true)}
            />
        );
    }

    const foreground = surface === "dark" ? "var(--tekori-cream)" : "var(--color-primary)";
    const accent = "var(--tekori-gold)";

    if (resolved.kind === "mark" || compact) {
        return (
            <span
                aria-label={alt}
                className={className}
                role="img"
                style={{
                    width: 32,
                    height: 32,
                    borderRadius: resolved.brand === "navi" ? "50%" : "var(--tekori-radius-sm)",
                    display: "inline-grid",
                    placeItems: "center",
                    color: foreground,
                    background: surface === "dark"
                        ? "linear-gradient(145deg, rgba(201,137,36,0.16), rgba(255,252,246,0.82))"
                        : "linear-gradient(145deg, rgba(6,24,50,0.08), rgba(201,137,36,0.13))",
                    border: "1px solid var(--tekori-subtle-line)",
                    fontFamily: "var(--tekori-font-brand)",
                    fontSize: resolved.brand === "navi" ? 15 : 17,
                    fontWeight: 700,
                    lineHeight: 1,
                    boxShadow: resolved.brand === "navi" ? "inset 0 0 0 1px rgba(241,204,116,0.12)" : undefined,
                    ...style,
                }}
            >
                {resolved.brand === "tekori" ? (
                    <span style={{ display: "grid", placeItems: "center", gap: 1, lineHeight: 1 }}>
                        <span style={{ color: "var(--tekori-soft-gold)", fontSize: "0.66em" }}>✦</span>
                        <span>{copy.mark}</span>
                    </span>
                ) : (
                    <span style={{ letterSpacing: "0.02em" }}>{copy.mark}</span>
                )}
            </span>
        );
    }

    return (
        <span
            aria-label={alt}
            className={className}
            role="img"
            style={{
                display: "inline-flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                color: foreground,
                lineHeight: 1,
                ...style,
            }}
        >
            <span style={{ fontFamily: "var(--tekori-font-brand)", fontWeight: 700, fontSize: "1.15em", letterSpacing: resolved.brand === "navi" ? "0.14em" : "0" }}>
                {copy.name}
            </span>
            <span style={{ fontFamily: "var(--tekori-font-ui)", fontWeight: 800, fontSize: "0.34em", letterSpacing: "0.16em", textTransform: "uppercase", color: accent }}>
                {copy.tagline}
            </span>
        </span>
    );
}
