import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './controls';

export function Dialog({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`flex max-h-[min(88vh,760px)] w-full flex-col overflow-hidden rounded-xl border border-line-2 bg-panel shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-md'}`}>
        <div className="flex h-12 shrink-0 items-center border-b border-line pl-4 pr-2">
          <h2 className="flex-1 text-[14px] font-semibold text-ink">{title}</h2>
          <IconButton label="Cerrar" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
