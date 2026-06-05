import { Search } from '../icons/index.jsx';
import Dropdown from './Dropdown.jsx';

export function Select({ value, onChange, options, placeholder = 'Все', icon }) {
  return <Dropdown value={value} onChange={onChange} options={options} placeholder={placeholder} icon={icon} />;
}

export function SearchField({ value, onChange, placeholder = 'Поиск', className = '' }) {
  return (
    <label className={`field ${className}`}>
      <Search size={16} />
      <input className="field-input w-40" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}
