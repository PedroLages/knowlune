/**
 * CatalogListView — displays connected OPDS catalogs with edit/remove actions,
 * or an empty state prompting the user to add their first catalog.
 *
 * @module CatalogListView
 * @since E88-S01
 */

import { Globe, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Separator } from '@/app/components/ui/separator'
import type { OpdsCatalog } from '@/data/types'

interface CatalogListViewProps {
  catalogs: OpdsCatalog[]
  onAdd: () => void
  onEdit: (catalog: OpdsCatalog) => void
  onDelete: (catalog: OpdsCatalog) => void
}

export function CatalogListView({ catalogs, onAdd, onEdit, onDelete }: CatalogListViewProps) {
  return (
    <div className="flex flex-col gap-4">
      {catalogs.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Globe className="size-12 text-muted-foreground/40" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">No catalogs connected yet.</p>
          <p className="text-xs text-muted-foreground max-w-xs text-center">
            Connect to a Calibre-Web or other OPDS-compatible server to browse your book
            collection.
          </p>
        </div>
      )}

      {catalogs.length > 0 && (
        <ul
          className="flex flex-col divide-y divide-border/50"
          role="list"
          aria-label="Connected OPDS catalogs"
        >
          {catalogs.map(catalog => (
            <li
              key={catalog.id}
              className="flex items-center justify-between gap-3 py-3"
              data-testid={`opds-catalog-item-${catalog.id}`}
            >
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-foreground truncate">{catalog.name}</span>
                <span className="text-xs text-muted-foreground truncate">{catalog.url}</span>
                {catalog.lastSynced && (
                  <span className="text-xs text-muted-foreground">
                    Last synced:{' '}
                    {new Date(catalog.lastSynced).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(catalog)}
                  className="size-9"
                  aria-label={`Edit ${catalog.name}`}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(catalog)}
                  className="size-9 text-destructive hover:text-destructive"
                  aria-label={`Remove ${catalog.name}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Separator />

      <Button
        variant="brand-outline"
        onClick={onAdd}
        className="min-h-[44px] w-full"
        data-testid="add-opds-catalog-btn"
      >
        <Plus className="mr-2 size-4" />
        Add Catalog
      </Button>
    </div>
  )
}
