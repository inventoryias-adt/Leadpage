export const metadata = { title: { default: 'Administração · Fidelize', template: '%s · Administração' }, robots: { index: false, follow: false } };

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
