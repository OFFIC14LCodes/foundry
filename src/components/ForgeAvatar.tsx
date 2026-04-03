import Logo from "./Logo";

export default function ForgeAvatar({ size = 32 }) {
    return (
        <div
            style={{
                width: size,
                height: size,
                borderRadius: "50%",
                flexShrink: 0,
                background: "linear-gradient(135deg, #2D221C, #171214)",
                border: "1px solid rgba(245, 168, 67, 0.16)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: size * 0.44,
                boxShadow: "0 10px 24px rgba(0,0,0,0.28)",
            }}
        >
            <Logo
                variant="forge"
                style={{
                    width: size * 0.62,
                    height: size * 0.62,
                    objectFit: "contain",
                }}
            />
        </div>
    );
}
