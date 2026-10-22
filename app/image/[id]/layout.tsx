// No Suspense/skeleton here: post pages are ISR and render completely on the
// server, and a boundary around them made notFound() stream a 200 "not found"
// page (a soft 404 to Google) instead of a real 404.
export default function ImageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
