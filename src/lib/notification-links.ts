import type { LinkProps } from "@tanstack/react-router";

/**
 * Résolution de la destination d'une notification.
 *
 * Chaque notification structurée enregistre en base une référence claire
 * (`entity_type` + `entity_id`) et un lien déjà construit côté serveur. Ici on
 * ne fait que traduire ce lien en navigation typée TanStack Router, avec un
 * repli sur la référence lorsque le lien est absent ou inconnu. Si rien n'est
 * exploitable, on renvoie `null` : l'interface affiche alors un message clair
 * plutôt qu'une erreur de navigation.
 */

export type NotificationRef = {
  link?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Chemins sans paramètre de recherche que les notifications peuvent viser. */
const PLAIN_PATHS = [
  "/accueil",
  "/compte",
  "/compte/calendrier",
  "/compte/enfants",
  "/compte/litiges",
  "/compte/portefeuille",
  "/devoirs",
  "/pro",
  "/pro/demandes",
  "/pro/disponibilites",
  "/pro/offres",
  "/pro/profil",
  "/pro/verification",
  "/admin",
  "/admin/litiges",
  "/admin/offres",
  "/admin/professeurs",
  "/admin/retraits",
] as const;

type PlainPath = (typeof PLAIN_PATHS)[number];

function isPlainPath(path: string): path is PlainPath {
  return (PLAIN_PATHS as readonly string[]).includes(path);
}

function uuidParam(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key);
  return value && UUID.test(value) ? value : undefined;
}

export function notificationTarget(n: NotificationRef): LinkProps | null {
  const raw = n.link?.trim();
  if (raw) {
    const [path = "", queryString = ""] = raw.split("?");
    const params = new URLSearchParams(queryString);

    if (path === "/compte/reservations") {
      const search: { pack?: string; booking?: string; agenda?: boolean } = {};
      const pack = uuidParam(params, "pack");
      const booking = uuidParam(params, "booking");
      if (pack) search.pack = pack;
      if (booking) search.booking = booking;
      if (params.get("agenda") === "1") search.agenda = true;
      return { to: "/compte/reservations", search };
    }
    if (path === "/pro/cours") {
      const booking = uuidParam(params, "booking");
      return { to: "/pro/cours", search: booking ? { booking } : {} };
    }
    if (path === "/messages" || path === "/pro/messages") {
      const conversation = uuidParam(params, "conversation");
      const search = conversation ? { conversation } : {};
      return path === "/messages"
        ? { to: "/messages", search }
        : { to: "/pro/messages", search };
    }
    const teacher = /^\/professeurs\/([^/]+)$/.exec(path);
    if (teacher?.[1] && UUID.test(teacher[1])) {
      return { to: "/professeurs/$id", params: { id: teacher[1] } };
    }
    if (isPlainPath(path)) return { to: path };
  }

  // Repli sur la référence structurée
  const id = n.entity_id && UUID.test(n.entity_id) ? n.entity_id : null;
  if (!id) return null;
  switch (n.entity_type) {
    case "pack":
      return { to: "/compte/reservations", search: { pack: id, agenda: true } };
    case "booking":
      return { to: "/compte/reservations", search: { booking: id } };
    case "conversation":
      return { to: "/messages", search: { conversation: id } };
    case "teacher":
      return { to: "/professeurs/$id", params: { id } };
    default:
      return null;
  }
}
