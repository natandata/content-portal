import { fileExtension, safeFileName } from "@/lib/utils";

/**
 * Convencao de caminhos no Storage. O primeiro segmento e sempre o client_id —
 * as policies de `storage.objects` dependem disso.
 */
export const BUCKETS = {
  contracts: "contracts",
  signedContracts: "signed-contracts",
  content: "content",
  thumbnails: "thumbnails",
  profiles: "profiles",
  invoices: "invoices",
  ideas: "ideas",
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

export function contractPath(clientId: string, contractId: string, fileName: string): string {
  return `${clientId}/${contractId}/${Date.now()}-${safeFileName(fileName)}`;
}

export function signedContractPath(
  clientId: string,
  contractId: string,
  fileName: string,
): string {
  return `${clientId}/${contractId}/${Date.now()}-assinado-${safeFileName(fileName)}`;
}

export function contentFilePath(
  clientId: string,
  contentId: string,
  position: number,
  fileName: string,
): string {
  const extension = fileExtension(fileName);
  return `${clientId}/${contentId}/${String(position).padStart(2, "0")}-${Date.now()}.${extension}`;
}

export function thumbnailPath(clientId: string, contentId: string, position: number): string {
  return `${clientId}/${contentId}/${String(position).padStart(2, "0")}-${Date.now()}.jpg`;
}

export function invoiceBoletoPath(clientId: string, invoiceId: string, fileName: string): string {
  return `${clientId}/${invoiceId}/${Date.now()}-${safeFileName(fileName)}`;
}

export function avatarPath(clientId: string, fileName: string): string {
  return `${clientId}/avatar-${Date.now()}.${fileExtension(fileName)}`;
}

/** Capa do card em Clientes e do topo da tela do cliente — mesma imagem, dois recortes. */
export function clientCoverPath(clientId: string, fileName: string): string {
  return `${clientId}/cover-${Date.now()}.${fileExtension(fileName)}`;
}

export function highlightCoverPath(
  clientId: string,
  position: number,
  fileName: string,
): string {
  const slot = String(position).padStart(2, "0");
  return `${clientId}/destaque-${slot}-${Date.now()}.${fileExtension(fileName)}`;
}

/** Bucket "ideas": primeiro segmento e o professional_id (dono da ideia). */
export function ideaImagePath(professionalId: string, ideaId: string, fileName: string): string {
  return `${professionalId}/${ideaId}/${Date.now()}-${safeFileName(fileName)}`;
}
