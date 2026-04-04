/**
 * TimePicker — Popover-based hour:minute selector.
 *
 * Two Select dropdowns (hours 6–22, minutes 00/15/30/45).
 * Stores value as 24h "HH:MM", displays in user's locale format (12h/24h).
 *
 * @see E50-S05
 */

import { Clock } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import { Button } from '@/app/components/ui/button'

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6) // 6–22
const MINUTES = ['00', '15', '30', '45']

interface TimePickerProps {
  value: string // "HH:MM"
  onChange: (time: string) => void
}

function formatTimeLocale(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const date = new Date(2000, 0, 1, h, m)
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function TimePicker({ value, onChange }: TimePickerProps) {
  const [rawHour, minute] = value.split(':')
  const hour = rawHour.padStart(2, '0')

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start gap-2 min-h-[44px] font-normal"
          aria-label="Select start time"
        >
          <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
          {formatTimeLocale(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <div className="flex items-center gap-2">
          <Select value={hour} onValueChange={h => onChange(`${h}:${minute}`)}>
            <SelectTrigger className="flex-1" aria-label="Hour">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOURS.map(h => (
                <SelectItem key={h} value={String(h).padStart(2, '0')}>
                  {String(h).padStart(2, '0')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground font-medium">:</span>
          <Select value={minute} onValueChange={m => onChange(`${hour}:${m}`)}>
            <SelectTrigger className="flex-1" aria-label="Minute">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MINUTES.map(m => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  )
}
