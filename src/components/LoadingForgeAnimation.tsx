export default function LoadingForgeAnimation({ size = 72 }: { size?: number }) {
    const outerRing = size * 0.84;
    const innerCore = size * 0.34;
    const emberGlow = size * 0.58;
    const emberSpecs = [
        { x: "18%", y: "66%", delay: "0s", duration: "1.8s", driftX: "-18px", driftY: "-28px", scale: 1 },
        { x: "22%", y: "42%", delay: "0.35s", duration: "1.55s", driftX: "-12px", driftY: "-22px", scale: 0.82 },
        { x: "30%", y: "24%", delay: "0.72s", duration: "1.95s", driftX: "-8px", driftY: "-18px", scale: 0.68 },
        { x: "10%", y: "50%", delay: "1.02s", duration: "1.65s", driftX: "-16px", driftY: "-20px", scale: 0.74 },
    ];

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
                @keyframes foundryOuterSpin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                @keyframes foundryInnerSpin {
                    from { transform: rotate(360deg); }
                    to { transform: rotate(0deg); }
                }

                @keyframes foundryCorePulse {
                    0%, 100% {
                        transform: translate(-50%, -50%) scale(0.96);
                        box-shadow:
                            0 0 0 rgba(232,98,42,0),
                            0 0 18px rgba(232,98,42,0.25),
                            0 0 34px rgba(245,168,67,0.14);
                    }
                    50% {
                        transform: translate(-50%, -50%) scale(1.04);
                        box-shadow:
                            0 0 0 rgba(232,98,42,0),
                            0 0 26px rgba(232,98,42,0.4),
                            0 0 48px rgba(245,168,67,0.24);
                    }
                }

                @keyframes foundryHeatWave {
                    0%, 100% { transform: translate(-50%, -50%) scale(0.98, 0.95); opacity: 0.52; }
                    50% { transform: translate(-50%, -50%) scale(1.03, 1.02); opacity: 0.82; }
                }

                @keyframes foundryEmberRise {
                    0% {
                        opacity: 0;
                        transform: translate(0, 0) scale(0.45);
                    }
                    20% {
                        opacity: 1;
                    }
                    100% {
                        opacity: 0;
                        transform: translate(var(--ember-x), var(--ember-y)) scale(0.12);
                    }
                }

                @keyframes foundryCoreFlicker {
                    0%, 100% { opacity: 0.92; transform: translate(-50%, -50%) scale(1) rotate(-4deg); }
                    35% { opacity: 1; transform: translate(-50%, -52%) scale(0.94, 1.08) rotate(3deg); }
                    70% { opacity: 0.86; transform: translate(-50%, -49%) scale(1.06, 0.92) rotate(-2deg); }
                }
            `}</style>

            <div
                style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: outerRing,
                    height: outerRing,
                    transform: "translate(-50%, -50%)",
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(232,98,42,0.08) 0%, rgba(232,98,42,0.03) 42%, rgba(0,0,0,0) 68%)",
                    filter: "blur(12px)",
                }}
            />

            <div
                style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: size * 0.68,
                    height: size * 0.68,
                    transform: "translate(-50%, -50%)",
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(245,168,67,0.16) 0%, rgba(245,168,67,0.08) 38%, rgba(245,168,67,0) 72%)",
                    animation: "foundryHeatWave 2.1s ease-in-out infinite",
                }}
            />

            <div
                style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: outerRing,
                    height: outerRing,
                    marginLeft: -(outerRing / 2),
                    marginTop: -(outerRing / 2),
                    borderRadius: "50%",
                    border: "1px solid rgba(255,255,255,0.04)",
                    boxShadow: "inset 0 0 20px rgba(255,255,255,0.03), 0 0 24px rgba(0,0,0,0.18)",
                }}
            />

            <div
                style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: outerRing,
                    height: outerRing,
                    marginLeft: -(outerRing / 2),
                    marginTop: -(outerRing / 2),
                    borderRadius: "50%",
                    animation: "foundryOuterSpin 4.2s linear infinite",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: "50%",
                        background: "conic-gradient(from 160deg, rgba(0,0,0,0) 0deg, rgba(0,0,0,0) 220deg, rgba(232,98,42,0.88) 262deg, rgba(245,168,67,0.92) 290deg, rgba(255,222,189,0.3) 306deg, rgba(0,0,0,0) 330deg, rgba(0,0,0,0) 360deg)",
                        WebkitMask: "radial-gradient(circle, transparent 57%, #000 60%, #000 67%, transparent 71%)",
                        mask: "radial-gradient(circle, transparent 57%, #000 60%, #000 67%, transparent 71%)",
                        filter: "blur(0.2px)",
                    }}
                />
            </div>

            <div
                style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: size * 0.62,
                    height: size * 0.62,
                    marginLeft: -(size * 0.31),
                    marginTop: -(size * 0.31),
                    borderRadius: "50%",
                    animation: "foundryInnerSpin 6.3s linear infinite",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: "50%",
                        background: "conic-gradient(from 24deg, rgba(0,0,0,0) 0deg, rgba(245,168,67,0.16) 78deg, rgba(232,98,42,0.6) 104deg, rgba(0,0,0,0) 144deg, rgba(0,0,0,0) 360deg)",
                        WebkitMask: "radial-gradient(circle, transparent 59%, #000 64%, #000 71%, transparent 76%)",
                        mask: "radial-gradient(circle, transparent 59%, #000 64%, #000 71%, transparent 76%)",
                    }}
                />
            </div>

            {emberSpecs.map((ember, index) => (
                <div
                    key={`ember-${index}`}
                    style={{
                        position: "absolute",
                        left: ember.x,
                        top: ember.y,
                        width: size * 0.075 * ember.scale,
                        height: size * 0.075 * ember.scale,
                        borderRadius: "50%",
                        background: "radial-gradient(circle, rgba(255,243,224,1) 0%, rgba(245,168,67,0.98) 35%, rgba(232,98,42,0.35) 66%, rgba(232,98,42,0) 100%)",
                        boxShadow: "0 0 12px rgba(245,168,67,0.34)",
                        ["--ember-x" as any]: ember.driftX,
                        ["--ember-y" as any]: ember.driftY,
                        animation: `foundryEmberRise ${ember.duration} ease-out infinite`,
                        animationDelay: ember.delay,
                    }}
                />
            ))}

            <div
                style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: emberGlow,
                    height: emberGlow,
                    transform: "translate(-50%, -50%)",
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(255,220,176,0.16) 0%, rgba(245,168,67,0.1) 36%, rgba(232,98,42,0.06) 52%, rgba(0,0,0,0) 72%)",
                    filter: "blur(8px)",
                }}
            />

            <div
                style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: innerCore,
                    height: innerCore,
                    transform: "translate(-50%, -50%)",
                    borderRadius: "50%",
                    background: "radial-gradient(circle at 50% 42%, #FFF4E6 0%, #FFD0A7 20%, #F5A843 42%, #E8622A 68%, #7B230C 100%)",
                    animation: "foundryCorePulse 1.9s ease-in-out infinite",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        left: "50%",
                        top: "50%",
                        width: innerCore * 0.52,
                        height: innerCore * 0.76,
                        transform: "translate(-50%, -50%)",
                        animation: "foundryCoreFlicker 1.1s ease-in-out infinite",
                        filter: "drop-shadow(0 0 8px rgba(255,208,167,0.24))",
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            clipPath: "path('M 14 42 C 8 33, 7 26, 10 19 C 12 14, 16 10, 18 2 C 22 7, 27 12, 29 20 C 31 28, 29 35, 14 42 Z')",
                            background: "linear-gradient(180deg, #FFF4E6 0%, #FFD0A7 28%, #F5A843 56%, #E8622A 78%, #8F2A0E 100%)",
                        }}
                    />
                    <div
                        style={{
                            position: "absolute",
                            left: "50%",
                            top: "46%",
                            width: innerCore * 0.18,
                            height: innerCore * 0.28,
                            transform: "translate(-50%, -50%)",
                            clipPath: "path('M 7 16 C 4.5 12, 4.6 9, 5.7 6.5 C 6.4 4.7, 7.7 3, 8.2 1 C 10.1 3, 11.5 4.9, 12 7.6 C 12.6 10.5, 11.4 13.3, 7 16 Z')",
                            background: "linear-gradient(180deg, rgba(255,250,244,0.96) 0%, rgba(255,226,191,0.98) 46%, rgba(245,168,67,0.72) 100%)",
                            filter: "blur(0.4px)",
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
