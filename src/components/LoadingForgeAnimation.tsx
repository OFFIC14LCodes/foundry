export default function LoadingForgeAnimation({ size = 72 }: { size?: number }) {
    const ringInset = size * 0.16;
    const orbitDiameter = size - ringInset * 2;
    const orbSize = size * 0.16;

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
            <div
                style={{
                    position: "absolute",
                    inset: "16%",
                    borderRadius: "50%",
                    border: "1px solid rgba(8,8,9,0.88)",
                    boxShadow: "inset 0 0 14px rgba(0,0,0,0.08)",
                }}
            />

            <div
                style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: orbitDiameter,
                    height: orbitDiameter,
                    marginLeft: -orbitDiameter / 2,
                    marginTop: -orbitDiameter / 2,
                    animation: "loadingFlameOrbit 1.8s linear infinite",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        left: "50%",
                        top: 0,
                        width: orbSize,
                        height: orbSize,
                        marginLeft: -(orbSize / 2),
                        marginTop: -(orbSize / 2),
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            left: "50%",
                            top: "50%",
                            width: size * 0.42,
                            height: size * 0.11,
                            transform: "translate(-92%, -50%)",
                            borderRadius: "999px",
                            background: "linear-gradient(90deg, rgba(245,168,67,0) 0%, rgba(245,168,67,0.08) 26%, rgba(245,168,67,0.22) 48%, rgba(232,98,42,0.48) 74%, rgba(232,98,42,0.92) 100%)",
                            filter: "blur(4px)",
                            opacity: 0.98,
                        }}
                    />
                    <div
                        style={{
                            position: "absolute",
                            left: "50%",
                            top: "50%",
                            width: orbSize,
                            height: orbSize,
                            transform: "translate(-50%, -50%)",
                            borderRadius: "50%",
                            background: "radial-gradient(circle at 35% 35%, #FFD0A7 0%, #F5A843 24%, #E8622A 58%, #B93D14 100%)",
                            boxShadow: "0 0 10px rgba(232,98,42,0.42), 0 0 20px rgba(245,168,67,0.16)",
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
