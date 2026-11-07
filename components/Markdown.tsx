import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Markdown({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div
      className={`prose prose-invert prose-sm max-w-none prose-headings:font-display prose-headings:tracking-tight prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-a:text-sky-300 prose-strong:text-white prose-li:my-0.5 prose-table:text-xs prose-th:bg-white/5 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 prose-hr:border-white/10 ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" />,
          table: (props) => (
            <div className="not-prose overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-xs text-slate-300 [&_td]:border-t [&_td]:border-white/5 [&_td]:px-3 [&_td]:py-2 [&_th]:bg-white/5 [&_th]:px-3 [&_th]:py-2 [&_th]:font-semibold [&_th]:text-white" {...props} />
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
