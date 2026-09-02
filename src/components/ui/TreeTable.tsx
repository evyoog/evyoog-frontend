import { Fragment, useEffect, useState, type ReactNode } from 'react';

export interface TreeTableColumn<T> {
  header: string;
  width?: string;
  align?: 'left' | 'right' | 'center';
  render: (node: T) => ReactNode;
}

export interface UseTreeExpandOptions<T> {
  nodes: T[];
  getChildren: (node: T) => T[];
  getId: (node: T) => string;
  isSummary: (node: T) => boolean;
  /** Expand every node with children by default, instead of just summary nodes. */
  defaultExpanded?: boolean;
}

export interface TreeExpandState {
  isExpanded: (id: string) => boolean;
  toggle: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
}

function collectIds<T>(
  nodes: T[],
  getChildren: (node: T) => T[],
  getId: (node: T) => string,
  predicate: (node: T) => boolean,
): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    const children = getChildren(node) ?? [];
    if (children.length > 0) {
      if (predicate(node)) ids.push(getId(node));
      ids.push(...collectIds(children, getChildren, getId, predicate));
    }
  }
  return ids;
}

/**
 * Shared expand/collapse state for a tree of nodes. Re-initialises (summary
 * nodes expanded, leaves collapsed) whenever the `nodes` array identity
 * changes, i.e. whenever a fresh report is loaded.
 */
export function useTreeExpand<T>({
  nodes,
  getChildren,
  getId,
  isSummary,
  defaultExpanded = false,
}: UseTreeExpandOptions<T>): TreeExpandState {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const predicate = defaultExpanded ? () => true : isSummary;
    setExpandedIds(new Set(collectIds(nodes, getChildren, getId, predicate)));
    // Re-run only when a new node set arrives — expand/collapse toggles below
    // must not be undone by re-running this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  return {
    isExpanded: (id: string) => expandedIds.has(id),
    toggle: (id: string) =>
      setExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    expandAll: () => setExpandedIds(new Set(collectIds(nodes, getChildren, getId, () => true))),
    collapseAll: () => setExpandedIds(new Set()),
  };
}

function alignClass(align?: 'left' | 'right' | 'center') {
  if (align === 'right') return 'text-right';
  if (align === 'center') return 'text-center';
  return 'text-left';
}

export interface TreeRowsProps<T> {
  nodes: T[];
  columns: TreeTableColumn<T>[];
  getChildren: (node: T) => T[];
  getId: (node: T) => string;
  isSummary: (node: T) => boolean;
  expand: TreeExpandState;
  /** Which column gets the depth indent + expand/collapse icon. Default 0. */
  treeColumnIndex?: number;
  indentPx?: number;
  depth?: number;
}

/**
 * Recursive `<tr>` rows for a tree, with no owning `<table>`/`<thead>` — for
 * embedding inside a page's own table (e.g. alongside section header/subtotal
 * rows). For a self-contained table, use the default `TreeTable` export.
 */
export function TreeRows<T>({
  nodes,
  columns,
  getChildren,
  getId,
  isSummary,
  expand,
  treeColumnIndex = 0,
  indentPx = 20,
  depth = 0,
}: TreeRowsProps<T>) {
  return (
    <>
      {nodes.map((node) => {
        const id = getId(node);
        const children = getChildren(node) ?? [];
        const hasChildren = children.length > 0;
        const summary = isSummary(node);
        const expanded = expand.isExpanded(id);
        return (
          <Fragment key={id}>
            <tr
              className={`border-b border-border ${summary ? 'bg-gray-50 font-semibold' : 'bg-white'} ${hasChildren ? 'cursor-pointer' : ''}`}
              onClick={hasChildren ? () => expand.toggle(id) : undefined}
              role={hasChildren ? 'button' : undefined}
              tabIndex={hasChildren ? 0 : undefined}
              aria-expanded={hasChildren ? expanded : undefined}
              onKeyDown={
                hasChildren
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        expand.toggle(id);
                      }
                    }
                  : undefined
              }
            >
              {columns.map((col, ci) => (
                <td
                  key={ci}
                  className={`py-2 pr-2 ${alignClass(col.align)}`}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {ci === treeColumnIndex ? (
                    <span
                      className="inline-flex items-center gap-1"
                      style={{ paddingLeft: depth * indentPx }}
                    >
                      <span className="inline-block w-3 text-xs text-slate">
                        {hasChildren ? (expanded ? '▼' : '▶') : ''}
                      </span>
                      {col.render(node)}
                    </span>
                  ) : (
                    col.render(node)
                  )}
                </td>
              ))}
            </tr>
            {hasChildren && expanded && (
              <TreeRows
                nodes={children}
                columns={columns}
                getChildren={getChildren}
                getId={getId}
                isSummary={isSummary}
                expand={expand}
                treeColumnIndex={treeColumnIndex}
                indentPx={indentPx}
                depth={depth + 1}
              />
            )}
          </Fragment>
        );
      })}
    </>
  );
}

export interface TreeTableProps<T> {
  nodes: T[];
  columns: TreeTableColumn<T>[];
  getChildren: (node: T) => T[];
  /** Stable unique id per node — used for React keys and expand/collapse state. */
  getId: (node: T) => string;
  isSummary: (node: T) => boolean;
  defaultExpanded?: boolean;
  indentPx?: number;
  treeColumnIndex?: number;
  /** Rendered as a `<tfoot>` row (e.g. a grand-total row) below the tree. */
  footer?: ReactNode;
}

export default function TreeTable<T>({
  nodes,
  columns,
  getChildren,
  getId,
  isSummary,
  defaultExpanded = false,
  indentPx = 20,
  treeColumnIndex = 0,
  footer,
}: TreeTableProps<T>) {
  const expand = useTreeExpand({ nodes, getChildren, getId, isSummary, defaultExpanded });

  return (
    <div>
      <div className="mb-2 flex justify-end gap-3 text-sm">
        <button type="button" onClick={expand.expandAll} className="text-blue underline">
          Expand All
        </button>
        <button type="button" onClick={expand.collapseAll} className="text-blue underline">
          Collapse All
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-slate">
              {columns.map((col, ci) => (
                <th
                  key={ci}
                  className={`py-2 pr-2 font-medium ${alignClass(col.align)}`}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <TreeRows
              nodes={nodes}
              columns={columns}
              getChildren={getChildren}
              getId={getId}
              isSummary={isSummary}
              expand={expand}
              treeColumnIndex={treeColumnIndex}
              indentPx={indentPx}
            />
          </tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      </div>
    </div>
  );
}
