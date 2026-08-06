"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateAvatarPath } from "@/app/profile/actions";

export function AvatarUpload({ userId }: { userId: string }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    await updateAvatarPath(path);
    setUploading(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">Profile picture</label>
      <input type="file" accept="image/*" onChange={handleChange} disabled={uploading} />
      {uploading && <p className="text-sm text-zinc-600">Uploading...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
