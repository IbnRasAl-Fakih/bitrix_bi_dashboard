export default function Metric({ title, value }) {
  return (
    <section className="panel p-4">
      <span className="text-sm text-slate-500 dark:text-slate-400">{title}</span>
      <strong className="mt-2 block text-3xl font-bold">{value}</strong>
    </section>
  );
}
