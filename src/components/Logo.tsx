import type { CSSProperties } from "react";
import { Icons } from "../icons";

type LogoVariant = "flame" | "full" | "forge";

const LOGO_MAP: Record<LogoVariant, { src: string; alt: string }> = {
    flame: {
        src: Icons.logos.foundryFlame,
        alt: "Foundry flame logo",
    },
    full: {
        src: Icons.logos.foundryAndForge,
        alt: "Foundry and Forge logo",
    },
    forge: {
        src: Icons.logos.forge,
        alt: "Forge logo",
    },
};

type LogoProps = {
    variant: LogoVariant;
    className?: string;
    style?: CSSProperties;
};

export default function Logo({ variant, className, style }: LogoProps) {
    const logo = LOGO_MAP[variant];

    return (
        <img
            src={logo.src}
            alt={logo.alt}
            className={className}
            style={style}
        />
    );
}
