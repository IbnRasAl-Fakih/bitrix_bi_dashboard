import { useEffect, useState } from 'react';
import { Download, FileText, Trash2, Upload } from '../icons/index.jsx';

const allowedTypes = new Set(['application/pdf']);
const typeByExtension = { '.pdf': 'application/pdf' };
const maxFileBytes = 50 * 1024 * 1024;

export default function InstructionsPage() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadFile();
  }, []);

  async function loadFile() {
    setLoading(true);
    try {
      const response = await fetch('/api/instructions');
      const json = await response.json();
      setFile((json.files || [])[0] || null);
    } catch {
      setMessage('Не удалось загрузить инструкцию');
    } finally {
      setLoading(false);
    }
  }

  async function uploadFile(event) {
    const nextFile = event.target.files?.[0];
    event.target.value = '';
    if (!nextFile) return;

    setMessage('');
    const mimeType = nextFile.type || typeByExtension[fileExtension(nextFile.name)] || '';
    if (!allowedTypes.has(mimeType)) {
      setMessage('Поддерживаются только PDF-файлы');
      return;
    }
    if (nextFile.size > maxFileBytes) {
      setMessage('Размер файла должен быть до 50 МБ');
      return;
    }

    setUploading(true);
    try {
      const content = await fileToBase64(nextFile);
      const response = await fetch('/api/instructions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nextFile.name, mimeType, content })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Не удалось загрузить файл');
      setFile(json.file);
      setMessage('Файл загружен');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setUploading(false);
    }
  }

  async function deleteFile() {
    if (!file) return;
    setMessage('');
    const response = await fetch(`/api/instructions/${file.id}`, { method: 'DELETE' });
    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      setMessage(json.error || 'Не удалось удалить файл');
      return;
    }
    setFile(null);
  }

  return (
    <div className="grid min-h-[calc(100vh-2rem)] grid-rows-[minmax(0,1fr)_auto] gap-4">
      <section className="panel min-h-0 overflow-hidden">
        {loading ? (
          <div className="grid h-full min-h-[620px] place-items-center p-6 text-sm text-slate-500">
            Загрузка инструкции...
          </div>
        ) : file ? (
          <div className="flex h-full min-h-[620px] flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold">{file.originalName}</h2>
                <p className="text-xs text-slate-500">{formatSize(file.size)}</p>
              </div>
              <div className="flex gap-2">
                <a className="btn" href={`/api/instructions/${file.id}/download`}>
                  <Download size={18} />
                  Скачать
                </a>
                <button className="icon-btn" title="Удалить" aria-label="Удалить" onClick={deleteFile}>
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            <iframe
              className="min-h-0 flex-1 bg-white"
              title={file.originalName}
              src={`/api/instructions/${file.id}/view`}
            />
          </div>
        ) : (
          <div className="grid h-full min-h-[620px] place-items-center p-6 text-center text-sm text-slate-500">
            <div>
              <FileText className="mx-auto mb-4 text-slate-400" size={48} />
              <p>Инструкция еще не загружена.</p>
            </div>
          </div>
        )}
      </section>

      <section className="panel p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-bold">Инструкция</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Загрузка, просмотр и скачивание рабочей инструкции в PDF.
            </p>
          </div>
          <label className={`btn btn-primary w-fit cursor-pointer ${uploading ? 'pointer-events-none opacity-60' : ''}`}>
            <Upload size={18} />
            {uploading ? 'Загрузка...' : file ? 'Заменить файл' : 'Загрузить файл'}
            <input
              className="hidden"
              type="file"
              accept=".pdf,application/pdf"
              onChange={uploadFile}
              disabled={uploading}
            />
          </label>
        </div>
        {message && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {message}
          </div>
        )}
      </section>
    </div>
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatSize(bytes = 0) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

function fileExtension(name = '') {
  const index = name.lastIndexOf('.');
  return index >= 0 ? name.slice(index).toLowerCase() : '';
}
