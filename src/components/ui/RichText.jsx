import { useMemo } from "react";
import { hasRichContent, richHtml } from "../../utils/richText";

// Shows question text with LaTeX ($…$) rendered and {{IMG::url}} images. Plain text stays plain.
export default function RichText({ text, as: Tag = "span", className = "" }) {
  const html = useMemo(() => (hasRichContent(text) ? richHtml(text) : null), [text]);
  if (html === null) return <Tag className={`whitespace-pre-line ${className}`}>{text}</Tag>;
  return <Tag className={`qp-rich ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
