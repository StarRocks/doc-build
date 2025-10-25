import {useState} from "react";

export function GeneralToolCallView(props) {
    const {message, inProgress, actionResult} = props;
    const [expanded, setExpanded] = useState(false); // Default to folded state
    // Determine status color
    const statusColor = message.status?.code === "Success"
        ? "#4caf50" // Green for success
        : message.status?.code === "Error"
            ? "#f44336" // Red for error
            : "#ff9800"; // Orange for other statuses

    // Create a summary of the arguments
    const getArgumentsSummary = () => {
        if (!message.arguments) return "";

        // For database queries, show a simplified summary
        if (message.name === "run_query" && message.arguments.query) {
            const query = message.arguments.query;
            const db = message.arguments.database;
            return `${db ? `DB: ${db}` : ""} ${query.length > 30 ? query.substring(0, 30) + "..." : query}`;
        }

        // For other types of arguments
        return Object.entries(message.arguments)
            .map(([key, value]) => {
                const valueStr = typeof value === 'string'
                    ? (value.length > 15 ? value.substring(0, 15) + "..." : value)
                    : "...";
                return `${key}: ${valueStr}`;
            })
            .join(", ");
    };

    return (
        <div style={{
            margin: "10px 0",
            padding: "12px",
            borderRadius: "6px",
            backgroundColor: "#1e1e1e",
            color: "#e0e0e0",
            fontFamily: "monospace",
            fontSize: "14px",
            border: "1px solid #333",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
        }}>
            <style>{`
                @keyframes pulse {
                    0% {
                        opacity: 0.3;
                    }
                    50% {
                        opacity: 1;
                    }
                    100% {
                        opacity: 0.3;
                    }
                }
            `}</style>
            <div style={{
                display: "flex",
                justifyContent: "space-between",
                paddingBottom: expanded ? "8px" : "0",
                marginBottom: expanded ? "8px" : "0",
                borderBottom: expanded ? "1px solid #444" : "none",
                cursor: "pointer",
            }}
                 onClick={() => setExpanded(!expanded)}>
                <div style={{fontWeight: "bold", display: "flex", alignItems: "center"}}>
                    <span style={{
                        transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                        transition: "transform 0.2s",
                        display: "inline-block",
                        marginRight: "8px"
                    }}>▶</span>
                    <span>
                        Tool: <span style={{color: "#42a5f5"}}>{message.name}</span>
                        {!expanded && (
                            <span style={{color: "#a0a0a0", fontSize: "12px", marginLeft: "8px"}}>
                                {getArgumentsSummary()}
                            </span>
                        )}
                    </span>
                </div>
                <div style={{display: "flex", alignItems: "center", gap: "8px"}}>
                    <span style={{
                        backgroundColor: statusColor,
                        color: "white",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        alignSelf: "flex-start"
                    }}>
                        {message.status?.code || "Processing"}
                    </span>
                </div>
            </div>

            {expanded && (
                <>
                    {message.arguments && (
                        <div style={{marginBottom: "8px"}}>
                            <div style={{color: "#bdbdbd", marginBottom: "4px"}}>Arguments:</div>
                            <div style={{
                                backgroundColor: "#2d2d2d",
                                padding: "8px",
                                borderRadius: "4px",
                                maxHeight: "150px",
                                overflow: "auto"
                            }}>
                                {Object.entries(message.arguments).map(([key, value]) => (
                                    <div key={key} style={{marginBottom: "4px"}}>
                                        <span style={{color: "#ff9800"}}>{key}:</span>{" "}
                                        <span style={{color: "#8bc34a"}}>
                                            {typeof value === 'string' ? `"${value}"` : JSON.stringify(value)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {inProgress && (
                        <div style={{
                            marginTop: "8px",
                            display: "flex",
                            alignItems: "center"
                        }}>
                            <div style={{
                                width: "12px",
                                height: "12px",
                                borderRadius: "50%",
                                backgroundColor: "#42a5f5",
                                marginRight: "8px",
                                animation: "pulse 1.5s infinite ease-in-out"
                            }}></div>
                            <span>Executing...</span>
                        </div>
                    )}

                    {actionResult && (
                        <div style={{
                            marginTop: "10px",
                            borderTop: "1px solid #444",
                            paddingTop: "8px"
                        }}>
                            <div style={{color: "#bdbdbd", marginBottom: "4px"}}>Result:</div>
                            <div style={{
                                backgroundColor: "#2d2d2d",
                                padding: "8px",
                                borderRadius: "4px",
                                maxHeight: "200px",
                                overflow: "auto"
                            }}>
                                <pre style={{margin: 0}}>
                                    {typeof actionResult === 'object'
                                        ? JSON.stringify(actionResult, null, 2)
                                        : actionResult.toString()}
                                </pre>
                            </div>
                        </div>
                    )}
                </>
            )}

            {!expanded && inProgress && (
                <div style={{
                    marginTop: "4px",
                    display: "flex",
                    alignItems: "center"
                }}>
                    <div style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: "#42a5f5",
                        marginRight: "6px",
                        animation: "pulse 1.5s infinite ease-in-out"
                    }}></div>
                    <span style={{fontSize: "12px"}}>Executing...</span>
                </div>
            )}

            {!expanded && actionResult && (
                <div style={{marginTop: "4px", fontSize: "12px", color: "#a0a0a0"}}>
                    Result available (click to expand)
                </div>
            )}
        </div>
    );
}