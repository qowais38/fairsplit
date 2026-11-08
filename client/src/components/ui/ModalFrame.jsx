import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function ModalFrame({ eyebrow, title, onClose, children, size = '' }) {
  useEffect(() => {
    const onKeyDown = event => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    document.body.classList.add('modal-open')
    return () => { document.removeEventListener('keydown', onKeyDown); document.body.classList.remove('modal-open') }
  }, [onClose])
  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className={`modal-card ${size}`} role="dialog" aria-modal="true" aria-label={title}><header className="modal-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><button type="button" className="modal-close" aria-label="Close dialog" onClick={onClose}><X size={18}/></button></header>{children}</section></div>
}
