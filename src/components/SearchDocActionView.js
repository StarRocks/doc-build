import {useState} from "react";
import * as Accordion from "@radix-ui/react-accordion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDownIcon, MagnifyingGlassIcon, FileTextIcon } from "@radix-ui/react-icons";
import { memo } from "react";

// Helper function to convert doc path to StarRocks docs URL
const convertPathToUrl = (path, doc_type) => {
    // Remove .md extension and convert to StarRocks docs URL
    // Example: best_practices/query_tuning/query_planning.md -> https://docs.starrocks.io/docs/best_practices/query_tuning/query_planning
    const pathWithoutExtension = path.replace(/\.md$/, '');
    if (doc_type === "byoc") {
        return `https://docs.celerdata.com/BYOC/docs/${pathWithoutExtension}`;
    } else {
        return `https://docs.starrocks.io/docs/${pathWithoutExtension}`;
    }
};

export const SearchDocActionView = memo(function SearchDocActionView(props) {
    const {inProgress, actionResult} = props;
    const [expanded, setExpanded] = useState(false);
    const [documentExpanded, setDocumentExpanded] = useState([]);
    
    // Always show the component if action is in progress or has results
    if (!inProgress && !actionResult) {
        return null;
    }
    
    let docSearchArtifact = null;
    if (actionResult) {
        docSearchArtifact = typeof actionResult === "string" ? JSON.parse(actionResult) : actionResult;
        // Initialize document expansion state
        if (docSearchArtifact?.docs && documentExpanded.length !== docSearchArtifact.docs.length) {
            setDocumentExpanded(new Array(docSearchArtifact.docs.length).fill(false));
        }
    }

    const toggleDocumentExpansion = (index) => {
        setDocumentExpanded(prev => {
            const newState = [...prev];
            newState[index] = !newState[index];
            return newState;
        });
    };

    return (
        <div className="w-full max-w-none">
            <Accordion.Root
                type="single"
                collapsible
                className="w-full"
                value={expanded ? "search-result" : ""}
                onValueChange={(value) => setExpanded(!!value)}
            >
                <Accordion.Item value="search-result" className="border border-indigo-200 rounded-lg bg-F3F3F3">
                    <Accordion.Trigger
                        className="flex w-full items-center justify-between px-4 py-3 text-left font-medium bg-F3F3F3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded-t-lg"
                    >
                        <div className="flex items-center gap-3 flex-1">
                            <MagnifyingGlassIcon className="h-5 w-5 text-black" />
                            <div className="flex flex-col items-start flex-1 min-w-0">
                                {inProgress ? (
                                    <>
                                        <span className="text-sm font-semibold text-black">
                                            Searching Documents...
                                        </span>
                                    </>
                                ) : docSearchArtifact ? (
                                    <>
                                        <div className="flex items-center gap-3 w-full">
                                            <span className="text-sm font-semibold text-black">
                                                Search Results ({docSearchArtifact.docs?.length || 0} found)
                                            </span>
                                            {!expanded && docSearchArtifact.docs.length > 0 && (
                                                <div className="flex items-center gap-2 text-xs link-338393 min-w-0">
                                                    <span className="text-black">•</span>
                                                    {docSearchArtifact.docs.map((doc, index) => {
                                                        const filename = doc.path.split('/').pop() || doc.path;
                                                        return (
                                                            <div key={index} className="flex items-center gap-1">
                                                                {index > 0 && <span className="link-338393">,</span>}
                                                                <span className="truncate max-w-32" title={filename}>
                                                                    {filename}
                                                                </span>
                                                                <a 
                                                                    href={convertPathToUrl(doc.path, docSearchArtifact.doc_type)}
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer"
                                                                    className="text-xs link-338393 underline flex-shrink-0"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    title={convertPathToUrl(doc.path, docSearchArtifact.doc_type)}
                                                                >
                                                                    ↗
                                                                </a>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-xs text-black mt-1 flex items-center gap-2 min-w-0">
                                            <span className="truncate" title={`Query: "${docSearchArtifact.query}"`}>
                                                Query: &quot;{docSearchArtifact.query}&quot;
                                            </span>
                                            <span className="flex-shrink-0">
                                                • {docSearchArtifact.duration.toFixed(2)}s
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-sm font-semibold text-black">
                                            Document Search
                                        </span>
                                        <span className="text-xs text-black mt-1">
                                            No results available
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                        <ChevronDownIcon
                            className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${
                                expanded ? 'rotate-180' : ''
                            }`}
                        />
                    </Accordion.Trigger>
                    <Accordion.Content className="px-4 py-3 border-t border-indigo-200">
                        <div className="space-y-3">
                            {inProgress ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="flex items-center gap-3">
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                                        <span className="text-sm text-black">Searching documentation...</span>
                                    </div>
                                </div>
                            ) : docSearchArtifact && docSearchArtifact.docs && docSearchArtifact.docs.length > 0 ? (
                                docSearchArtifact.docs.map((doc, index) => (
                                    <div key={index} className="border border-white rounded-lg bg-white shadow-sm">
                                        <div>
                                            <button
                                                onClick={() => toggleDocumentExpansion(index)}
                                                className="w-full flex items-center justify-between px-4 py-3 text-left bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 rounded-lg"
                                            >
                                                <div className="flex items-center gap-3 flex-1">
                                                    <FileTextIcon className="h-4 w-4 text-black flex-shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <a
                                                            href={convertPathToUrl(doc.path, docSearchArtifact.doc_type)}
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="text-xs link-338393 underline"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            {doc.path}
                                                        </a>
                                                    </div>
                                                </div>
                                                <ChevronDownIcon
                                                    className={`h-4 w-4 text-gray-500 transition-transform duration-200 flex-shrink-0 ${
                                                        documentExpanded[index] ? 'rotate-180' : ''
                                                    }`}
                                                />
                                            </button>
                                            {!documentExpanded[index] && (
                                                <div className="px-4 pb-3 border-t border-gray-100">
                                                    <div className="text-xs text-gray-600 mt-2 line-clamp-3">
                                                        {doc.text.substring(0, 300)}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {documentExpanded[index] && (
                                            <div className="px-4 pb-4 border-t border-gray-100">
                                                <div className="prose prose-sm max-w-none text-gray-700 mt-3">
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm]}
                                                        components={{
                                                            h1: ({children}) => <h1 className="text-lg font-bold mb-2 text-gray-900">{children}</h1>,
                                                            h2: ({children}) => <h2 className="text-md font-semibold mb-2 text-gray-900">{children}</h2>,
                                                            h3: ({children}) => <h3 className="text-sm font-medium mb-1 text-gray-900">{children}</h3>,
                                                            p: ({children}) => <p className="mb-2 text-sm text-gray-700">{children}</p>,
                                                            ul: ({children}) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                                                            ol: ({children}) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                                                            li: ({children}) => <li className="text-sm text-gray-700">{children}</li>,
                                                            code: ({children, className}) => {
                                                                const isInline = !className;
                                                                return isInline ? (
                                                                    <code className="bg-gray-200 px-1 py-0.5 rounded text-xs font-mono text-gray-800">
                                                                        {children}
                                                                    </code>
                                                                ) : (
                                                                    <code className="block bg-gray-200 p-2 rounded text-xs font-mono text-gray-800 overflow-x-auto">
                                                                        {children}
                                                                    </code>
                                                                );
                                                            },
                                                            pre: ({children}) => (
                                                                <pre className="bg-gray-200 p-2 rounded overflow-x-auto mb-2">
                                                                    {children}
                                                                </pre>
                                                            ),
                                                        }}
                                                    >
                                                        {doc.text}
                                                    </ReactMarkdown>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    <span className="text-sm">No documents found</span>
                                </div>
                            )}
                        </div>
                    </Accordion.Content>
                </Accordion.Item>
            </Accordion.Root>
        </div>
    );
});
