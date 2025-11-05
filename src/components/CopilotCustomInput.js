import {useCopilotChat, useCopilotContext} from "@copilotkit/react-core";
import { useRef } from "react";

//import {SidebarControlContext} from "@/contexts/SidebarControlContext";

/**
 * @typedef {Object} CopilotCustomInputProps
 * @property {boolean} inProgress
 * @property {function} onSend
 * @property {boolean} isVisible
 * @property {string} [costInfo]
 * @property {function} [onReset]
 */

/**
 * @param {CopilotCustomInputProps} props
 */
export function CopilotCustomInput({inProgress, onSend, isVisible, costInfo, onReset}) {
    const {reset: resetChat} = useCopilotChat(); // Get reset function
    const {setThreadId} = useCopilotContext();
    const textareaRef = useRef(null);
    // const {setOpen} = useChatContext()
    // const sidebarControl = useContext(SidebarControlContext);
    // Provide setOpen to the context
    // useEffect(() => {
    //     if (sidebarControl && setOpen) {
    //         sidebarControl.setOpen = setOpen;
    //     }
    // }, [setOpen, sidebarControl]);

    // Auto-resize textarea based on content
    const autoResizeTextarea = () => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`; // Max height of 150px
        }
    };


    return (
        <div style={{
            display: isVisible ? "block" : "none",
            borderTop: "1px solid #eee"
        }}>


            {/* Input Controls */}
            <div style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "10px",
                padding: "10px"
            }}>
                {/* Text Input */}
                <textarea
                    ref={textareaRef}
                    disabled={inProgress}
                    placeholder="Ask here ... (Press Ctrl+Enter to send) ... Sponsored by CelerData ... Powered by CopilotKit"
                    style={{
                        flex: 1,
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                        outline: "none",
                        resize: "none",
                        minHeight: "40px",
                        maxHeight: "150px",
                        overflow: "auto",
                        fontFamily: "inherit",
                        fontSize: "14px",
                        lineHeight: "1.4"
                    }}
                    onInput={autoResizeTextarea}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && e.ctrlKey) {
                            e.preventDefault();
                            const value = e.currentTarget.value.trim();
                            if (value) {
                                onSend(value);
                                e.currentTarget.value = "";
                                autoResizeTextarea();
                            }
                        }
                    }}
                />

                {/* Send Button */}
                <button
                    disabled={inProgress}
                    style={{
                        padding: "8px 12px",
                        border: "none",
                        borderRadius: "4px",
                        background: "#007bff",
                        color: "white",
                        cursor: "pointer",
                    }}
                    onClick={(e) => {
                        const textarea = e.currentTarget.previousElementSibling;
                        if (textarea && typeof window !== 'undefined') {
                            const value = textarea.value.trim();
                            if (value) {
                                onSend(value);
                                textarea.value = "";
                                autoResizeTextarea();
                            }
                        }
                    }}
                >
                    Send
                </button>

                {/* Reset Chat Button */}
                <button
                    style={{
                        padding: "8px 12px",
                        border: "none",
                        borderRadius: "4px",
                        background: "#f44336",
                        color: "white",
                        cursor: "pointer",
                    }}
                    onClick={() => {
                        setThreadId(crypto.randomUUID());
                        resetChat();
                        if (onReset) {
                            onReset();
                        }
                    }}
                >
                    Reset
                </button>
            </div>
        </div>
    );
}
