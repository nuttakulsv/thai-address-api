// A small, dependency-free React component for the /v1/search endpoint.
// Copy it into your app and adjust the styling.
import { useEffect, useId, useState } from 'react'

export interface Area {
  id: number
  labelTh: string
  labelEn: string
  subDistrict: { id: number; districtId: number; provinceId: number; postcode: string }
}

interface Props {
  apiBase: string
  onSelect: (area: Area) => void
  placeholder?: string
}

export function AddressAutocomplete({ apiBase, onSelect, placeholder = 'ตำบล อำเภอ จังหวัด หรือรหัสไปรษณีย์' }: Props) {
  const listId = useId()
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<Area[]>([])
  const [active, setActive] = useState(0)

  useEffect(() => {
    const q = query.trim()
    if (!q) return setItems([])
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      const url = `${apiBase}/v1/search?type=subDistrict&limit=8&q=${encodeURIComponent(q)}`
      try {
        const res = await fetch(url, { signal: controller.signal })
        setItems((await res.json()).data)
        setActive(0)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') throw err
      }
    }, 150)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [apiBase, query])

  const choose = (area: Area) => {
    setQuery(area.labelTh)
    setItems([])
    onSelect(area)
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        role="combobox"
        aria-controls={listId}
        aria-expanded={items.length > 0}
        autoComplete="off"
        value={query}
        placeholder={placeholder}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setActive((i) => Math.min(i + 1, items.length - 1))
          else if (e.key === 'ArrowUp') setActive((i) => Math.max(i - 1, 0))
          else if (e.key === 'Enter' && items[active]) choose(items[active])
          else if (e.key === 'Escape') setItems([])
          else return
          e.preventDefault()
        }}
      />
      {items.length > 0 && (
        <ul id={listId} role="listbox">
          {items.map((area, i) => (
            <li
              key={area.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(area)
              }}
            >
              {area.labelTh}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
