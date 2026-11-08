import { usePeople } from '../../hooks/usePeople'
export default function Avatar({ id, size = 'md', className = '' }) {
  const people = usePeople()
  const person = people.find(item => item.id === id) || { name: id, initials: String(id).slice(0,2).toUpperCase(), tone: 'sage' }
  return <span className={`avatar avatar-${person.tone} avatar-${size} ${className}`} title={person.name} aria-label={person.name}>{person.initials}</span>
}
