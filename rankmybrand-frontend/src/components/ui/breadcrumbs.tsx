import * as React from "react"
import { ChevronRight, Home } from "lucide-react"
import { cn } from "@/lib/utils"

interface BreadcrumbItem {
  label: string
  href?: string
  icon?: React.ReactNode
  current?: boolean
}

interface BreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[]
  separator?: React.ReactNode
  showHome?: boolean
  maxItems?: number
}

const Breadcrumbs = React.forwardRef<HTMLElement, BreadcrumbsProps>(
  ({
    items,
    separator = <ChevronRight className="h-4 w-4" />,
    showHome = true,
    maxItems,
    className,
    ...props
  }, ref) => {
    const [expanded, setExpanded] = React.useState(false)

    const shouldCollapse = maxItems && items.length > maxItems
    const displayItems = shouldCollapse && !expanded
      ? [
          ...items.slice(0, 1),
          { label: "...", href: undefined, current: false },
          ...items.slice(items.length - (maxItems - 2)),
        ]
      : items

    return (
      <nav
        ref={ref}
        aria-label="Breadcrumb"
        className={cn("flex items-center space-x-1 text-sm", className)}
        {...props}
      >
        <ol className="flex items-center space-x-1">
          {showHome && (
            <>
              <li>
                <a
                  href="/"
                  className="flex items-center text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Home"
                >
                  <Home className="h-4 w-4" />
                </a>
              </li>
              <li className="flex items-center text-muted-foreground" aria-hidden="true">
                {separator}
              </li>
            </>
          )}
          {displayItems.map((item, index) => {
            const isLast = index === displayItems.length - 1
            const isEllipsis = item.label === "..."

            if (isEllipsis) {
              return (
                <React.Fragment key={`ellipsis-${index}`}>
                  <li>
                    <button
                      onClick={() => setExpanded(true)}
                      className="flex items-center text-muted-foreground transition-colors hover:text-foreground"
                      aria-label="Show all breadcrumbs"
                    >
                      ...
                    </button>
                  </li>
                  {!isLast && (
                    <li className="flex items-center text-muted-foreground" aria-hidden="true">
                      {separator}
                    </li>
                  )}
                </React.Fragment>
              )
            }

            return (
              <React.Fragment key={item.href || item.label}>
                <li>
                  {item.href && !item.current ? (
                    <a
                      href={item.href}
                      className={cn(
                        "flex items-center gap-1 transition-colors hover:text-foreground",
                        isLast || item.current
                          ? "text-foreground font-medium"
                          : "text-muted-foreground"
                      )}
                      aria-current={item.current ? "page" : undefined}
                    >
                      {item.icon}
                      {item.label}
                    </a>
                  ) : (
                    <span
                      className={cn(
                        "flex items-center gap-1",
                        isLast || item.current
                          ? "text-foreground font-medium"
                          : "text-muted-foreground"
                      )}
                      aria-current={item.current ? "page" : undefined}
                    >
                      {item.icon}
                      {item.label}
                    </span>
                  )}
                </li>
                {!isLast && (
                  <li className="flex items-center text-muted-foreground" aria-hidden="true">
                    {separator}
                  </li>
                )}
              </React.Fragment>
            )
          })}
        </ol>
      </nav>
    )
  }
)
Breadcrumbs.displayName = "Breadcrumbs"

export { Breadcrumbs }
export type { BreadcrumbsProps, BreadcrumbItem }
