import DataTable from '../components/DataTable.jsx';

const columns = [
  ['requestNumber', 'Номер заявки'],
  ['shortDescription', 'Краткое описание заявки'],
  ['fullDescription', 'Полное описание заявки'],
  ['requestType', 'Тип заявки'],
  ['initiator', 'Инициатор'],
  ['assignee', 'Исполнитель'],
  ['solution', 'Решение'],
  ['registeredAt', 'Дата регистрации заявки'],
  ['completedAt', 'Дата выполнения заявки'],
  ['closedAt', 'Дата закрытия заявки'],
  ['violated', 'Нарушено']
];

export default function ItsmPage({ data }) {
  return (
    <DataTable title="Заявки ITSM" rows={data.itsmRequests || []} columns={columns} />
  );
}
