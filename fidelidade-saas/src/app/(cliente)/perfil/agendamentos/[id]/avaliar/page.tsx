import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon } from '@/components/Icons';
import { ReviewForm } from '@/components/ReviewForm';
import { Stars } from '@/components/Stars';
import { formatBookingWhen } from '@/lib/booking';
import { prisma } from '@/lib/db';
import { REVIEW_WINDOW_DAYS, reviewWindowOpen } from '@/lib/reviews';
import { requireCustomer } from '@/lib/session';

export const metadata = { title: 'Avaliar atendimento' };
export const dynamic = 'force-dynamic';

export default async function AvaliarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const customer = await requireCustomer(`/perfil/agendamentos/${id}/avaliar`);
  const booking = await prisma.booking.findFirst({
    where: { id, customerId: customer.id },
    include: { restaurant: { select: { id: true, name: true } }, resource: { select: { name: true } }, review: { select: { placeRating: true, staffRating: true, comment: true } } },
  });
  if (!booking) notFound();

  const back = (
    <Link href="/perfil/agendamentos" className="inline-flex items-center gap-1 text-sm font-semibold text-electric-600"><Icon name="back" size={16} /> Meus agendamentos</Link>
  );

  let body: React.ReactNode;
  if (booking.status !== 'COMPLETED') {
    body = <p role="status" className="glass-panel-sm p-4 text-sm text-slate-600">Você poderá avaliar quando o atendimento for concluído pelo lugar.</p>;
  } else if (booking.review) {
    body = (
      <section role="status" data-testid="review-done" className="glass-panel space-y-2 p-5">
        <p className="font-bold text-slate-800">Você já avaliou este atendimento. Obrigado!</p>
        <p className="flex items-center gap-2 text-sm text-slate-600"><Stars value={booking.review.placeRating} size={20} /> {booking.restaurant.name}</p>
        {booking.review.staffRating && booking.resource && <p className="flex items-center gap-2 text-sm text-slate-600"><Stars value={booking.review.staffRating} size={20} /> {booking.resource.name}</p>}
        {booking.review.comment && <p className="whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{booking.review.comment}</p>}
      </section>
    );
  } else if (!reviewWindowOpen(booking.completedAt)) {
    body = <p role="status" className="glass-panel-sm p-4 text-sm text-slate-600">O prazo para avaliar ({REVIEW_WINDOW_DAYS} dias depois do atendimento) já passou.</p>;
  } else {
    body = <ReviewForm bookingId={booking.id} placeName={booking.restaurant.name} staffName={booking.resource?.name ?? null} />;
  }

  return (
    <main className="space-y-5 p-4 sm:p-6 md:pt-8">
      <header>
        {back}
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-primary">Avaliar atendimento</h1>
        <p className="text-sm text-slate-600">{booking.serviceName} · {formatBookingWhen(booking.startsAt)}{booking.resource ? ` · com ${booking.resource.name}` : ''} · {booking.restaurant.name}</p>
      </header>
      {body}
    </main>
  );
}
