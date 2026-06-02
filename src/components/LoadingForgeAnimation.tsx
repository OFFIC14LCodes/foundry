export default function LoadingForgeAnimation({ size = 72 }: { size?: number }) {
    const ring = size * 0.9;
    const core = size * 0.52;
    const pulse = size * 0.72;

    return (
        <div
            style={{
                position: "relative",
                width: size,
                height: size,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
            }}
            aria-hidden="true"
        >
            <style>{`
                @keyframes tekoriOrbit {
                    from { transform: translate(-50%, -50%) rotate(0deg); }
                    to { transform: translate(-50%, -50%) rotate(360deg); }
                }

                @keyframes tekoriPulse {
                    0%, 100% {
                        transform: translate(-50%, -50%) scale(0.96);
                        opacity: 0.72;
                    }
                    50% {
                        transform: translate(-50%, -50%) scale(1.04);
                        opacity: 1;
                    }
                }

                @keyframes tekoriCoreLift {
                    0%, 100% { transform: translate(-50%, -50%) scale(1); }
                    50% { transform: translate(-50%, -52%) scale(1.03); }
                }
            `}</style>

            <div
                style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: size,
                    height: size,
                    transform: "translate(-50%, -50%)",
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(216,155,43,0.12) 0%, rgba(216,155,43,0.05) 46%, rgba(0,0,0,0) 72%)",
                    filter: "blur(12px)",
                }}
            />

            <div
                style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: pulse,
                    height: pulse,
                    transform: "translate(-50%, -50%)",
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(16,32,51,0.08) 0%, rgba(16,32,51,0.02) 58%, rgba(0,0,0,0) 74%)",
                    animation: "tekoriPulse 1.8s ease-in-out infinite",
                }}
            />

            <div
                style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: ring,
                    height: ring,
                    transform: "translate(-50%, -50%)",
                    borderRadius: "50%",
                    border: "1px solid rgba(7,26,47,0.08)",
                }}
            />

            <div
                style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: ring,
                    height: ring,
                    borderRadius: "50%",
                    animation: "tekoriOrbit 3.8s linear infinite",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: "50%",
                        background: "conic-gradient(from 205deg, rgba(0,0,0,0) 0deg, rgba(0,0,0,0) 210deg, rgba(216,155,43,0.88) 258deg, rgba(16,32,51,0.94) 305deg, rgba(0,0,0,0) 345deg, rgba(0,0,0,0) 360deg)",
                        WebkitMask: "radial-gradient(circle, transparent 58%, #000 62%, #000 69%, transparent 73%)",
                        mask: "radial-gradient(circle, transparent 58%, #000 62%, #000 69%, transparent 73%)",
                    }}
                />
            </div>

            <div
                style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: core,
                    height: core,
                    transform: "translate(-50%, -50%)",
                    borderRadius: "50%",
                    background: "linear-gradient(180deg, rgba(255,252,246,0.98), rgba(255,248,236,0.96))",
                    border: "1px solid rgba(7,26,47,0.08)",
                    boxShadow: "0 16px 30px rgba(16,32,51,0.12), inset 0 1px 0 rgba(255,255,255,0.75)",
                    animation: "tekoriCoreLift 1.9s ease-in-out infinite",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <div
                    style={{
                        position: "relative",
                        width: core * 0.42,
                        height: core * 0.5,
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            left: "50%",
                            top: 0,
                            width: "22%",
                            height: "100%",
                            transform: "translateX(-50%)",
                            borderRadius: 999,
                            background: "linear-gradient(180deg, var(--tekori-gold), #b98418)",
                        }}
                    />
                    <div
                        style={{
                            position: "absolute",
                            left: "50%",
                            top: "38%",
                            width: "100%",
                            height: "20%",
                            transform: "translate(-50%, -50%)",
                            borderRadius: 999,
                            background: "linear-gradient(90deg, rgba(16,32,51,0.98), rgba(48,70,95,0.94))",
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
