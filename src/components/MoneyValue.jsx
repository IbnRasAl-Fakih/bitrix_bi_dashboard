import TengeIcon from '../icons/TengeIcon.jsx';

const numberFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 0
});

export function formatMoneyText(value) {
  return numberFormatter.format(Number(value || 0));
}

export default function MoneyValue({ value, className = '' }) {
  return (
    <span className={`inline-flex items-baseline gap-1 leading-none ${className}`}>
      <span className="tabular-nums leading-none">{formatMoneyText(value)}</span>
      <TengeIcon className="relative top-[0.08em] h-[0.78em] w-[0.78em] shrink-0" />
    </span>
  );
}
