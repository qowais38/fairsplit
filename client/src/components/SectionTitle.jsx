export default function SectionTitle({ eyebrow, title, description, action, compact = false }) {
  return <div className={`section-title ${compact ? 'section-title-compact' : ''}`}><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="section-title-action">{action}</div>}</div>
}
