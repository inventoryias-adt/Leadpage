'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { cepDigits } from '@/lib/address';
import { ADDRESS_LABELS, MAX_SAVED_ADDRESSES, inBrazil, savedText } from '@/lib/customer-location';
import { prisma } from '@/lib/db';
import { TOO_MANY, allow } from '@/lib/rate-limit';
import { getCustomer } from '@/lib/session';

const schema = z.object({
  label: z.enum(ADDRESS_LABELS),
  street: z.string().trim().min(2, 'Informe a rua.').max(120),
  number: z.string().trim().min(1, 'Informe o número (ou S/N).').max(12),
  complement: z.string().trim().max(60).default(''),
  district: z.string().trim().max(80).default(''),
  city: z.string().trim().min(2, 'Informe a cidade.').max(80),
  state: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'Informe a UF.'),
  cep: z.string().default(''),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
});

export type SavedAddress = { id: string; label: string; title: string; sub: string; lat: number; lng: number };
export type SaveAddressResult = { ok: true; address: SavedAddress } | { ok: false; error: string };

/** Guarda um endereço do cliente (máximo de {MAX_SAVED_ADDRESSES}); Casa e Trabalho têm um só, e salvar de novo troca o anterior. */
export async function saveMyAddress(input: Record<string, string>): Promise<SaveAddressResult> {
  const customer = await getCustomer();
  if (!customer) return { ok: false, error: 'Entre na sua conta para salvar o endereço.' };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (!inBrazil(d.lat, d.lng)) return { ok: false, error: 'O ponto marcado está fora do Brasil. Ajuste no mapa.' };
  if (!(await allow(`addr:${customer.id}`, 30, 3600))) return { ok: false, error: TOO_MANY };

  const cep = cepDigits(d.cep);
  const data = {
    label: d.label, street: d.street, number: d.number, complement: d.complement || null, district: d.district || null,
    city: d.city, state: d.state, cep: cep.length === 8 ? cep : null, latitude: d.lat, longitude: d.lng,
  };

  const saved = await prisma.$transaction(async (tx) => {
    if (d.label !== 'OUTRO') {
      const same = await tx.customerAddress.findFirst({ where: { customerId: customer.id, label: d.label } });
      if (same) return tx.customerAddress.update({ where: { id: same.id }, data });
    }
    if ((await tx.customerAddress.count({ where: { customerId: customer.id } })) >= MAX_SAVED_ADDRESSES) return null;
    return tx.customerAddress.create({ data: { customerId: customer.id, ...data } });
  });
  if (!saved) return { ok: false, error: `Você pode salvar até ${MAX_SAVED_ADDRESSES} endereços. Apague um para adicionar outro.` };
  revalidatePath('/lugares');
  const { title, sub } = savedText(saved);
  return { ok: true, address: { id: saved.id, label: saved.label, title, sub, lat: saved.latitude, lng: saved.longitude } };
}

/** Apaga um endereço salvo (só o do próprio cliente). */
export async function deleteMyAddress(id: string): Promise<{ ok: boolean }> {
  const customer = await getCustomer();
  if (!customer) return { ok: false };
  const done = await prisma.customerAddress.deleteMany({ where: { id, customerId: customer.id } });
  revalidatePath('/lugares');
  return { ok: done.count > 0 };
}
