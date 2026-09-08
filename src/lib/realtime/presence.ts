/**
 * Nome do canal de presenca compartilhado por `PresenceTracker` (quem
 * anuncia que esta online) e `OnlineStaffCard` (quem le a lista). Um
 * constante em arquivo proprio pra nunca dessincronizar entre os dois.
 *
 * So profissionais e admins entram nesse canal -- `WorkspaceShell` e
 * exclusivo deles (o cliente usa `ClientShell`, que nunca monta o
 * `PresenceTracker`), entao a presenca nunca inclui nem vaza pra clientes.
 */
export const STAFF_PRESENCE_CHANNEL = "presence:staff-online";

export interface StaffPresence {
  userId: string;
  name: string;
  role: "admin" | "professional";
  onlineAt: string;
}
