import 'server-only';
import { BusinessError } from './claims';
import { downloadWithFallback } from './product-images';

/** Aceita só data URL de imagem; campo vazio = sem foto nova. */
export const imageField = (formData: FormData, key: string) => {
  const v = String(formData.get(key) ?? '');
  return v.startsWith('data:image/') ? v : null;
};

/** Foto enviada do computador (data URL) ou escolhida na busca da web (URL de host permitido, baixada aqui). */
export async function photoFromForm(formData: FormData): Promise<string | null> {
  const file = imageField(formData, 'imageData');
  if (file) return file;
  const web = String(formData.get('imageWebUrl') ?? '');
  if (!web) return null;
  try {
    return await downloadWithFallback(web, String(formData.get('imageWebAlt') ?? '') || undefined);
  } catch (e) {
    throw new BusinessError(e instanceof Error ? e.message : 'Não foi possível baixar a imagem.');
  }
}
