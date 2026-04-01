export default function TypingDots() {
    return (
        <div style={{ display: "flex", gap: 5, padding: "10px 4px", alignItems: "center" }}>
            {[0, 1, 2].map((i) => (
                <div
                    key={i}
                    style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "#E8622A",
                        animation: "forgePulse 1.4s infinite ease-in-out",
                        animationDelay: `${i * 0.2}s`,
                    }}
                />
            ))}
        </div>
    );
}