import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

const WEEKDAYS_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MIN_LEAD_HOURS = 24;

type CalendarOffer = {
  id: string;
  title: string;
  price_fcfa: number;
  subjects?: { name: string } | null;
};

function mondayOf(date: Date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0 = lundi
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toDateStr(date: Date) {
  return date.toISOString().slice(0, 10);
}

function hhmmToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h! * 60 + (m ?? 0);
}

function minutesToHHMM(mins: number) {
  const h = Math.floor(mins / 60)
    .toString()
    .padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function overlaps(aStartMin: number, aDur: number, bStartMin: number, bDur: number) {
  return aStartMin < bStartMin + bDur && bStartMin < aStartMin + aDur;
}

/**
 * Grille de créneaux réels d'un professeur (disponibilités hebdomadaires +
 * exceptions + réservations déjà prises), réutilisée telle quelle sur la
 * fiche professeur et dans le tunnel de réservation — un seul système de
 * sélection de créneaux, pas deux. `durationMinutes` détermine le pas de
 * la grille : 60 min par défaut (fiche professeur, offre pas encore
 * choisie), ou la durée réelle de l'offre depuis le tunnel de réservation.
 */
export function AvailabilitySlotGrid({
  teacherId,
  durationMinutes = 60,
  initialDate,
  selected,
  onSelectSlot,
}: {
  teacherId: string;
  durationMinutes?: number;
  /** "YYYY-MM-DD" — ouvre la semaine/jour de ce créneau plutôt qu'aujourd'hui */
  initialDate?: string | undefined;
  selected?: { date: string; time: string } | null;
  onSelectSlot: (date: string, time: string) => void;
}) {
  const initial = initialDate ? new Date(`${initialDate}T00:00:00`) : new Date();
  const [weekStart, setWeekStart] = useState(() => mondayOf(initial));
  const [selectedDay, setSelectedDay] = useState(() => initial);

  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const availabilitiesQuery = useQuery({
    queryKey: ["public-availabilities", teacherId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("availabilities")
        .select("weekday, start_time, end_time")
        .eq("teacher_id", teacherId);
      if (error) throw error;
      return data;
    },
  });

  const exceptionsQuery = useQuery({
    queryKey: ["public-availability-exceptions", teacherId, toDateStr(weekStart)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("availability_exceptions")
        .select("exception_date, start_time, end_time")
        .eq("teacher_id", teacherId)
        .gte("exception_date", toDateStr(weekStart))
        .lt("exception_date", toDateStr(weekEnd));
      if (error) throw error;
      return data;
    },
  });

  const busyQuery = useQuery({
    queryKey: ["public-busy-slots", teacherId, toDateStr(weekStart)],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_teacher_busy_slots", {
        p_teacher_id: teacherId,
        p_from: weekStart.toISOString(),
        p_to: weekEnd.toISOString(),
      });
      if (error) throw error;
      return data;
    },
  });

  const loading = availabilitiesQuery.isLoading || exceptionsQuery.isLoading || busyQuery.isLoading;

  const daySlots = useMemo(() => {
    const availabilities = availabilitiesQuery.data ?? [];
    const exceptions = exceptionsQuery.data ?? [];
    const busy = busyQuery.data ?? [];

    const dateStr = toDateStr(selectedDay);
    const weekdayIndex = (selectedDay.getDay() + 6) % 7;

    const fullDayBlocked = exceptions.some((e) => e.exception_date === dateStr && !e.start_time);
    if (fullDayBlocked) return [];

    const partialBlocks = exceptions
      .filter((e) => e.exception_date === dateStr && e.start_time && e.end_time)
      .map((e) => ({ start: hhmmToMinutes(e.start_time!), end: hhmmToMinutes(e.end_time!) }));

    const now = Date.now();
    const minStart = now + MIN_LEAD_HOURS * 3600_000;

    const slots: { time: string; disabled: boolean; reason?: string }[] = [];
    for (const window of availabilities.filter((a) => a.weekday === weekdayIndex)) {
      const start = hhmmToMinutes(window.start_time);
      const end = hhmmToMinutes(window.end_time);
      for (let t = start; t + durationMinutes <= end; t += durationMinutes) {
        if (partialBlocks.some((b) => overlaps(t, durationMinutes, b.start, b.end - b.start))) continue;

        const slotDate = new Date(`${dateStr}T${minutesToHHMM(t)}:00`);
        const isBusy = busy.some((b) =>
          overlaps(
            slotDate.getTime() / 60_000,
            durationMinutes,
            new Date(b.scheduled_at).getTime() / 60_000,
            b.duration_minutes,
          ),
        );
        if (isBusy) continue;
        if (slotDate.getTime() <= now) continue;

        if (slotDate.getTime() < minStart) {
          slots.push({ time: minutesToHHMM(t), disabled: true, reason: "Trop proche — contactez le professeur" });
        } else {
          slots.push({ time: minutesToHHMM(t), disabled: false });
        }
      }
    }
    return slots;
  }, [selectedDay, durationMinutes, availabilitiesQuery.data, exceptionsQuery.data, busyQuery.data]);

  const selectedDateStr = toDateStr(selectedDay);

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setWeekStart((w) => addDays(w, -7))}
          aria-label="Semaine précédente"
          className="flex size-8 items-center justify-center rounded-full border border-border text-foreground hover:bg-secondary"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <p className="text-sm font-semibold text-foreground">
          {weekStart.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} –{" "}
          {addDays(weekStart, 6).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
        </p>
        <button
          type="button"
          onClick={() => setWeekStart((w) => addDays(w, 7))}
          aria-label="Semaine suivante"
          className="flex size-8 items-center justify-center rounded-full border border-border text-foreground hover:bg-secondary"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {days.map((day, index) => {
          const isSelected = toDateStr(day) === selectedDateStr;
          const isPast = toDateStr(day) < toDateStr(new Date());
          return (
            <button
              key={toDateStr(day)}
              type="button"
              disabled={isPast}
              onClick={() => setSelectedDay(day)}
              className={`flex flex-col items-center gap-0.5 rounded-xl py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/60 text-foreground hover:bg-secondary"
              }`}
            >
              <span>{WEEKDAYS_SHORT[index]}</span>
              <span>{day.getDate()}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement des créneaux…
          </div>
        ) : daySlots.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            Aucun créneau disponible ce jour-là.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {daySlots.map((slot) => {
              const isChosen = selected?.date === selectedDateStr && selected?.time === slot.time;
              return (
                <button
                  key={slot.time}
                  type="button"
                  disabled={slot.disabled}
                  title={slot.reason}
                  onClick={() => onSelectSlot(selectedDateStr, slot.time)}
                  className={`rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${
                    slot.disabled
                      ? "cursor-not-allowed border-border/60 text-muted-foreground/60"
                      : isChosen
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-primary/40 text-foreground hover:border-primary hover:bg-primary-soft/50"
                  }`}
                >
                  {slot.time}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Heures d'Abidjan. Réservation possible jusqu'à 24h avant le cours.
      </p>
    </div>
  );
}

/** Grille de créneaux + choix de l'offre, pour la fiche professeur publique. */
export function TeacherAvailabilityCalendar({
  teacherId,
  offers,
}: {
  teacherId: string;
  offers: CalendarOffer[];
}) {
  const navigate = useNavigate();
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string } | null>(null);
  const [selectedOfferId, setSelectedOfferId] = useState<string>(offers[0]?.id ?? "");

  function handleSelectSlot(date: string, time: string) {
    if (offers.length <= 1) {
      const offerId = offers[0]?.id;
      if (!offerId) return;
      navigate({ to: "/reserver/$offerId", params: { offerId }, search: { date, time } });
      return;
    }
    setSelectedSlot({ date, time });
  }

  return (
    <div className="space-y-4">
      <AvailabilitySlotGrid teacherId={teacherId} onSelectSlot={handleSelectSlot} selected={selectedSlot} />

      {selectedSlot ? (
        <div className="rounded-2xl border border-primary/30 bg-primary-soft/40 p-4">
          <p className="text-sm font-semibold text-foreground">
            Créneau du{" "}
            {new Date(`${selectedSlot.date}T00:00:00`).toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}{" "}
            à {selectedSlot.time} — choisissez une offre
          </p>
          <div className="mt-3 space-y-2">
            {offers.map((offer) => (
              <label
                key={offer.id}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 text-sm ${
                  selectedOfferId === offer.id ? "border-primary bg-card" : "border-border bg-card/60"
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="calendar-offer"
                    checked={selectedOfferId === offer.id}
                    onChange={() => setSelectedOfferId(offer.id)}
                    className="accent-[var(--color-primary)]"
                  />
                  <span>
                    <span className="block font-semibold text-foreground">{offer.title}</span>
                    <span className="block text-xs text-muted-foreground">{offer.subjects?.name}</span>
                  </span>
                </span>
                <span className="shrink-0 font-semibold text-foreground">
                  {offer.price_fcfa.toLocaleString("fr-FR")} FCFA
                </span>
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              navigate({
                to: "/reserver/$offerId",
                params: { offerId: selectedOfferId },
                search: { date: selectedSlot.date, time: selectedSlot.time },
              })
            }
            className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Continuer vers la réservation
          </button>
        </div>
      ) : null}
    </div>
  );
}
