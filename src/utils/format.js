import { createElement } from 'react';
import MoneyValue, { formatMoneyText } from '../components/MoneyValue.jsx';
import TengeIcon from '../icons/TengeIcon.jsx';

export function formatMoney(value) {
  return createElement(MoneyValue, { value });
}

export function formatMoneyTooltip(value) {
  return createElement(
    'span',
    { className: 'inline-flex items-center gap-1' },
    formatMoneyText(value),
    createElement(TengeIcon, { className: 'h-3.5 w-3.5' })
  );
}

export function formatKpi(key, value) {
  if (['income', 'expense', 'profit'].includes(key)) return formatMoney(value || 0);
  if (['avgLoad', 'completionRate', 'teamLoad'].includes(key)) return `${value || 0}%`;
  return Number(value || 0).toLocaleString('ru-RU');
}

export function formatCell(key, value) {
  if (value === null || value === undefined || value === '') return '-';
  if (['income', 'expense', 'profit'].includes(key)) return formatMoney(value);
  if (key === 'createdAt' || ['createdTime', 'updatedTime', 'movedTime'].includes(key)) {
    return new Date(value).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
  }
  if (['deadline', 'closedAt', 'lastActivity', 'startDate', 'endDate', 'startDatePlan', 'endDatePlan', 'activityAt', 'registeredAt', 'completedAt'].includes(key)) {
    return new Date(value).toLocaleDateString('ru-RU');
  }
  if (key === 'status') {
    return {
      open: 'Открыта',
      progress: 'В работе',
      closed: 'Выполнена',
      active: 'Активный',
      completed: 'Завершен'
    }[value] || value;
  }
  if (key === 'risk') return riskLabel(value);
  if (key === 'overdue' || key === 'violated') return value ? 'Да' : 'Нет';
  if (key === 'url') {
    return value
      ? createElement('a', { className: 'text-brand-600 hover:underline', href: value, target: '_blank', rel: 'noreferrer' }, 'Открыть')
      : '-';
  }
  return String(value);
}

export function statusLabel(status) {
  return {
    idle: 'ожидание',
    running: 'идет синхронизация',
    success: 'успешно',
    partial: 'частично успешно',
    error: 'ошибка'
  }[status] || status;
}

export function riskLabel(risk) {
  return { low: 'все хорошо', medium: 'есть отклонения', high: 'высокий риск' }[risk] || risk;
}

export function sourceLabel(source) {
  if (source === 'bitrix-demo') return 'Bitrix24 + демонстрационные дополнения';
  return source === 'bitrix' ? 'реальные данные Bitrix24' : 'нет подключенных данных';
}

