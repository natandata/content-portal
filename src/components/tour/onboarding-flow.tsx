"use client";

import { useState } from "react";

import { NotificationPrompt } from "@/components/notifications/notification-prompt";
import { AppTour } from "@/components/tour/app-tour";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";
import type { UserRole } from "@/types/database";

type Step = "tour" | "notifications" | "done";

/**
 * Encadeia o que aparece no primeiro acesso: tour, depois (se ainda nao
 * respondido) o convite de notificacoes. Nunca os dois ao mesmo tempo — um
 * fecha antes do outro abrir.
 */
export function OnboardingFlow({
  role,
  locale = DEFAULT_LOCALE,
  showTour,
  showNotificationPrompt,
}: {
  role: UserRole;
  locale?: Locale;
  showTour: boolean;
  showNotificationPrompt: boolean;
}) {
  const [step, setStep] = useState<Step>(() => {
    if (showTour) return "tour";
    if (showNotificationPrompt) return "notifications";
    return "done";
  });

  if (step === "tour") {
    return (
      <AppTour
        role={role}
        locale={locale}
        onDone={() => setStep(showNotificationPrompt ? "notifications" : "done")}
      />
    );
  }

  if (step === "notifications") {
    return <NotificationPrompt locale={locale} onDone={() => setStep("done")} />;
  }

  return null;
}
