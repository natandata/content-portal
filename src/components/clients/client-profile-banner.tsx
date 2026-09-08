import { coverGradientClass } from "@/lib/cover-palette";
import { cn, initials } from "@/lib/utils";

/**
 * Capa + foto do cliente em modo leitura — mesma capa/avatar que a equipe
 * define em ClientCoverPicker/ClientAvatarUpload (client-detail.tsx), so que
 * sem os controles de edicao. Usado no inicio do cliente pra ele ver o mesmo
 * visual que o profissional configurou para a conta dele.
 */
export function ClientProfileBanner({
  companyName,
  coverColor,
  avatarUrl,
  className,
}: {
  companyName: string;
  coverColor: string | null;
  avatarUrl: string | null;
  className?: string;
}) {
  return (
    <div className={cn("mb-5", className)}>
      <div
        className={cn(
          "h-24 w-full overflow-hidden rounded-xl bg-gradient-to-br sm:h-32",
          coverGradientClass(coverColor),
        )}
      />
      <div className="-mt-8 ml-4 sm:-mt-10">
        <span className="ring-surface flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink-100 text-sm font-semibold text-ink-600 ring-2 sm:size-20">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            initials(companyName)
          )}
        </span>
      </div>
    </div>
  );
}
