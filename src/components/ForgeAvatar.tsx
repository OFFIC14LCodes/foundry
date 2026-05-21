import Logo from "./Logo";

export default function ForgeAvatar({ size = 32 }) {
    return (
        <div
            style={{
                width: size,
                height: size,
                borderRadius: "50%",
                flexShrink: 0,
                background: "var(--tekori-white)",
                border: "1px solid var(--tekori-subtle-line)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: size * 0.44,
                boxShadow: "0 2px 8px rgba(7,26,47,0.10)",
            }}
        >
            <Logo
                brand="navi"
                variant="mark"
                compact
                style={{
                    width: size * 0.82,
                    height: size * 0.82,
                    objectFit: "contain",
                    fontSize: size * 0.32,
                }}
            />
        </div>
    );
}
