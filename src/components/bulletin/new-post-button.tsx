"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { BulletinPostForm } from "@/components/bulletin/bulletin-post-form";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n/dictionary";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";

export function NewPostButton({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
  const dict = getDictionary(locale).bulletin;
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        {dict.newPost}
      </Button>

      <BulletinPostForm open={open} onClose={() => setOpen(false)} locale={locale} />
    </>
  );
}
