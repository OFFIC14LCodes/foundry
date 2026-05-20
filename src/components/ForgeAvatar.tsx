import Logo from "./Logo";

export default function ForgeAvatar({ size = 32 }) {
    return (
        <div
            style={{
                width: size,
                height: size,
                borderRadius: "50%",
                flexShrink: 0,
                background: "linear-gradient(145deg, rgba(201,137,36,0.16), rgba(255,252,246,0.82)), var(--tekori-midnight-navy)",
                border: "1px solid var(--tekori-subtle-line)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: size * 0.44,
                boxShadow: "inset 0 0 0 1px rgba(241,204,116,0.10), 0 10px 24px rgba(2,9,17,0.28)",
            }}
        >
            <Logo
                brand="navi"
                variant="mark"
                compact
                style={{
                    width: size * 0.64,
                    height: size * 0.64,
                    objectFit: "contain",
                    fontSize: size * 0.32,
                }}
            />
        </div>
    );
}
