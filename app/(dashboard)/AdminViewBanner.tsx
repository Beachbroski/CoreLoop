export function AdminViewBanner({
  viewingAsName,
  viewingAsEmail,
  notFound,
}: {
  viewingAsName?: string | null
  viewingAsEmail?: string
  notFound?: boolean
}) {
  return (
    <div className="banner-warning" style={{ marginBottom: 20 }}>
      <p style={{ margin: 0, fontWeight: 600 }}>
        {notFound
          ? 'That account could not be found — showing your own admin view.'
          : viewingAsEmail
            ? `Read-only admin view — viewing as ${viewingAsName ?? viewingAsEmail} (${viewingAsEmail}). No changes will be saved.`
            : 'Read-only admin view — pick an account from the internal users list to view their dashboard.'}
      </p>
    </div>
  )
}
