import { useEffect } from "react";

type TermlyEmbedProps = {
    policyId: string;
};

export default function TermlyEmbed({ policyId }: TermlyEmbedProps) {
    useEffect(() => {
        const scriptId = "termly-jssdk";
        if (!document.getElementById(scriptId)) {
            const script = document.createElement("script");
            script.id = scriptId;
            script.src = "https://app.termly.io/embed-policy.min.js";
            document.body.appendChild(script);
        } else {
            (window as any).termly?.initialize?.();
        }
    }, []);

    return (
        <div
            style={{
                background: "#f8f6f2",
                borderRadius: 12,
                padding: "28px 32px",
                border: "1px solid rgba(255,255,255,0.07)",
                color: "#1a1a1a",
                fontSize: 14,
                lineHeight: 1.75,
            }}
        >
            <div name="termly-embed" data-id={policyId} />
        </div>
    );
}
