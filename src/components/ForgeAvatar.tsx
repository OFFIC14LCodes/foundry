import Logo from "./Logo";

export default function ForgeAvatar({ size = 32 }) {
    return (
        <div
            style={{
                width: size,
                height: size,
                borderRadius: "50%",
                flexShrink: 0,
                background: "linear-gradient(135deg, #E8622A, #c9521e)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: size * 0.44,
                boxShadow: "0 0 16px rgba(232,98,42,0.25)",
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
