import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminForm } from '@/components/admin/AdminForm';
import { currentUser } from '@/lib/auth/session';
import { hasRole } from '@/lib/auth/roles';
import { listAllCategoryOptions, listAllCityOptions } from '@/lib/db/taxonomy-admin';
import { FEATURED_PACKAGE_DAYS, getListingForEdit, PREMIUM_PACKAGE_DAYS } from '@/lib/db/listings-admin';
import { MAX_FEATURED_SLOTS } from '@/lib/config';
import { getListingLeadReport, getListingLeadTrend } from '@/lib/db/leads-admin';
import { asuncionMonthRange, asuncionMonthRanges } from '@/lib/hours';
import { mediaConfigured } from '@/lib/media/upload';
import { mediaUrl } from '@/lib/media/url';
import { waLink } from '@/lib/format';
import {
  hoursDefaultValues,
  hoursFields,
  listingFields,
  premiumDefaultValues,
  premiumFields,
  verifiedDefaultValues,
  verifiedFields,
} from '../fields';
import {
  deleteListingAction,
  extendFeaturedAction,
  extendPremiumAction,
  moveGalleryImageAction,
  removeFeaturedAction,
  removeGalleryImageAction,
  savePremiumUntilAction,
  saveVerifiedAction,
  saveHoursAction,
  setCoverImageAction,
  updateGalleryAltAction,
  updateListingAction,
  uploadGalleryImageAction,
} from '../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Negocio' };

export default async function EditListingPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const actor = await currentUser();

  // Not-found and not-allowed are the same 404 on purpose (ROADMAP rule 5).
  let listing;
  try {
    listing = await getListingForEdit(actor, params.id);
  } catch {
    notFound();
  }
  if (!listing) notFound();

  const monthRange = asuncionMonthRange();
  // Six months is the renewal-conversation window: enough to show a trend,
  // short enough that a business that only just joined does not read as
  // declining (ROADMAP W2-5).
  const trendRanges = asuncionMonthRanges(6);
  const [categories, cities, leadReport, leadTrend] = await Promise.all([
    listAllCategoryOptions(actor),
    listAllCityOptions(actor),
    getListingLeadReport(actor, listing.id, monthRange),
    getListingLeadTrend(actor, listing.id, trendRanges),
  ]);
  const update = updateListingAction.bind(null, params.id);
  const deleteThisListing = deleteListingAction.bind(null, params.id);
  const saveHours = saveHoursAction.bind(null, params.id);
  const saveVerified = saveVerifiedAction.bind(null, params.id);
  const savePremiumUntil = savePremiumUntilAction.bind(null, params.id);
  const upload = uploadGalleryImageAction.bind(null, params.id);
  const galleryError = typeof searchParams.galleryError === 'string' ? searchParams.galleryError : undefined;
  const flagsError = typeof searchParams.flagsError === 'string' ? searchParams.flagsError : undefined;
  const deleteError = typeof searchParams.deleteError === 'string' ? searchParams.deleteError : undefined;
  const isAdmin = hasRole(actor, ['admin']);
  const isCurrentlyPremium = !!listing.premiumUntil && listing.premiumUntil > Date.now() / 1000;
  const isCurrentlyFeatured = !!listing.featuredUntil && listing.featuredUntil > Date.now() / 1000;

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <Link href="/admin/negocios" className="text-[14px] font-bold text-blue hover:underline">
          ← Negocios
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-[28px] font-semibold">{listing.name}</h1>
          <Link
            href={`/admin/negocios/${params.id}/qr`}
            className="rounded-card border-[1.5px] border-blue px-3 py-1.5 text-[13px] font-bold text-blue"
          >
            Código QR
          </Link>
        </div>
        <p className="mt-1 font-mono text-[14px] text-ink2">/lugar/{listing.slug}</p>
      </div>

      <section className="rounded-card border border-line bg-cream/60 p-5">
        <h2 className="font-serif text-[18px] font-semibold capitalize">{monthRange.monthLabel}</h2>
        <p className="mt-1 text-[15px] text-ink2">
          {leadReport.total > 0 ? (
            <>
              <span className="font-bold text-ink">{leadReport.whatsappClicks}</span> clics a su WhatsApp,{' '}
              <span className="font-bold text-ink">{leadReport.messages}</span> consultas por mensaje.
            </>
          ) : (
            'Todavía no llegó ningún lead este mes.'
          )}
        </p>

        {/* The renewal number (ROADMAP W2-5). Bars are scaled to the busiest
            month in the window, so a quiet six months does not render as six
            identical full bars. The count is always written out — a bar alone
            is not a number you can quote to a business owner. */}
        {leadTrend.some((m) => m.total > 0) && (
          <div className="mt-5">
            <h3 className="text-[12px] font-bold uppercase tracking-wide text-ink3">Últimos 6 meses</h3>
            <ul className="mt-2 space-y-1.5">
              {leadTrend.map((month) => {
                const peak = Math.max(...leadTrend.map((m) => m.total), 1);
                return (
                  <li key={month.monthLabel} className="flex items-center gap-3 text-[13px]">
                    <span className="w-28 shrink-0 capitalize text-ink2">{month.monthLabel}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-line2">
                      <span
                        className="block h-full rounded-full bg-blue"
                        style={{ width: `${Math.round((month.total / peak) * 100)}%` }}
                      />
                    </span>
                    <span className="w-24 shrink-0 text-right font-bold text-ink">
                      {month.total} {month.total === 1 ? 'lead' : 'leads'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <AdminForm
        fields={listingFields(
          'update',
          categories,
          cities,
        )}
        action={update}
        submitLabel="Guardar cambios"
        defaultValues={{ ...listing }}
      />

      <section className="rounded-card border border-line bg-white p-5">
        <h2 className="font-serif text-[20px] font-semibold">Horarios</h2>
        <p className="mt-1 text-[15px] text-ink2">
          Dejá los dos campos de un turno vacíos si el negocio no abre ese día. Un turno que cierra antes de la
          hora en que abre cruza la medianoche (ej. 22:00 a 02:00).
        </p>
        <div className="mt-4">
          <AdminForm
            fields={hoursFields()}
            action={saveHours}
            submitLabel="Guardar horarios"
            defaultValues={hoursDefaultValues(listing.hours)}
          />
        </div>
      </section>

      <section className="rounded-card border border-line bg-white p-5">
        <h2 className="font-serif text-[20px] font-semibold">Galería</h2>
        {!mediaConfigured() ? (
          <p className="mt-3 rounded-card border border-line bg-cream px-4 py-3 text-[14px] text-ink2">
            Falta configurar el almacenamiento de imágenes.
          </p>
        ) : (
          <>
            {galleryError && (
              <p role="alert" className="mt-2 text-[14px] font-medium text-terra">
                {galleryError}
              </p>
            )}

            {listing.gallery.length > 0 && (
              <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                {listing.gallery.map((img, i) => {
                  const isCover = listing.coverImage === img.key;
                  const move = moveGalleryImageAction.bind(null, params.id, img.id);
                  const removeImage = removeGalleryImageAction.bind(null, params.id, img.id);
                  const setCover = setCoverImageAction.bind(null, params.id, img.key);
                  const updateAlt = updateGalleryAltAction.bind(null, params.id, img.id);
                  return (
                    <li key={img.id} className="space-y-2 rounded-card border border-line p-2">
                      <div className="relative h-24 w-full overflow-hidden rounded-[10px]">
                        <Image src={mediaUrl(img.key)} alt={img.alt ?? ''} fill sizes="200px" className="object-cover" />
                        {isCover && (
                          <span className="absolute left-1.5 top-1.5 rounded-full bg-terra px-2 py-0.5 text-[11px] font-bold text-white">
                            Portada
                          </span>
                        )}
                      </div>
                      <form action={updateAlt} className="flex gap-1">
                        <input
                          type="text"
                          name="alt"
                          defaultValue={img.alt ?? ''}
                          placeholder="Describí la foto"
                          maxLength={200}
                          aria-label={`Texto alternativo de la foto ${i + 1}`}
                          className="min-w-0 flex-1 rounded-[8px] border border-line px-2 py-1 text-[12px]"
                        />
                        <button type="submit" className="shrink-0 text-[11px] font-bold text-blue">
                          Guardar
                        </button>
                      </form>
                      <div className="flex flex-wrap items-center gap-2 text-[12px]">
                        <form action={move.bind(null, 'up')}>
                          <button type="submit" className="font-bold text-blue">
                            ↑ Mover
                          </button>
                        </form>
                        <form action={move.bind(null, 'down')}>
                          <button type="submit" className="font-bold text-blue">
                            ↓ Mover
                          </button>
                        </form>
                        {!isCover && (
                          <form action={setCover}>
                            <button type="submit" className="font-bold text-blue">
                              Portada
                            </button>
                          </form>
                        )}
                        <form action={removeImage}>
                          <button type="submit" className="font-bold text-terra">
                            Quitar
                          </button>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <form action={upload} encType="multipart/form-data" className="mt-4 flex flex-wrap items-center gap-3">
              <input
                type="file"
                name="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                required
                aria-label="Subir foto"
                className="text-[13px]"
              />
              <button
                type="submit"
                className="rounded-card border-[1.5px] border-blue px-4 py-2 text-sm font-bold text-blue disabled:opacity-50"
                disabled={listing.gallery.length >= 12}
              >
                Subir foto
              </button>
              {listing.gallery.length >= 12 && (
                <span className="text-[13px] text-ink2">Llegaste al máximo de 12 fotos.</span>
              )}
            </form>
          </>
        )}
      </section>

      {isAdmin && (
        <section className="rounded-card border border-line bg-white p-5">
          <h2 className="font-serif text-[20px] font-semibold">Verificación y premium</h2>
          <p className="mt-1 text-[15px] text-ink2">
            Solo visible para administradores. Estos campos no aparecen en el formulario de un editor.
          </p>

          {flagsError && (
            <p role="alert" className="mt-2 text-[14px] font-medium text-terra">
              {flagsError}
            </p>
          )}

          {/* Manual premium sales flow (ROADMAP Phase D item 2): sell the
              package over WhatsApp, invoice outside the app, then apply it
              here in one click instead of computing a date by hand. */}
          <div className="mt-4 rounded-card border border-line bg-cream/60 p-4">
            <p className="text-[13px] font-bold uppercase tracking-wide text-ink2">Vender premium</p>
            <p className="mt-1 text-[14px] text-ink2">
              {isCurrentlyPremium
                ? 'Ya está premium. Extender suma días desde el vencimiento actual, no desde hoy.'
                : 'No está premium. Un paquete lo activa desde hoy.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {PREMIUM_PACKAGE_DAYS.map((days) => (
                <form key={days} action={extendPremiumAction.bind(null, params.id, days)}>
                  <button
                    type="submit"
                    className="rounded-card border-[1.5px] border-blue px-3.5 py-2 text-[13px] font-bold text-blue"
                  >
                    {days === 365 ? '+ 1 año' : `+ ${days} días`}
                  </button>
                </form>
              ))}
              {listing.whatsapp && (
                <a
                  href={waLink(
                    listing.whatsapp,
                    `Hola ${listing.name}, te escribo de negocio.com.py por el plan Premium.`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto rounded-card bg-[#25D366] px-3.5 py-2 text-[13px] font-bold text-white"
                >
                  Vender por WhatsApp
                </a>
              )}
            </div>
          </div>

          {/* "Destacado en portada" (ROADMAP Phase D item 3): a separate,
              limited paid slot on the home page — not the same thing as
              Premium, which only competes for the home page's general
              destacados section. */}
          <div className="mt-4 rounded-card border border-line bg-cream/60 p-4">
            <p className="text-[13px] font-bold uppercase tracking-wide text-ink2">Destacado en portada</p>
            <p className="mt-1 text-[14px] text-ink2">
              {isCurrentlyFeatured
                ? 'Tiene un lugar en la portada. Extender suma días desde el vencimiento actual.'
                : `No está en la portada. Hay como máximo ${MAX_FEATURED_SLOTS} lugares a la vez.`}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {FEATURED_PACKAGE_DAYS.map((days) => (
                <form key={days} action={extendFeaturedAction.bind(null, params.id, days)}>
                  <button
                    type="submit"
                    className="rounded-card border-[1.5px] border-blue px-3.5 py-2 text-[13px] font-bold text-blue"
                  >
                    + {days} días
                  </button>
                </form>
              ))}
              {isCurrentlyFeatured && (
                <form action={removeFeaturedAction.bind(null, params.id)}>
                  <button type="submit" className="rounded-card px-3.5 py-2 text-[13px] font-bold text-terra">
                    Quitar de portada
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Two forms, deliberately (ROADMAP W2-2). "Verificado" is a human
              assertion — somebody rang the business — and it is never sold.
              "Premium hasta" is a sale. Sharing one form meant saving either
              silently rewrote the other, and an unchecked checkbox that is not
              rendered submits nothing at all, so any variant of that form
              without the checkbox would have un-verified the business on save. */}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-card border border-line bg-cream p-4">
              <h3 className="text-[14px] font-bold">Verificación</h3>
              <p className="mt-1 text-[13px] text-ink2">Una comprobación humana. No se vende.</p>
              <div className="mt-3">
                <AdminForm
                  fields={verifiedFields()}
                  action={saveVerified}
                  submitLabel="Guardar verificación"
                  defaultValues={verifiedDefaultValues(listing.verified)}
                />
              </div>
            </div>

            <div className="rounded-card border border-line bg-cream p-4">
              <h3 className="text-[14px] font-bold">Premium</h3>
              <p className="mt-1 text-[13px] text-ink2">
                Ajuste manual de la fecha. Para una venta usá los paquetes de arriba.
              </p>
              <div className="mt-3">
                <AdminForm
                  fields={premiumFields()}
                  action={savePremiumUntil}
                  submitLabel="Guardar premium"
                  defaultValues={premiumDefaultValues(listing.premiumUntil)}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {isAdmin && (
        <section className="rounded-card border border-terra bg-terra/5 p-5">
          <h2 className="font-serif text-[20px] font-semibold">Eliminar negocio</h2>
          <p className="mt-1 text-[15px] text-ink2">
            Borra el negocio y todo lo que depende de él (horarios, galería). No se puede deshacer.
          </p>
          {/* The confirmation is a typed slug, not a checkbox and not a
              `confirm()` dialog: it has to be something the person cannot do
              by reflex, and it has to survive JavaScript being off. The server
              re-checks it against the row (`deleteListing`), so this input is
              the ergonomics, never the guard. */}
          <form action={deleteThisListing} className="mt-4 max-w-sm">
            <label htmlFor="confirm" className="block text-[13px] font-semibold text-ink2">
              Escribí <code className="rounded bg-paper px-1 font-mono text-[12px]">{listing.slug}</code> para
              confirmar
            </label>
            <input
              id="confirm"
              name="confirm"
              type="text"
              required
              autoComplete="off"
              spellCheck={false}
              aria-describedby={deleteError ? 'delete-error' : undefined}
              className="mt-1.5 w-full rounded-card border border-line px-3 py-2 text-sm"
            />
            {deleteError && (
              <p id="delete-error" role="alert" className="mt-2 text-[13px] font-semibold text-terra">
                {deleteError}
              </p>
            )}
            <button
              type="submit"
              className="mt-3 rounded-card bg-terra px-4 py-2.5 text-sm font-bold text-white"
            >
              Eliminar negocio
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
