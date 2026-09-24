/** Code shown with a question or flashcard: monospace, scrolls sideways instead of wrapping (no highlighter on purpose). */
export default function CodeBlock({ code, className = "" }: Readonly<{ code?: string; className?: string }>) {
  if (!code) return null;
  return (
    <pre className={`overflow-x-auto rounded-2xl border-2 border-b-4 border-zinc-200 bg-zinc-50 p-4 text-left font-mono text-sm leading-relaxed font-medium text-zinc-800 ${className}`}>
      <code>{code}</code>
    </pre>
  );
}
