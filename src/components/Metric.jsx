export default function Metric({ title, value, onClick }) {
  const Tag = onClick ? 'button' : 'section';
  return (
    <Tag className={`panel p-4 text-left ${onClick ? 'transition hover:-translate-y-0.5 hover:border-brand-500' : ''}`} onClick={onClick}>
      <span className="text-sm text-slate-500 dark:text-slate-400">{title}</span>
      <strong className="mt-2 block text-3xl font-bold">{value}</strong>
    </Tag>
  );
}
